import AsyncStorage from '@react-native-async-storage/async-storage';
import { normaliseStage, ProBid, ProProfile, RealityEvent, ServiceJob, STAGE_RANK, UserProfile } from './types';

const ACTIVE_PHONE_KEY = 'rc_active_phone_v7';
const JOBS_KEY = 'rc_shared_marketplace_jobs_v7';
const PROS_KEY = 'rc_global_registered_pros_v7';

function normalisePhone(phone?: string): string {
  return phone ? phone.replace(/[^0-9]/g, '').slice(-10) : '';
}

function getKey(type: 'profile' | 'jobs' | 'events' | 'sos' | 'ai_chat', phone?: string): string {
  const p = phone ? normalisePhone(phone) : 'guest';
  return `rc_user_${p}_${type}_v7`;
}

export function apiBase(): string | null {
  const base = process.env.EXPO_PUBLIC_API_URL;
  if (!base || !base.startsWith('http')) return null;
  return base.replace(/\/$/, '');
}

/**
 * fetch with a timeout that works in React Native. AbortSignal.timeout is a
 * Node/Chrome API and is not implemented by RN's polyfill, so the old code threw
 * on every call and the bare catch hid it — meaning remote sync never ran on a
 * device at all.
 */
async function fetchWithTimeout(url: string, init: RequestInit = {}, ms = 4000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Merges job lists from two sources by id, keeping the most advanced stage for
 * each job. Whole-array replacement used to let one stale device erase a job
 * that another device had just advanced.
 */
export function mergeJobs(local: ServiceJob[], remote: ServiceJob[]): ServiceJob[] {
  const byId = new Map<string, ServiceJob>();
  const rank = (s: string) => STAGE_RANK[normaliseStage(s)];

  for (const job of local) if (job?.id) byId.set(job.id, { ...job, stage: normaliseStage(job.stage) });
  for (const raw of remote) {
    if (!raw?.id) continue;
    const job = { ...raw, stage: normaliseStage(raw.stage) };
    const existing = byId.get(job.id);
    if (!existing) {
      byId.set(job.id, job);
      continue;
    }
    // Whichever copy is further along wins; on a tie the local copy wins.
    const base = rank(job.stage) > rank(existing.stage) ? { ...existing, ...job } : { ...job, ...existing };

    const declined = [...new Set([...(existing.declinedPhones ?? []), ...(job.declinedPhones ?? [])])];
    // One bid per pro: the most recent quote they sent.
    const latest = new Map<string, ProBid>();
    for (const bid of [...(existing.bids ?? []), ...(job.bids ?? [])]) {
      if (!bid?.proPhone || declined.includes(bid.proPhone)) continue;
      const prev = latest.get(bid.proPhone);
      if (!prev || String(bid.timestamp) > String(prev.timestamp)) latest.set(bid.proPhone, bid);
    }
    const bids = [...latest.values()];
    // The pro's live position: whichever copy saw it most recently.
    const loc = String(job.proLocationAt ?? '') > String(existing.proLocationAt ?? '') ? job : existing;
    byId.set(job.id, {
      ...base,
      proLat: loc.proLat ?? base.proLat,
      proLng: loc.proLng ?? base.proLng,
      proLocationAt: loc.proLocationAt ?? base.proLocationAt,
      stageTimes: existing.stageTimes || job.stageTimes ? { ...job.stageTimes, ...existing.stageTimes, ...base.stageTimes } : undefined,
      bids,
      hasBids: bids.length > 0,
      declinedPhones: declined.length ? declined : undefined
    });
  }

  return [...byId.values()].sort((x, y) => {
    const xi = Number(x.id);
    const yi = Number(y.id);
    if (Number.isFinite(xi) && Number.isFinite(yi)) return yi - xi;
    return String(y.createdAt).localeCompare(String(x.createdAt));
  });
}

export type SOSLogItem = {
  id: string;
  timestamp: string;
  lat: number;
  lng: number;
  status: 'ACTIVE' | 'RESOLVED';
  contactsNotified: string[];
};

export type AIChatMessage = {
  id: string;
  sender: 'user' | 'grok';
  text: string;
  timestamp: string;
};

async function safeGet<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (err) {
    console.warn(`DB read failed for ${key}:`, err);
    return fallback;
  }
}

async function safeSet(key: string, value: unknown): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.warn(`DB write failed for ${key}:`, err);
  }
}

