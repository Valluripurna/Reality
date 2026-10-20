import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as Location from 'expo-location';
import { ReactNode } from 'react';
import { mergeJobs } from '../src/db';
import { getAccurateLocation, reverseGeocode } from '../src/location';
import { FREE_ACCEPTS, MarketplaceProvider, useMarketplace } from '../src/marketplace';
import { matchService } from '../src/matching';
import { EventProvider } from '../src/store/events';
import { ProProfile, ServiceJob } from '../src/types';

jest.mock('expo-location', () => {
  const listeners: ((p: any) => void)[] = [];
  return {
    Accuracy: { Balanced: 3, High: 4, Highest: 5, BestForNavigation: 6 },
    requestForegroundPermissionsAsync: jest.fn(async () => ({ status: 'granted' })),
    hasServicesEnabledAsync: jest.fn(async () => true),
    enableNetworkProviderAsync: jest.fn(async () => {}),
    getLastKnownPositionAsync: jest.fn(async () => null),
    getCurrentPositionAsync: jest.fn(),
    watchPositionAsync: jest.fn(async (_opts: any, cb: (p: any) => void) => {
      listeners.push(cb);
      return { remove: () => listeners.splice(listeners.indexOf(cb), 1) };
    }),
    reverseGeocodeAsync: jest.fn(),
    geocodeAsync: jest.fn(),
    __emit: (p: any) => listeners.slice().forEach(l => l(p))
  };
});

const L = Location as unknown as jest.Mocked<typeof Location> & { __emit: (p: any) => void };
const pos = (lat: number, lng: number, accuracy: number) => ({ coords: { latitude: lat, longitude: lng, accuracy }, timestamp: Date.now() });

beforeEach(() => {
  jest.clearAllMocks();
  L.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'granted' } as any);
  L.getLastKnownPositionAsync.mockResolvedValue(null);
});

describe('getAccurateLocation', () => {
  it('only accepts a cached fix that is fresh and precise', async () => {
    L.getCurrentPositionAsync.mockResolvedValue(pos(19.07, 72.87, 8) as any);
    await getAccurateLocation();
    expect(L.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 60000, requiredAccuracy: 25 });
  });

  it('asks for the highest accuracy', async () => {
    L.getCurrentPositionAsync.mockResolvedValue(pos(19.07, 72.87, 8) as any);
    const res = await getAccurateLocation();
    expect(L.getCurrentPositionAsync).toHaveBeenCalledWith(expect.objectContaining({ accuracy: Location.Accuracy.Highest }));
    expect(res).toEqual({ ok: true, fix: expect.objectContaining({ lat: 19.07, lng: 72.87, accuracy: 8 }) });
  });

  it('keeps listening and returns the most accurate fix', async () => {
    L.getCurrentPositionAsync.mockResolvedValue(pos(19.0, 72.0, 900) as any); // rough first fix
    const p = getAccurateLocation({ targetAccuracy: 20, maxWaitMs: 2000 });
    await new Promise(r => setTimeout(r, 20));
    L.__emit(pos(19.05, 72.85, 120));
    L.__emit(pos(19.0761, 72.8775, 12)); // GPS locks
    const res = await p;
    expect(res.ok && res.fix).toEqual(expect.objectContaining({ lat: 19.0761, accuracy: 12 }));
  });

  it('never invents a location when permission is denied', async () => {
    L.requestForegroundPermissionsAsync.mockResolvedValue({ status: 'denied' } as any);
    expect(await getAccurateLocation()).toEqual({ ok: false, error: 'denied' });
  });

  it('reports a timeout rather than a fake point', async () => {
    L.getCurrentPositionAsync.mockImplementation(() => new Promise(() => {}));
    expect(await getAccurateLocation({ maxWaitMs: 50 })).toEqual({ ok: false, error: 'timeout' });
  });
});

describe('reverseGeocode', () => {
  it('turns coordinates into a short area and full address', async () => {
    L.reverseGeocodeAsync.mockResolvedValue([{ streetNumber: '12', street: '5th Cross Rd', district: 'Koramangala', city: 'Bengaluru', postalCode: '560034', name: '12' } as any]);
    const place = await reverseGeocode(12.93, 77.62);
    expect(place).toEqual(expect.objectContaining({ short: 'Koramangala', full: '12 5th Cross Rd, Koramangala, Bengaluru, 560034' }));
  });

  it('falls back to OpenStreetMap when the device geocoder fails', async () => {
    L.reverseGeocodeAsync.mockRejectedValue(new Error('no geocoder'));
    const fetchMock = jest.spyOn(globalThis, 'fetch' as any).mockResolvedValue({
      ok: true,
      json: async () => ({ address: { road: 'MG Road', suburb: 'Ashok Nagar', city: 'Bengaluru', postcode: '560001' } })
    } as any);
    const place = await reverseGeocode(12.97, 77.6);
    expect(fetchMock.mock.calls[0][0]).toContain('nominatim.openstreetmap.org/reverse');
    expect(place).toEqual(expect.objectContaining({ short: 'Ashok Nagar', full: 'MG Road, Ashok Nagar, Bengaluru, 560001' }));
    fetchMock.mockRestore();
  });
});

