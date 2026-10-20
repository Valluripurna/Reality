import * as Location from 'expo-location';
import { Platform } from 'react-native';

/**
 * Location service.
 *
 * Accuracy rules (the old code broke all three):
 *  1. Never trust a cached fix blindly. A last-known position is used only if
 *     it is under 60 s old and already within the accuracy target.
 *  2. Ask for the highest accuracy, then keep listening for a few seconds:
 *     the first GPS fix is often 50–500 m off and tightens as satellites lock.
 *  3. Never silently substitute a fake city-centre point. Callers get `null`
 *     and decide what to show.
 */

export type Fix = { lat: number; lng: number; accuracy: number | null; timestamp: number };
export type Place = { short: string; full: string; city?: string; postalCode?: string };
export type LocateError = 'denied' | 'disabled' | 'unavailable' | 'timeout';
export type LocateResult = { ok: true; fix: Fix } | { ok: false; error: LocateError };

/** Map fallback only — never presented to the user as their location. */
export const DEFAULT_COORDS = { lat: 12.9716, lng: 77.5946 };

const isWeb = Platform.OS === 'web';

export function distanceKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const r = Math.PI / 180;
  const h = Math.sin(((b.lat - a.lat) * r) / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(((b.lng - a.lng) * r) / 2) ** 2;
  return 6371 * 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
}

/** Rough door-to-door travel time in a city. */
export function etaMinutes(km: number) {
  return Math.max(3, Math.round(km * 3.2 + 4));
}

export function describeAccuracy(m: number | null | undefined) {
  if (m == null) return 'Accuracy unknown';
  if (m <= 20) return `Accurate to ${Math.round(m)} m`;
  if (m <= 100) return `Within ~${Math.round(m)} m`;
  return `Approximate (±${m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`})`;
}

export function locateErrorText(e: LocateError) {
  switch (e) {
    case 'denied': return 'Location permission is off. Allow it in your phone settings to use your current location.';
    case 'disabled': return 'Location services are turned off. Turn on GPS/Location and try again.';
    case 'timeout': return "Couldn't get a GPS fix. Move near a window or outdoors and try again.";
    default: return "Location isn't available on this device.";
  }
}

export async function ensurePermission(): Promise<LocateError | null> {
  try {
    if (isWeb && !(typeof navigator !== 'undefined' && 'geolocation' in navigator)) return 'unavailable';
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return 'denied';
    if (!isWeb) {
      const enabled = await Location.hasServicesEnabledAsync();
      if (!enabled) return 'disabled';
      // Android: prompt to switch on high-accuracy mode (GPS + Wi-Fi + cell).
      if (Platform.OS === 'android') await Location.enableNetworkProviderAsync().catch(() => {});
    }
    return null;
  } catch {
    return 'unavailable';
  }
}

function toFix(c: { latitude: number; longitude: number; accuracy?: number | null }, t?: number): Fix {
  return { lat: c.latitude, lng: c.longitude, accuracy: c.accuracy ?? null, timestamp: t ?? Date.now() };
}

/** Subscribe to position updates. Returns an unsubscribe function. */
export async function watchLocation(
  onFix: (fix: Fix) => void,
  opts: { distanceInterval?: number; timeInterval?: number } = {}
): Promise<() => void> {
  if (isWeb) {
    const id = navigator.geolocation.watchPosition(
      p => onFix(toFix(p.coords, p.timestamp)),
      () => {},
      { enableHighAccuracy: true, maximumAge: 0, timeout: 20000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }
  const sub = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.BestForNavigation,
      distanceInterval: opts.distanceInterval ?? 10,
      timeInterval: opts.timeInterval ?? 5000,
      mayShowUserSettingsDialog: true
    },
    p => onFix(toFix(p.coords, p.timestamp))
  );
  return () => sub.remove();
}

/**
 * Best current position. Resolves as soon as a fix within `targetAccuracy`
 * metres arrives, or after `maxWaitMs` with the best fix seen so far.
 */
export async function getAccurateLocation(opts: { targetAccuracy?: number; maxWaitMs?: number } = {}): Promise<LocateResult> {
  const target = opts.targetAccuracy ?? 25;
  const maxWait = opts.maxWaitMs ?? 12000;

  const err = await ensurePermission();
  if (err) return { ok: false, error: err };

  // A very fresh, already-precise cached fix is fine to use immediately.
  if (!isWeb) {
    const last = await Location.getLastKnownPositionAsync({ maxAge: 60000, requiredAccuracy: target }).catch(() => null);
    if (last) return { ok: true, fix: toFix(last.coords, last.timestamp) };
  }

  // Browsers return the best fix they can get from a single request, and some
  // (including the Playwright/Chromium mock) starve a second watcher while the
  // provider's live watch is running. Adding one here made the locate button
  // time out, so on web we simply await the one-shot request.
  if (isWeb) {
    return new Promise<LocateResult>(resolve => {
      const timer = setTimeout(() => resolve({ ok: false, error: 'timeout' }), maxWait);
      navigator.geolocation.getCurrentPosition(
        p => { clearTimeout(timer); resolve({ ok: true, fix: toFix(p.coords, p.timestamp) }); },
        () => { clearTimeout(timer); resolve({ ok: false, error: 'timeout' }); },
        { enableHighAccuracy: true, maximumAge: 0, timeout: maxWait }
      );
    });
  }

  // Native: request one fix and keep watching in parallel until we hit the
  // accuracy target (GPS often sharpens over the first few seconds).
  return new Promise<LocateResult>(resolve => {
    let best: Fix | null = null;
    let done = false;
    let stop: (() => void) | null = null;

    const finish = () => {
      if (done) return;
      done = true;
      stop?.();
      clearTimeout(timer);
      resolve(best ? { ok: true, fix: best } : { ok: false, error: 'timeout' });
    };
    const consider = (fix: Fix) => {
      if (!best || (fix.accuracy ?? Infinity) < (best.accuracy ?? Infinity)) best = fix;
      if ((fix.accuracy ?? Infinity) <= target) finish();
    };
    const timer = setTimeout(finish, maxWait);

    Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Highest, mayShowUserSettingsDialog: true })
      .then(p => consider(toFix(p.coords, p.timestamp)))
      .catch(() => {});
    watchLocation(consider, { distanceInterval: 0, timeInterval: 1000 })
      .then(unsub => { if (done) unsub(); else stop = unsub; })
      .catch(() => {});
  });
}

/* ------------------------------------------------------------------ geocoding */

type NominatimAddress = Record<string, string | undefined>;

function fromNominatim(a: NominatimAddress, display?: string): Place {
  const area = a.suburb || a.neighbourhood || a.quarter || a.city_district || a.residential || a.village || a.town;
  const city = a.city || a.town || a.state_district || a.county || a.state;
  const line1 = [a.house_number, a.road].filter(Boolean).join(' ') || a.building || a.amenity;
  const full = [line1, area, city, a.postcode].filter(Boolean).join(', ') || display || '';
  return { short: area || city || line1 || 'Current location', full, city, postalCode: a.postcode };
}

async function nominatim(path: string): Promise<any> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/${path}`, {
      headers: { Accept: 'application/json', 'Accept-Language': 'en' },
      signal: controller.signal
    });
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(t);
  }
}

