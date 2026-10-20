import AsyncStorage from '@react-native-async-storage/async-storage';
import { useEffect, useState } from 'react';
import { apiBase } from './db';

/**
 * Remote config: content the installed apps can refresh without a store build
 * or even an OTA. The same defaults ship inside the JS bundle (so a first run
 * with no network still looks right), and `/api/config` can override them.
 *
 * Banners are the first consumer, but the shape is intentionally generic so
 * more surfaces can be added without another store release.
 */
export type BannerAudience = 'customer' | 'pro' | 'bookings' | 'records';
export type BannerTone = 'brand' | 'cream' | 'dark' | 'amber';
export type BannerAction = { type: 'route'; href: string } | { type: 'url'; url: string } | { type: 'assistant' };

export type BannerConfig = {
  id: string;
  enabled: boolean;
  audience: BannerAudience;
  title: string;
  body?: string;
  cta?: string;
  icon?: string;
  tone?: BannerTone;
  action?: BannerAction;
  startsAt?: string;
  endsAt?: string;
  dismissible?: boolean;
};

export type RemoteConfig = {
  version: number;
  updatedAt?: string;
  banners: BannerConfig[];
};

const CACHE_KEY = 'rc_remote_config_v1';
// v2: dismissals expire after a day, so a hidden announcement comes back.
const DISMISS_KEY = 'rc_banner_dismissed_v2';
const DISMISS_TTL = 24 * 60 * 60 * 1000;

type DismissedEntry = { id: string; at: number };

export const DEFAULT_CONFIG: RemoteConfig = {
  version: 6,
  banners: [
    {
      id: 'customer-greeting-v2',
      enabled: true,
      audience: 'customer',
      title: 'Hi {{name}}, what do you need help with?',
      body: 'Describe the job. Compare fair quotes.',
      cta: 'Ask the assistant',
      icon: 'chatbubbles-outline',
      tone: 'brand',
      action: { type: 'assistant' },
      dismissible: false
    },
    {
      id: 'pro-greeting-v2',
      enabled: true,
      audience: 'pro',
      title: 'Hi {{name}}, ready for your next job?',
      body: 'Go online to see nearby jobs that fit your skills.',
      cta: 'Update services',
      icon: 'briefcase-outline',
      tone: 'cream',
      action: { type: 'route', href: '/profile' },
      dismissible: false
    },
    {
      id: 'bookings-overview-v2',
      enabled: true,
      audience: 'bookings',
      title: 'All your bookings',
      body: 'Active jobs and past visits, in one place.',
      icon: 'calendar-outline',
      tone: 'amber',
      dismissible: false
    },
    {
      id: 'records-overview-v1',
      enabled: true,
      audience: 'records',
      title: 'Every job, on the record',
      body: 'Quotes, photos and payments stay saved for later.',
      icon: 'document-text-outline',
      tone: 'dark',
      dismissible: false
    }
  ]
};

const MAX_BANNERS = 12;
const MAX_TEXT = 180;
const AUDIENCES: BannerAudience[] = ['customer', 'pro', 'bookings', 'records'];

function text(value: unknown, max = MAX_TEXT): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim().slice(0, max) : undefined;
}

function parseAction(value: unknown): BannerAction | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const a = value as Record<string, unknown>;
  if (a.type === 'route' && typeof a.href === 'string' && a.href.startsWith('/') && !a.href.startsWith('//')) {
    return { type: 'route', href: a.href.slice(0, 200) };
  }
  // Only open real web links; remote content must not be able to run JS or
  // hand other schemes to the OS.
  if (a.type === 'url' && typeof a.url === 'string' && /^https?:\/\//i.test(a.url.trim())) {
    return { type: 'url', url: a.url.trim().slice(0, 500) };
  }
  if (a.type === 'assistant') return { type: 'assistant' };
  return undefined;
}

function parseBanner(value: unknown): BannerConfig | null {
  if (!value || typeof value !== 'object') return null;
  const b = value as Record<string, unknown>;
  const id = text(b.id, 60);
  const title = text(b.title);
  if (!id || !title) return null;
  if (!AUDIENCES.includes(b.audience as BannerAudience)) return null;
  const tone = b.tone === 'dark' || b.tone === 'amber' || b.tone === 'cream' || b.tone === 'brand' ? b.tone : 'brand';
  return {
    id,
    enabled: b.enabled !== false,
    audience: b.audience as BannerAudience,
    title,
    body: text(b.body, 300),
    cta: text(b.cta, 40),
    icon: text(b.icon, 40),
    tone,
    action: parseAction(b.action),
    startsAt: text(b.startsAt, 40),
    endsAt: text(b.endsAt, 40),
    dismissible: b.dismissible !== false
  };
}

