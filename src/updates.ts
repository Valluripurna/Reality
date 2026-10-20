import { useCallback, useEffect, useRef, useState } from 'react';
import { Platform } from 'react-native';

/**
 * OTA (EAS Update) bridge.
 *
 * Updates are enabled in app.json, checked automatically on launch, and this
 * module can also fetch + apply one immediately. Everything is lazy and
 * guarded so web and Jest never touch the native module. On a fresh install
 * (including delete + reinstall) the first launch checks, downloads and
 * reloads into the newest bundle on its own.
 */
type UpdatesApi = {
  isEnabled: boolean;
  updateId?: string | null;
  createdAt?: Date | null;
  channel?: string | null;
  runtimeVersion?: string | null;
  isEmbeddedLaunch?: boolean;
  checkForUpdateAsync: () => Promise<{ isAvailable: boolean; manifest?: unknown }>;
  fetchUpdateAsync: () => Promise<{ isNew: boolean }>;
  reloadAsync: () => Promise<void>;
};

let cached: UpdatesApi | null | undefined;

export function updatesApi(): UpdatesApi | null {
  if (Platform.OS === 'web') return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('expo-updates') as UpdatesApi;
  } catch {
    cached = null;
  }
  return cached;
}

export type OtaPhase = 'unsupported' | 'idle' | 'checking' | 'downloading' | 'ready' | 'current' | 'error';

export type OtaResult = { phase: OtaPhase; message: string };

/** Check, download and apply an update immediately (reloads the JS bundle). */
export async function checkAndApplyUpdate(): Promise<OtaResult> {
  const U = updatesApi();
  if (!U || !U.isEnabled) {
    return { phase: 'unsupported', message: 'Updates are available in installed builds only.' };
  }
  try {
    const check = await U.checkForUpdateAsync();
    if (!check.isAvailable) return { phase: 'current', message: "You're on the latest version." };
    const fetched = await U.fetchUpdateAsync();
    if (!fetched.isNew) return { phase: 'current', message: "You're on the latest version." };
    // Never resolves: the app restarts on the new bundle.
    await U.reloadAsync();
    return { phase: 'ready', message: 'Update applied — restarting…' };
  } catch (err) {
    return { phase: 'error', message: err instanceof Error ? err.message : "Couldn't check for updates." };
  }
}

let autoAttempted = false;

/** Called once on app start: silently installs a pending OTA before the user works. */
export async function autoApplyUpdate(): Promise<OtaResult | null> {
  if (Platform.OS === 'web' || autoAttempted) return null;
  autoAttempted = true;
  return checkAndApplyUpdate();
}

export function updateSummary() {
  const U = updatesApi();
  if (!U || !U.isEnabled) {
    return { enabled: false, updateId: null, createdAt: null, channel: null, runtimeVersion: null, embedded: false };
  }
  return {
    enabled: true,
    updateId: U.updateId ?? null,
    createdAt: U.createdAt ?? null,
    channel: U.channel ?? null,
    runtimeVersion: U.runtimeVersion ?? null,
    embedded: !!U.isEmbeddedLaunch
  };
}

/** Short, human-friendly form of an EAS update id (ids are UUIDs). */
export function shortUpdateId(id?: string | null) {
  if (!id) return 'embedded';
  return id.replace(/-/g, '').slice(0, 8);
}

/** Profile/About UI status: current phase, message and a manual check button. */
export function useOtaStatus() {
  const [phase, setPhase] = useState<OtaPhase>('idle');
  const [message, setMessage] = useState('');
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const check = useCallback(async () => {
    setPhase('checking');
    setMessage('Checking for updates…');
    const res = await checkAndApplyUpdate();
    if (!mounted.current) return res;
    setPhase(res.phase);
    setMessage(res.message);
    return res;
  }, []);

  return { phase, message, check, info: updateSummary() };
}