/** Coordinates → human address. Device geocoder first, OpenStreetMap as fallback (and on web). */
export async function reverseGeocode(lat: number, lng: number): Promise<Place | null> {
  if (!isWeb) {
    try {
      const [r] = await Location.reverseGeocodeAsync({ latitude: lat, longitude: lng });
      if (r) {
        const area = r.district || r.subregion || r.city || r.name || undefined;
        const line1 = [r.streetNumber, r.street].filter(Boolean).join(' ') || (r.name && r.name !== area ? r.name : '');
        const full = [line1, area !== r.city ? area : null, r.city, r.postalCode].filter(Boolean).join(', ');
        if (full) return { short: area || r.city || 'Current location', full, city: r.city ?? undefined, postalCode: r.postalCode ?? undefined };
      }
    } catch { /* fall through to OSM */ }
  }
  const data = await nominatim(`reverse?format=jsonv2&zoom=18&addressdetails=1&lat=${lat}&lon=${lng}`);
  return data?.address ? fromNominatim(data.address, data.display_name) : null;
}

/** Typed address → coordinates. */
export async function geocodeAddress(text: string): Promise<(Place & { lat: number; lng: number }) | null> {
  const q = text.trim();
  if (q.length < 3) return null;
  if (!isWeb) {
    try {
      const [r] = await Location.geocodeAsync(q);
      if (r) {
        const place = await reverseGeocode(r.latitude, r.longitude);
        return { lat: r.latitude, lng: r.longitude, short: place?.short ?? q.split(',')[0], full: q };
      }
    } catch { /* fall through */ }
  }
  const data = await nominatim(`search?format=jsonv2&addressdetails=1&limit=1&countrycodes=in&q=${encodeURIComponent(q)}`);
  const hit = Array.isArray(data) ? data[0] : null;
  if (!hit) return null;
  const place = fromNominatim(hit.address ?? {}, hit.display_name);
  return { lat: Number(hit.lat), lng: Number(hit.lon), short: place.short, full: q };
}

/** One call for "where am I, in words". */
export async function locateWithAddress(): Promise<{ ok: true; fix: Fix; place: Place | null } | { ok: false; error: LocateError }> {
  const res = await getAccurateLocation();
  if (!res.ok) return res;
  const place = await reverseGeocode(res.fix.lat, res.fix.lng);
  return { ok: true, fix: res.fix, place };
}