/** Validates untrusted JSON (server or cache) before it reaches the UI. */
export function normaliseRemoteConfig(raw: unknown): RemoteConfig | null {
  if (!raw || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.banners)) return null;
  const banners = obj.banners
    .slice(0, MAX_BANNERS)
    .map(parseBanner)
    .filter((b): b is BannerConfig => b !== null);
  return {
    version: typeof obj.version === 'number' && Number.isFinite(obj.version) ? obj.version : 1,
    updatedAt: text(obj.updatedAt, 40),
    banners
  };
}

/** Pure: is this banner meant for this role, enabled and inside its window? */
export function isBannerActive(banner: BannerConfig, role: BannerAudience, now = Date.now()) {
  if (!banner.enabled || banner.audience !== role) return false;
  const start = banner.startsAt ? Date.parse(banner.startsAt) : NaN;
  const end = banner.endsAt ? Date.parse(banner.endsAt) : NaN;
  if (Number.isFinite(start) && start > now) return false;
  if (Number.isFinite(end) && end < now) return false;
  return true;
}

export function pickBanner(config: RemoteConfig, role: BannerAudience, now = Date.now()) {
  return config.banners.find(b => isBannerActive(b, role, now)) ?? null;
}

let memo: RemoteConfig = DEFAULT_CONFIG;
let loading: Promise<RemoteConfig> | null = null;

async function readDismissedEntries(): Promise<DismissedEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(parsed)) return [];
    const now = Date.now();
    return parsed
      .map(value => {
        if (typeof value === 'string') return { id: value, at: now };
        if (value && typeof value.id === 'string' && Number.isFinite(value.at)) {
          return { id: value.id, at: value.at as number };
        }
        return null;
      })
      .filter((entry): entry is DismissedEntry => !!entry && now - entry.at < DISMISS_TTL);
  } catch {
    return [];
  }
}

async function readDismissed(): Promise<string[]> {
  return (await readDismissedEntries()).map(entry => entry.id);
}

export async function dismissBanner(id: string): Promise<void> {
  try {
    const entries = (await readDismissedEntries()).filter(entry => entry.id !== id);
    entries.push({ id, at: Date.now() });
    await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify(entries.slice(-40)));
  } catch {
    // Dismissing is best-effort; the banner can reappear next launch.
  }
}

export async function isBannerDismissed(id: string): Promise<boolean> {
  return (await readDismissed()).includes(id);
}

export async function dismissedBannerIds(): Promise<string[]> {
  return readDismissed();
}

async function fetchRemoteConfig(): Promise<RemoteConfig | null> {
  const base = apiBase();
  if (!base) return null;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3500);
    const res = await fetch(`${base}/api/config`, { signal: controller.signal }).finally(() => clearTimeout(timer));
    if (!res.ok) return null;
    const json = await res.json();
    return normaliseRemoteConfig(json && json.config);
  } catch {
    return null;
  }
}

/** Loads cache first, then refreshes from the server. Never throws. */
export async function loadRemoteConfig(): Promise<RemoteConfig> {
  if (loading) return loading;
  loading = (async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      const cached = raw ? normaliseRemoteConfig(JSON.parse(raw)) : null;
      // A stale cache must not hide newer bundled defaults after an OTA.
      if (cached && cached.version >= DEFAULT_CONFIG.version) memo = cached;
      else memo = DEFAULT_CONFIG;
    } catch {}
    const remote = await fetchRemoteConfig();
    if (remote) {
      memo = remote;
      try { await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(remote)); } catch {}
    }
    return memo;
  })();
  return loading;
}

/** Config for a screen. Starts with bundled defaults, then cache, then server. */
export function useRemoteConfig() {
  const [config, setConfig] = useState<RemoteConfig>(memo);
  useEffect(() => {
    let alive = true;
    loadRemoteConfig().then(next => { if (alive) setConfig(next); });
    return () => { alive = false; };
  }, []);
  return config;
}
