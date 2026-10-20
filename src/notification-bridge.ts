import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { apiBase } from './db';
import { collectJobNotifications, notificationJobId, NotifyRole } from './notification-events';
import { ServiceJob } from './types';

/**
 * Notifications bridge.
 *
 * Local notifications work everywhere the native module exists, including
 * Expo Go (Android Expo Go cannot receive *remote* push, so we only register a
 * push token in a development/standalone build). Every native call is lazy and
 * guarded so web and Jest never load it.
 */

type NotificationsApi = typeof import('expo-notifications');
type StorageKeys = { seen: string; baseline: string };

let cached: NotificationsApi | null | undefined;
let prepared: boolean | null = null;
let allowed = false;
let lastRegistration = '';

const PROMPT_KEY = 'rc_notifications_prompted_v1';
const CHANNEL_ID = 'default';

function nativeNotifications(): NotificationsApi | null {
  if (Platform.OS === 'web') return null;
  if (cached !== undefined) return cached;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    cached = require('expo-notifications') as NotificationsApi;
  } catch {
    cached = null;
  }
  return cached;
}

function digits(phone?: string) {
  return (phone || '').replace(/\D/g, '').slice(-10);
}

export function notificationKeys(role: NotifyRole, phone: string): StorageKeys {
  const me = digits(phone) || 'guest';
  return {
    seen: `rc_notif_seen_v1_${role}_${me}`,
    baseline: `rc_notif_baseline_v1_${role}_${me}`
  };
}

/** True in Expo Go: local notifications still work, remote push tokens do not. */
export function isExpoGo() {
  const anyConstants = Constants as typeof Constants & { appOwnership?: string | null; easConfig?: { projectId?: string } };
  return anyConstants.executionEnvironment === 'storeClient' || anyConstants.appOwnership === 'expo';
}

export function canRegisterRemotePush() {
  return Platform.OS !== 'web' && !isExpoGo();
}

/** Configure the foreground handler/channel and ask once for permission. */
export async function prepareNotifications(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  if (prepared !== null) return allowed;
  const N = nativeNotifications();
  if (!N) {
    prepared = false;
    return false;
  }
  prepared = true;
  try {
    N.setNotificationHandler({
      handleNotification: async () => ({
        shouldShowBanner: true,
        shouldShowList: true,
        shouldPlaySound: true,
        shouldSetBadge: false
      })
    });
  } catch {}
  try {
    await N.setNotificationChannelAsync(CHANNEL_ID, {
      name: 'Job updates',
      description: 'Quotes, arrival, work progress and payments',
      importance: N.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0E8A63',
      sound: 'default'
    });
  } catch {}
  try {
    const current = await N.getPermissionsAsync();
    allowed = !!current.granted;
    if (!allowed && current.canAskAgain) {
      const asked = await AsyncStorage.getItem(PROMPT_KEY).catch(() => null);
      if (!asked) {
        await AsyncStorage.setItem(PROMPT_KEY, '1').catch(() => {});
        const requested = await N.requestPermissionsAsync();
        allowed = !!requested.granted;
      }
    }
  } catch {
    allowed = false;
  }
  return allowed;
}

/**
 * Announces job updates for this account. The first run after sign-in seeds
 * the current jobs silently, so existing history never floods the tray.
 */
export async function syncJobNotifications(
  role: NotifyRole,
  phone: string,
  jobs: ServiceJob[],
  currentJobId?: string | null
): Promise<void> {
  if (Platform.OS === 'web' || !phone) return;
  const N = nativeNotifications();
  if (!N) return;
  const keys = notificationKeys(role, phone);
  const [rawSeen, baseline] = await Promise.all([
    AsyncStorage.getItem(keys.seen).catch(() => null),
    AsyncStorage.getItem(keys.baseline).catch(() => null)
  ]);
  let seen: string[] = [];
  try {
    const parsed = rawSeen ? JSON.parse(rawSeen) : [];
    if (Array.isArray(parsed)) seen = parsed.filter((x): x is string => typeof x === 'string');
  } catch {}

  const result = collectJobNotifications({ role, phone, jobs, seen, baseline: !baseline });
  const next = [...new Set([...seen, ...result.keys])].slice(-400);
  await AsyncStorage.multiSet([
    [keys.seen, JSON.stringify(next)],
    [keys.baseline, '1']
  ]).catch(() => {});

  if (!baseline) return;
  const granted = prepared === null ? await prepareNotifications() : allowed;
  if (!granted) return;

  for (const event of result.events) {
    if (currentJobId && event.jobId === currentJobId) continue;
    await N.scheduleNotificationAsync({
      content: {
        title: event.title,
        body: event.body,
        data: { jobId: event.jobId },
        sound: 'default'
      },
      trigger: null
    }).catch(() => {});
  }
}

/** Registers this device for server-sent push in a build (not Expo Go/web). */
export async function registerForPush(phone?: string, role?: NotifyRole): Promise<string | null> {
  if (!phone || !role || !canRegisterRemotePush()) return null;
  const base = apiBase();
  if (!base) return null;
  const granted = await prepareNotifications();
  if (!granted) return null;
  const projectId =
    (Constants.expoConfig?.extra as { eas?: { projectId?: string } } | undefined)?.eas?.projectId ??
    (Constants as typeof Constants & { easConfig?: { projectId?: string } }).easConfig?.projectId;
  if (!projectId) return null;
  const N = nativeNotifications();
  if (!N) return null;
  try {
    const token = (await N.getExpoPushTokenAsync({ projectId })).data;
    const cacheKey = `${role}:${digits(phone)}:${token}`;
    if (cacheKey === lastRegistration) return token;
    const res = await fetch(`${base}/api/push/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone, role, token })
    });
    if (res.ok) lastRegistration = cacheKey;
    return token;
  } catch {
    return null;
  }
}

/** Tapping a notification opens the matching job. Returns an unsubscribe fn. */
export function addNotificationResponseHandler(onJob: (jobId: string | null) => void): () => void {
  const N = nativeNotifications();
  if (!N) return () => {};
  let handledColdStart = false;
  const open = (data: unknown) => {
    const jobId = notificationJobId(data);
    if (jobId) onJob(jobId);
  };
  const sub = N.addNotificationResponseReceivedListener(response => {
    open(response.notification.request.content.data);
  });
  N.getLastNotificationResponseAsync()
    .then(response => {
      if (!response || handledColdStart) return;
      handledColdStart = true;
      open(response.notification.request.content.data);
    })
    .catch(() => {});
  return () => sub.remove();
}
