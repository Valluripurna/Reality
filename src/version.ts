import Constants from 'expo-constants';
import * as Application from 'expo-application';
import { updateSummary } from './updates';

export type VersionInfo = {
  /** Human-facing version name, e.g. "1.0.0" (app.json `version`). */
  versionName: string;
  /** Store build number: Android versionCode / iOS buildNumber. */
  versionCode: string;
  /** Runtime version that decides which OTA bundles a build can receive. */
  runtimeVersion: string;
  channel: string | null;
  updateId: string | null;
  updateCreatedAt: Date | null;
  embedded: boolean;
};

function safe(fn: () => string | null | undefined, fallback: string) {
  try {
    return fn() || fallback;
  } catch {
    return fallback;
  }
}

export function getVersionInfo(): VersionInfo {
  const cfg = Constants.expoConfig;
  const nativeVersion = safe(() => Application.nativeApplicationVersion, '');
  const nativeBuild = safe(() => Application.nativeBuildVersion, '');
  const ota = updateSummary();
  return {
    versionName: nativeVersion || cfg?.version || '1.0.0',
    versionCode: nativeBuild || String(cfg?.android?.versionCode ?? cfg?.ios?.buildNumber ?? '1'),
    runtimeVersion:
      ota.runtimeVersion ||
      (typeof cfg?.runtimeVersion === 'string' ? cfg.runtimeVersion : cfg?.version) ||
      '1.0.0',
    channel: ota.channel,
    updateId: ota.updateId,
    updateCreatedAt: ota.createdAt,
    embedded: ota.embedded
  };
}

/** "v1.0.0 (1)" — version name plus version code / build number. */
export function versionLabel(info = getVersionInfo()) {
  return `v${info.versionName} (${info.versionCode})`;
}

/** One-line summary of the JS bundle currently running. */
export function updateLabel(info = getVersionInfo()) {
  if (!info.updateId) return 'Built-in bundle';
  const when = info.updateCreatedAt
    ? new Date(info.updateCreatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
    : null;
  const id = info.updateId.replace(/-/g, '').slice(0, 8);
  return `OTA ${id}${when ? ` · ${when}` : ''}`;
}
