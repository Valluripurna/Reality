import AsyncStorage from '@react-native-async-storage/async-storage';
import { ProProfile, RealityEvent, ServiceJob, UserProfile } from './types';

const ACTIVE_PHONE_KEY = 'rc_active_phone_v6';

function getKey(type: 'profile' | 'jobs' | 'events' | 'sos' | 'ai_chat', phone?: string): string {
  const p = phone ? phone.replace(/[^0-9]/g, '') : 'guest';
  return `rc_user_${p}_${type}_v6`;
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

export class DatabaseEngine {
  // Session Phone Tracking
  static async getActivePhone(): Promise<string | null> {
    try {
      return await AsyncStorage.getItem(ACTIVE_PHONE_KEY);
    } catch {
      return null;
    }
  }

  static async setActivePhone(phone: string): Promise<void> {
    try {
      await AsyncStorage.setItem(ACTIVE_PHONE_KEY, phone);
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
      const key = getKey('profile', profile.phone);
      await AsyncStorage.setItem(key, JSON.stringify(profile));
      if (profile.phone) {
        await this.setActivePhone(profile.phone);
      }
      // If Service Pro, register in Global Pro Directory
      if (profile.role === 'pro') {
        await this.saveRegisteredPro(profile as ProProfile);
      }
    } catch (err) {
      console.warn('DB Error saving profile:', err);
    }
  }

  // Global Registered Service Pros Registry
  static async saveRegisteredPro(pro: ProProfile): Promise<void> {
    try {
      const raw = await AsyncStorage.getItem('rc_global_registered_pros_v6');
      const list: ProProfile[] = raw ? JSON.parse(raw) : [];
      const updated = list.filter(p => p.phone !== pro.phone);
      updated.push(pro);
      await AsyncStorage.setItem('rc_global_registered_pros_v6', JSON.stringify(updated));

      // Push to cross-device cloud relay
      fetch('https://api.restful-api.dev/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: 'rc_shared_pros_relay_v6',
          name: 'RealityChain Shared Pros Relay',
          data: { pros: updated }
        })
      }).catch(() => {});
    } catch (err) {
      console.warn('DB Error saving registered pro:', err);
    }
  }

  static async loadRegisteredPros(): Promise<ProProfile[]> {
    try {
      const raw = await AsyncStorage.getItem('rc_global_registered_pros_v6');
      let localPros: ProProfile[] = raw ? JSON.parse(raw) : [];

      try {
        const res = await fetch('https://api.restful-api.dev/objects/rc_shared_pros_relay_v6');
        if (res.ok) {
          const json = await res.json();
          if (json && json.data && json.data.pros && Array.isArray(json.data.pros) && json.data.pros.length > 0) {
            localPros = json.data.pros;
            await AsyncStorage.setItem('rc_global_registered_pros_v6', JSON.stringify(localPros));
          }
        }
      } catch {}

      return localPros;
    } catch (err) {
      console.warn('DB Error loading registered pros:', err);
      return [];
    }
  }

  static async loadProfile(phone?: string): Promise<UserProfile | null> {
    try {
      const p = phone || (await this.getActivePhone()) || undefined;
      if (!p) return null;
      const key = getKey('profile', p);
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : null;
    } catch (err) {
      console.warn('DB Error loading profile:', err);
      return null;
    }
  }

  // Shared Global Marketplace Jobs Pool (With Dynamic Ngrok & Cloud Relay)
  static async saveJobs(jobs: ServiceJob[]): Promise<void> {
    try {
      await AsyncStorage.setItem('rc_shared_marketplace_jobs_v6', JSON.stringify(jobs));

      const ngrokBase = process.env.EXPO_PUBLIC_API_URL;
      const targetUrl = ngrokBase && ngrokBase.startsWith('http')
        ? `${ngrokBase.replace(/\/$/, '')}/api/jobs`
        : 'https://kvdb.io/RealityChainV6/jobs';

      // Push to active ngrok backend or cloud KV store
      fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(jobs)
      }).catch(() => {});
    } catch (err) {
      console.warn('DB Error saving marketplace jobs:', err);
    }
  }

  static async loadJobs(): Promise<ServiceJob[]> {
    try {
      const raw = await AsyncStorage.getItem('rc_shared_marketplace_jobs_v6');
      let localJobs: ServiceJob[] = raw ? JSON.parse(raw) : [];

      const ngrokBase = process.env.EXPO_PUBLIC_API_URL;
      const targetUrl = ngrokBase && ngrokBase.startsWith('http')
        ? `${ngrokBase.replace(/\/$/, '')}/api/jobs`
        : 'https://kvdb.io/RealityChainV6/jobs';

      try {
        const res = await fetch(targetUrl, { signal: AbortSignal.timeout(2000) });
        if (res.ok) {
          const resData = await res.json();
          const json: ServiceJob[] = Array.isArray(resData) ? resData : (resData?.data ?? []);
          if (Array.isArray(json) && json.length > 0) {
            localJobs = json;
            await AsyncStorage.setItem('rc_shared_marketplace_jobs_v6', JSON.stringify(localJobs));
          }
        }
      } catch {}

      return localJobs;
    } catch (err) {
      console.warn('DB Error loading marketplace jobs:', err);
      return [];
    }
  }

  // Events
  static async saveEvents(events: RealityEvent[], phone?: string): Promise<void> {
    try {
      const p = phone || (await this.getActivePhone()) || undefined;
      const key = getKey('events', p);
      await AsyncStorage.setItem(key, JSON.stringify(events));
    } catch (err) {
      console.warn('DB Error saving events:', err);
    }
  }

  static async loadEvents(phone?: string): Promise<RealityEvent[]> {
    try {
      const p = phone || (await this.getActivePhone()) || undefined;
      const key = getKey('events', p);
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      console.warn('DB Error loading events:', err);
      return [];
    }
  }

  // SOS Logs
  static async saveSOSLog(log: SOSLogItem, phone?: string): Promise<void> {
    try {
      const p = phone || (await this.getActivePhone()) || undefined;
      const key = getKey('sos', p);
      const raw = await AsyncStorage.getItem(key);
      const list: SOSLogItem[] = raw ? JSON.parse(raw) : [];
      list.unshift(log);
      await AsyncStorage.setItem(key, JSON.stringify(list));
    } catch (err) {
      console.warn('DB Error saving SOS log:', err);
    }
  }

  static async loadSOSLogs(phone?: string): Promise<SOSLogItem[]> {
    try {
      const p = phone || (await this.getActivePhone()) || undefined;
      const key = getKey('sos', p);
      const raw = await AsyncStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (err) {
      return [];
    }
  }

  // Clear Session
  static async clearAllData(): Promise<void> {
    try {
      const p = await this.getActivePhone();
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