export class DatabaseEngine {
  // Session
  static async getActivePhone(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(ACTIVE_PHONE_KEY);
    } catch {
      return null;
    }
  }

  static async setActivePhone(phone: string): Promise<void> {
    try {
      await AsyncStorage.setItem(ACTIVE_PHONE_KEY, normalisePhone(phone));
    } catch (err) {
      console.warn('DB Error setting active phone:', err);
    }
  }

  static async clearActivePhone(): Promise<void> {
    try {
      await AsyncStorage.removeItem(ACTIVE_PHONE_KEY);
    } catch (err) {
      console.warn('DB Error clearing active phone:', err);
    }
  }

  // Profiles
  static async saveProfile(profile: UserProfile): Promise<void> {
    try {
      await safeSet(getKey('profile', profile.phone), profile);
      if (profile.phone) await this.setActivePhone(profile.phone);
      if (profile.role === 'pro') await this.saveRegisteredPro(profile as ProProfile);
    } catch (err) {
      console.warn('DB Error saving profile:', err);
    }
  }

  static async loadProfile(phone?: string): Promise<UserProfile | null> {
    try {
      const p = phone || (await this.getActivePhone()) || undefined;
      if (!p) return null;
      return await safeGet<UserProfile | null>(getKey('profile', p), null);
    } catch (err) {
      console.warn('DB Error loading profile:', err);
      return null;
    }
  }

  // Pro directory — used to enrich matching with real, opted-in pros.
  static async saveRegisteredPro(pro: ProProfile): Promise<void> {
    try {
      const list = await safeGet<ProProfile[]>(PROS_KEY, []);
      const updated = list.filter(p => normalisePhone(p.phone) !== normalisePhone(pro.phone));
      updated.push(pro);
      await safeSet(PROS_KEY, updated);

      const base = apiBase();
      if (!base) return;
      fetchWithTimeout(`${base}/api/pros`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(pro)
      }).catch(() => {});
    } catch (err) {
      console.warn('DB Error saving registered pro:', err);
    }
  }

  static async loadRegisteredPros(): Promise<ProProfile[]> {
    const local = await safeGet<ProProfile[]>(PROS_KEY, []);
    const base = apiBase();
    if (!base) return local;

    try {
      const res = await fetchWithTimeout(`${base}/api/pros`, {}, 3000);
      if (!res.ok) return local;
      const payload = await res.json();
      const remote: ProProfile[] = Array.isArray(payload) ? payload : (payload?.data ?? []);
      if (!Array.isArray(remote) || !remote.length) return local;

      const byPhone = new Map<string, ProProfile>();
      for (const pro of local) byPhone.set(normalisePhone(pro.phone), pro);
      for (const pro of remote) {
        if (pro?.phone) byPhone.set(normalisePhone(pro.phone), pro);
      }
      const merged = [...byPhone.values()];
      await safeSet(PROS_KEY, merged);
      return merged;
    } catch {
      return local;
    }
  }

  /**
   * The marketplace pool. Writes merge rather than replace, and reads normalise
   * legacy stage names so an older record cannot walk the state machine
   * backwards.
   */
  static async saveJobs(jobs: ServiceJob[]): Promise<void> {
    try {
      const existing = await safeGet<ServiceJob[]>(JOBS_KEY, []);
      const merged = mergeJobs(existing, jobs);
      await safeSet(JOBS_KEY, merged);

      const base = apiBase();
      if (!base) return;
      fetchWithTimeout(`${base}/api/jobs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobs)
      }).catch(() => {});
    } catch (err) {
      console.warn('DB Error saving marketplace jobs:', err);
    }
  }

  static async loadJobs(): Promise<ServiceJob[]> {
    const local = await safeGet<ServiceJob[]>(JOBS_KEY, []);
    const base = apiBase();
    if (!base) return local;

    try {
      const res = await fetchWithTimeout(`${base}/api/jobs`, {}, 3000);
      if (!res.ok) return local;
      const payload = await res.json();
      const remote: ServiceJob[] = Array.isArray(payload) ? payload : (payload?.data ?? []);
      if (!Array.isArray(remote) || !remote.length) return local;

      const merged = mergeJobs(local, remote);
      await safeSet(JOBS_KEY, merged);
      return merged;
    } catch {
      return local;
    }
  }

  static async loadJob(id: string): Promise<ServiceJob | null> {
    const jobs = await this.loadJobs();
    return jobs.find(j => j.id === id) ?? null;
  }

  // Events (evidence timelines), scoped to the signed-in phone
  static async saveEvents(events: RealityEvent[], phone?: string): Promise<void> {
    try {
      const p = phone || (await this.getActivePhone()) || undefined;
      await safeSet(getKey('events', p), events);
    } catch (err) {
      console.warn('DB Error saving events:', err);
    }
  }

  static async loadEvents(phone?: string): Promise<RealityEvent[]> {
    try {
      const p = phone || (await this.getActivePhone()) || undefined;
      return await safeGet<RealityEvent[]>(getKey('events', p), []);
    } catch (err) {
      console.warn('DB Error loading events:', err);
      return [];
    }
  }

  // SOS logs
  static async saveSOSLog(log: SOSLogItem, phone?: string): Promise<void> {
    try {
      const p = phone || (await this.getActivePhone()) || undefined;
      const key = getKey('sos', p);
      const list = await safeGet<SOSLogItem[]>(key, []);
      list.unshift(log);
      await safeSet(key, list.slice(0, 50));
    } catch (err) {
      console.warn('DB Error saving SOS log:', err);
    }
  }

  static async loadSOSLogs(phone?: string): Promise<SOSLogItem[]> {
    const p = phone || (await this.getActivePhone()) || undefined;
    return safeGet<SOSLogItem[]>(getKey('sos', p), []);
  }

  // AI chat transcript
  static async saveAIChat(messages: AIChatMessage[], phone?: string): Promise<void> {
    const p = phone || (await this.getActivePhone()) || undefined;
    await safeSet(getKey('ai_chat', p), messages.slice(-100));
  }

  static async loadAIChat(phone?: string): Promise<AIChatMessage[]> {
    const p = phone || (await this.getActivePhone()) || undefined;
    return safeGet<AIChatMessage[]>(getKey('ai_chat', p), []);
  }

  /**
   * Ends the session for one user. Deliberately leaves the shared job pool and
   * the pro directory intact — logging out must not delete other people's data.
   */
  static async clearAllData(phone?: string): Promise<void> {
    try {
      const p = phone || (await this.getActivePhone()) || undefined;
      if (p) {
        await AsyncStorage.multiRemove([
          getKey('profile', p),
          getKey('jobs', p),
          getKey('events', p),
          getKey('sos', p),
          getKey('ai_chat', p)
        ]);
      }
      await this.clearActivePhone();
    } catch (err) {
      console.warn('DB Error clearing data:', err);
    }
  }
}
