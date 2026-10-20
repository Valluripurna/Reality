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
export type BannerAudience = 'customer' | 'pro';
export type BannerTone = 'brand' | 'dark' | 'amber';
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
const DISMISS_KEY = 'rc_banner_dismissed_v1';

export const DEFAULT_CONFIG: RemoteConfig = {
  version: 1,
  banners: [
    {
      id: 'customer-spring-check',
      enabled: true,
      audience: 'customer',
      title: '{{name}}, not sure what the job should cost?',
      body: 'Describe the problem and get likely causes plus a fair range before you book. You and your pro agree the price.',
      cta: 'Ask the assistant',
      icon: 'chatbubbles-outline',
      tone: 'brand',
      action: { type: 'assistant' },
      dismissible: true
    },
    {
      id: 'pro-more-jobs',
      enabled: true,
      audience: 'pro',
      title: '{{name}}, more jobs near you',
      body: 'Add the services you offer and go online — matching requests appear first in your feed.',
      cta: 'Update services',
      icon: 'briefcase-outline',
      tone: 'brand',
      action: { type: 'route', href: '/profile' },
      dismissible: true
    }
  ]
};

const MAX_BANNERS = 12;
const MAX_TEXT = 180;

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
  if (b.audience !== 'customer' && b.audience !== 'pro') return null;
  const tone = b.tone === 'dark' || b.tone === 'amber' || b.tone === 'brand' ? b.tone : 'brand';
  return {
    id,
    enabled: b.enabled !== false,
    audience: b.audience,
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

async function readDismissed(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(DISMISS_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

export async function dismissBanner(id: string): Promise<void> {
  try {
    const list = await readDismissed();
    if (!list.includes(id)) await AsyncStorage.setItem(DISMISS_KEY, JSON.stringify([...list, id].slice(-40)));
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
      if (cached) memo = cached;
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
