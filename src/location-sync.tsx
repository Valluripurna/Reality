import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { distanceKm, Fix, getAccurateLocation, LocateError, Place, reverseGeocode, watchLocation } from './location';
import { useMarketplace } from './marketplace';

type Status = { state: 'idle' | 'locating' | 'ok' | 'error'; error?: LocateError };
export type LocateRefresh = { error: LocateError | null; fix?: Fix; place?: Place | null };
type Ctx = Status & { refresh: (mode?: 'auto' | 'explicit') => Promise<LocateRefresh> };

const LocationCtx = createContext<Ctx>({ state: 'idle', refresh: async () => ({ error: 'unavailable' }) });
export const useLocationStatus = () => useContext(LocationCtx);

/** Movement before we write a new position, and how often we re-geocode. */
const RULES = {
  customer: { moveKm: 0.1, watchMeters: 50, geocodeKm: 0.25 },
  pro: { moveKm: 0.02, watchMeters: 15, geocodeKm: 0.5 }
};

/**
 * Keeps the signed-in user's position fresh, for customers and pros alike:
 *  - an accurate fix (plus street address) on sign-in, app open and resume;
 *  - a live watch afterwards. Pros who are online with GPS sharing on are
 *    tracked tightly, because customers follow them on the job map.
 *
 * There is only ever ONE GPS consumer at a time: refreshing pauses the live
 * watch first. On web a second watcher/request alongside an active one can be
 * starved (the locate button used to time out because of exactly that).
 * Addresses the user typed by hand are never overwritten (see applyLocation).
 */
export function LocationProvider({ children }: { children: ReactNode }) {
  const { profile, ready, applyLocation } = useMarketplace();
  const [status, setStatus] = useState<Status>({ state: 'idle' });

  const role = profile?.role;
  const phone = profile?.phone;
  const tracking = !!profile && (role === 'customer' || (role === 'pro' && profile.isOnline && profile.gpsEnabled !== false));

  // Latest values for callbacks fired by the watcher.
  const applyRef = useRef(applyLocation);
  applyRef.current = applyLocation;
  const last = useRef<{ fix: Fix; geocodedAt?: { lat: number; lng: number } } | null>(null);
  const watcher = useRef<(() => void) | null>(null);
  const trackingRef = useRef(tracking);
  trackingRef.current = tracking;

  const commit = useCallback(async (fix: Fix, force: boolean, mode: 'auto' | 'explicit'): Promise<Place | null> => {
    const rules = role === 'pro' ? RULES.pro : RULES.customer;
    const prev = last.current;
    const moved = prev ? distanceKm(prev.fix, fix) : Infinity;
    const better = prev && fix.accuracy != null && prev.fix.accuracy != null && fix.accuracy < prev.fix.accuracy * 0.6;
    if (!force && moved < rules.moveKm && !better) return null;

    let place: Place | null = null;
    const geoFrom = prev?.geocodedAt;
    if (force || !geoFrom || distanceKm(geoFrom, fix) >= rules.geocodeKm) {
      place = await reverseGeocode(fix.lat, fix.lng);
    }
    last.current = { fix, geocodedAt: place ? { lat: fix.lat, lng: fix.lng } : geoFrom };
    applyRef.current(fix, place, mode);
    return place;
  }, [role]);

  const stopWatch = useCallback(() => {
    watcher.current?.();
    watcher.current = null;
  }, []);

  const startWatch = useCallback(() => {
    if (!trackingRef.current || watcher.current) return;
    const rules = role === 'pro' ? RULES.pro : RULES.customer;
    watchLocation(fix => { commit(fix, false, 'auto'); }, { distanceInterval: rules.watchMeters, timeInterval: role === 'pro' ? 10000 : 30000 })
      .then(unsub => {
        if (!trackingRef.current || watcher.current) unsub();
        else watcher.current = unsub;
      })
      .catch(() => {});
  }, [role, commit]);

  /**
   * Fetch a fresh accurate fix. 'explicit' (the locate button) may replace an
   * address the user typed; 'auto' (sign-in, resume, watch) never does.
   */
  const refresh = useCallback(async (mode: 'auto' | 'explicit' = 'auto'): Promise<LocateRefresh> => {
    setStatus({ state: 'locating' });
    stopWatch();
    try {
      const res = await getAccurateLocation();
      if (!res.ok) {
        setStatus({ state: 'error', error: res.error });
        return { error: res.error };
      }
      const place = await commit(res.fix, true, mode);
      setStatus({ state: 'ok' });
      return { error: null, fix: res.fix, place };
    } finally {
      startWatch();
    }
  }, [commit, startWatch, stopWatch]);

  // Fresh fix whenever someone signs in (or the app starts signed in).
  useEffect(() => {
    if (!ready || !phone) return;
    last.current = null;
    refresh('auto');
  }, [ready, phone, refresh]);

  // ...and when the app comes back to the foreground.
  useEffect(() => {
    if (!phone) return;
    const sub = AppState.addEventListener('change', s => { if (s === 'active') refresh('auto'); });
    return () => sub.remove();
  }, [phone, refresh]);

  // Live watch.
  useEffect(() => {
    if (!ready || !phone || !tracking) return;
    startWatch();
    return stopWatch;
  }, [ready, phone, tracking, startWatch, stopWatch]);

  useEffect(() => () => stopWatch(), [stopWatch]);

  const value = useMemo(() => ({ ...status, refresh }), [status, refresh]);
  return <LocationCtx.Provider value={value}>{children}</LocationCtx.Provider>;
}