describe('pricing distance uses real positions', () => {
  const pro = (over: Partial<ProProfile>): ProProfile => ({
    role: 'pro', name: 'Ravi', phone: '9123456780', skills: 'Plumbing', isOnline: true, liveLat: 12.9352, liveLng: 77.6245,
    serviceRadiusKm: 10, freeAcceptsRemaining: 10, monthlyFreeAcceptsRemaining: 0, subscriptionActive: false, gpsEnabled: true, ...over
  });

  it('measures from the customer to the nearest suitable pro', () => {
    const m = matchService('Plumbing', 'Standard', undefined, [pro({})], { lat: 12.9279, lng: 77.6271 }); // ~0.8 km away
    expect(m.nearbyPros).toBe(1);
    expect(m.distanceKm).toBeLessThan(1.5);
  });

  it('ignores pros outside their radius, offline, or without a location — no 1,000 km travel fees', () => {
    const mumbai = { lat: 19.076, lng: 72.8777 };
    const m = matchService('Plumbing', 'Standard', undefined, [pro({}), pro({ phone: '2', isOnline: false }), pro({ phone: '3', liveLat: undefined })], mumbai);
    expect(m.nearbyPros).toBe(0);
    expect(m.distanceKm).toBe(3);
    expect(m.distanceCharge).toBe(30);
  });
});

describe('merging keeps the newest pro position', () => {
  it('a stale local copy does not hide the pro moving', () => {
    const base = { id: '1', eventId: 'e', title: 't', kind: 'Plumbing', detail: '', urgency: 'Standard', estimate: 1, stage: 'On the way', createdAt: '', distanceKm: 1, arrivalPin: '1234' } as ServiceJob;
    const local = { ...base, proLat: 1, proLng: 1, proLocationAt: '2026-10-20T10:00:00Z' };
    const remote = { ...base, proLat: 2, proLng: 2, proLocationAt: '2026-10-20T10:00:30Z' };
    expect(mergeJobs([local], [remote])[0].proLat).toBe(2);
    expect(mergeJobs([remote], [local])[0].proLat).toBe(2);
  });
});

describe('profile location rules', () => {
  const wrapper = ({ children }: { children: ReactNode }) => <EventProvider><MarketplaceProvider>{children}</MarketplaceProvider></EventProvider>;
  beforeEach(() => AsyncStorage.clear());

  it('background GPS never overwrites an address the user typed; the locate button does', async () => {
    const h = await renderHook(() => useMarketplace(), { wrapper });
    await waitFor(() => expect(h.result.current.ready).toBe(true));
    await act(() => h.result.current.setProfile({ role: 'customer', name: 'Priya', phone: '9876543210' }));

    await act(() => h.result.current.setManualAddress('Flat 4B, Lake View Apts, HSR Layout', 'HSR Layout', { lat: 12.91, lng: 77.64 }));
    const fix = { lat: 12.95, lng: 77.6, accuracy: 9, timestamp: Date.now() };
    const place = { short: 'Ashok Nagar', full: 'MG Road, Ashok Nagar, Bengaluru' };

    await act(() => h.result.current.applyLocation(fix, place, 'auto'));
    expect(h.result.current.profile?.address).toBe('Flat 4B, Lake View Apts, HSR Layout');
    expect(h.result.current.profile?.liveLat).toBe(12.95); // position still updates
    expect(h.result.current.profile?.locationAccuracy).toBe(9);

    await act(() => h.result.current.applyLocation(fix, place, 'explicit'));
    expect(h.result.current.profile?.address).toBe('MG Road, Ashok Nagar, Bengaluru');
    expect(h.result.current.profile?.addressSource).toBe('gps');
  });

  it('jobs carry the real location, and the pro’s live position reaches the job', async () => {
    const h = await renderHook(() => useMarketplace(), { wrapper });
    await waitFor(() => expect(h.result.current.ready).toBe(true));
    await act(() => h.result.current.setProfile({ role: 'customer', name: 'Priya', phone: '9876543210' }));
    await act(() => h.result.current.applyLocation({ lat: 12.93, lng: 77.62, accuracy: 10, timestamp: Date.now() }, null, 'auto'));
    let id = '';
    await act(() => { id = h.result.current.request({ title: 'Leak', kind: 'Plumbing', detail: '', urgency: 'Standard', budget: 500 }); });
    expect(h.result.current.getJob(id)).toEqual(expect.objectContaining({ lat: 12.93, lng: 77.62 }));

    await act(() => h.result.current.setProfile({
      role: 'pro', name: 'Ravi', phone: '9123456780', skills: 'Plumbing', isOnline: true,
      freeAcceptsRemaining: FREE_ACCEPTS, monthlyFreeAcceptsRemaining: 0, subscriptionActive: false, gpsEnabled: true
    }));
    expect((h.result.current.profile as ProProfile).liveLat).toBeUndefined(); // no fake coordinates for new pros
    await act(() => { h.result.current.acceptBudget(id); });
    await act(() => h.result.current.applyLocation({ lat: 12.95, lng: 77.64, accuracy: 6, timestamp: Date.now() }, null, 'auto'));
    await waitFor(() => expect(h.result.current.getJob(id)).toEqual(expect.objectContaining({ proLat: 12.95, proLng: 77.64 })));
    expect(h.result.current.getJob(id)!.distanceKm).toBeGreaterThan(2);
    expect(h.result.current.getJob(id)!.distanceKm).toBeLessThan(4);
  });
});
