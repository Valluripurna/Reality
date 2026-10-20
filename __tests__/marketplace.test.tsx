import AsyncStorage from '@react-native-async-storage/async-storage';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { DatabaseEngine } from '../src/db';
import { FREE_ACCEPTS, useMarketplace } from '../src/marketplace';
import { EventProvider, useEvents } from '../src/store/events';
import { MarketplaceProvider } from '../src/marketplace';
import { ProProfile } from '../src/types';

const CUSTOMER = '9876543210';
const PRO = '9123456780';
const OTHER_PRO = '9988776655';

const wrapper = ({ children }: { children: ReactNode }) => (
  <EventProvider>
    <MarketplaceProvider>{children}</MarketplaceProvider>
  </EventProvider>
);

function useBoth() {
  return { m: useMarketplace(), e: useEvents() };
}

async function setup() {
  const hook = await renderHook(useBoth, { wrapper });
  await waitFor(() => expect(hook.result.current.m.ready).toBe(true));
  return hook;
}

const asCustomer = (h: Awaited<ReturnType<typeof setup>>) =>
  act(() => h.result.current.m.setProfile({ role: 'customer', name: 'Priya Sharma', phone: CUSTOMER }));

const asPro = (h: Awaited<ReturnType<typeof setup>>, phone = PRO, name = 'Ravi Kumar') =>
  act(() => h.result.current.m.setProfile({
    role: 'pro', name, phone, skills: 'Plumbing', isOnline: true, payoutUpi: 'ravi@okhdfc',
    freeAcceptsRemaining: FREE_ACCEPTS, monthlyFreeAcceptsRemaining: 0, subscriptionActive: false, gpsEnabled: true
  }));

beforeEach(async () => {
  await AsyncStorage.clear();
});

describe('marketplace lifecycle', () => {
  it('runs a booking from request to paid and rated, recording every step', async () => {
    const h = await setup();
    await asCustomer(h);

    // 1. Customer posts a request
    let jobId = '';
    await act(() => {
      jobId = h.result.current.m.request({ title: 'Sink leaking', kind: 'Plumbing', detail: 'Under the cabinet', urgency: 'Standard', address: 'Indiranagar' });
    });
    const posted = h.result.current.m.getJob(jobId)!;
    expect(posted.stage).toBe('Matching');
    // No declared price and no PIN until both sides agree.
    expect(posted.estimate).toBe(0);
    expect(posted.arrivalPin).toBeUndefined();
    expect(posted.customerPhone).toBe(CUSTOMER);
    const eventId = posted.eventId;
    expect(h.result.current.e.events.find(ev => ev.id === eventId)).toBeTruthy();

    // 2. Pro sends a quote
    await asPro(h);
    expect(h.result.current.m.jobs.map(j => j.id)).toContain(jobId);
    let res: { ok: boolean; reason?: string } = { ok: false };
    await act(() => { res = h.result.current.m.submitProBid(jobId, 450, 'Can come at 5'); });
    expect(res.ok).toBe(true);
    expect((h.result.current.m.profile as ProProfile).freeAcceptsRemaining).toBe(FREE_ACCEPTS - 1);
    // Re-quoting does not burn another claim and keeps one bid per pro
    await act(() => { res = h.result.current.m.submitProBid(jobId, 420); });
    expect(res.ok).toBe(true);
    expect(h.result.current.m.getJob(jobId)!.bids).toHaveLength(1);
    // The quote carries the pro's UPI handle, but only for the booked customer.
    expect(h.result.current.m.getJob(jobId)!.bids![0].proUpi).toBe('ravi@okhdfc');
    expect(h.result.current.m.getJob(jobId)!.arrivalPin).toBeUndefined();
    expect((h.result.current.m.profile as ProProfile).freeAcceptsRemaining).toBe(FREE_ACCEPTS - 1);
    // A pro cannot advance a job that is not theirs
    let advanced = true;
    await act(() => { advanced = h.result.current.m.advance(jobId); });
    expect(advanced).toBe(false);

    // 3. Customer accepts the quote
    await asCustomer(h);
    let accepted = false;
    await act(() => { accepted = h.result.current.m.acceptProBid(jobId, PRO, 'Ravi Kumar', 420); });
    expect(accepted).toBe(true);
    expect(h.result.current.m.getJob(jobId)!.stage).toBe('Assigned');
    expect(h.result.current.m.getJob(jobId)!.estimate).toBe(420);
    expect(h.result.current.m.getJob(jobId)!.proUpi).toBe('ravi@okhdfc');
    const pin = h.result.current.m.getJob(jobId)!.arrivalPin;
    expect(pin).toMatch(/^\d{4}$/);

    // 4. Pro moves it along; the PIN gate holds
    await asPro(h);
    await act(() => { h.result.current.m.advance(jobId); });
    expect(h.result.current.m.getJob(jobId)!.stage).toBe('On the way');
    await act(() => { advanced = h.result.current.m.advance(jobId, '0000' === pin ? '1111' : '0000'); });
    expect(advanced).toBe(false);
    expect(h.result.current.m.getJob(jobId)!.stage).toBe('On the way');
    await act(() => { advanced = h.result.current.m.advance(jobId, pin); });
    expect(advanced).toBe(true);
    expect(h.result.current.m.getJob(jobId)!.stage).toBe('In progress');
    await act(() => { h.result.current.m.advance(jobId); });
    const finished = h.result.current.m.getJob(jobId)!;
    expect(finished.stage).toBe('Completed');
    expect(finished.actualDurationFormatted).toBeTruthy();
    // Every stage carries the time it happened, in order
    const times = (['Assigned', 'On the way', 'In progress', 'Completed'] as const).map(st => finished.stageTimes?.[st]);
    expect(times.every(Boolean)).toBe(true);
    expect([...times].sort()).toEqual(times);
    expect((h.result.current.m.profile as ProProfile).completedJobsCount).toBe(1);

    // 5. Customer pays (once) and rates
    await asCustomer(h);
    let paid = false;
    await act(() => { paid = h.result.current.m.markPaid(jobId, 'UPI'); });
    expect(paid).toBe(true);
    await act(() => { paid = h.result.current.m.markPaid(jobId, 'UPI'); });
    expect(paid).toBe(false);
    await act(() => { h.result.current.m.rate(jobId, 5, 'Great'); });
    const closed = h.result.current.m.getJob(jobId)!;
    expect(closed.paymentRef).toMatch(/^RC\d+/);
    expect(closed.rating).toBe(5);

    // 6. The customer's record captured the trail
    await waitFor(() => {
      const ev = h.result.current.e.events.find(x => x.id === eventId);
      expect(ev).toBeTruthy();
      const titles = ev!.items.map(i => i.title).join(' | ');
      expect(titles).toContain('Service request posted');
      expect(titles).toContain('Ravi Kumar quoted ₹420');
      expect(titles).toContain('accepted Ravi Kumar');
      // Steps the pro took on "their" device are backfilled into the customer's record
      expect(titles).toContain('Ravi Kumar is on the way');
      expect(titles).toContain('Work started after PIN check');
      expect(titles).toContain('Work marked complete');
      expect(ev!.status).toBe('Resolved');
      // ...exactly once each
      const ids = ev!.items.map(i => i.id);
      expect(new Set(ids).size).toBe(ids.length);
      expect(titles).toMatch(/Paid ₹420/);
      expect(titles).toContain('Rated 5 out of 5');
    });
  });

  it('lets a pro accept the customer\'s suggested price, which completes the agreement and creates the PIN', async () => {
    const h = await setup();
    await asCustomer(h);
    let jobId = '';
    await act(() => {
      jobId = h.result.current.m.request({ title: 'Fix the geyser', kind: 'Appliance repair', detail: '', urgency: 'Standard', budget: 600 });
    });
    expect(h.result.current.m.getJob(jobId)!.budget).toBe(600);
    expect(h.result.current.m.getJob(jobId)!.estimate).toBe(0);
    expect(h.result.current.m.getJob(jobId)!.arrivalPin).toBeUndefined();

    await asPro(h);
    let res: { ok: boolean; reason?: string } = { ok: false };
    await act(() => { res = h.result.current.m.acceptBudget(jobId); });
    expect(res.ok).toBe(true);
    const agreed = h.result.current.m.getJob(jobId)!;
    expect(agreed.stage).toBe('Assigned');
    expect(agreed.estimate).toBe(600);
    expect(agreed.arrivalPin).toMatch(/^\d{4}$/);
    expect(agreed.proUpi).toBe('ravi@okhdfc');
    expect((h.result.current.m.profile as ProProfile).freeAcceptsRemaining).toBe(FREE_ACCEPTS - 1);
  });

  it('cannot accept a budget the customer never suggested', async () => {
    const h = await setup();
    await asCustomer(h);
    let jobId = '';
    await act(() => {
      jobId = h.result.current.m.request({ title: 'Fan noise', kind: 'Electrical', detail: '', urgency: 'Standard' });
    });
    await asPro(h);
    let res: { ok: boolean; reason?: string } = { ok: true };
    await act(() => { res = h.result.current.m.acceptBudget(jobId); });
    expect(res.ok).toBe(false);
    expect(res.reason).toMatch(/price/i);
    expect(h.result.current.m.getJob(jobId)!.stage).toBe('Matching');
    expect(h.result.current.m.getJob(jobId)!.arrivalPin).toBeUndefined();
  });

  it('enforces who can do what', async () => {
    const h = await setup();
    await asCustomer(h);
    let jobId = '';
    await act(() => { jobId = h.result.current.m.request({ title: 'Fan not working', kind: 'Electrical', detail: '', urgency: 'Urgent' }); });

    // Customers cannot quote; pros cannot accept quotes
    expect(h.result.current.m.submitProBid(jobId, 300).ok).toBe(false);
    await asPro(h);
    expect(h.result.current.m.acceptProBid(jobId, PRO, 'Ravi', 300)).toBe(false);

    // Invalid amounts are rejected
    expect(h.result.current.m.submitProBid(jobId, 0).ok).toBe(false);
    expect(h.result.current.m.submitProBid(jobId, Number.NaN).ok).toBe(false);

    // Offline pros cannot quote
    await act(() => h.result.current.m.toggleProOnline(false));
    expect(h.result.current.m.submitProBid(jobId, 300).reason).toMatch(/online/i);
    await act(() => h.result.current.m.toggleProOnline(true));

    // Out of free claims → blocked until a pass is active
    await act(() => h.result.current.m.updateProfile({ freeAcceptsRemaining: 0 } as Partial<ProProfile>));
    expect(h.result.current.m.submitProBid(jobId, 300).ok).toBe(false);
    await act(() => h.result.current.m.activatePass('Day'));
    let r = { ok: false };
    await act(() => { r = h.result.current.m.submitProBid(jobId, 300); });
    expect(r.ok).toBe(true);
    expect((h.result.current.m.profile as ProProfile).freeAcceptsRemaining).toBe(0);
  });

  it('lets the customer decline a quote and cancel, and hides declined jobs from that pro', async () => {
    const h = await setup();
    await asCustomer(h);
    let jobId = '';
    await act(() => { jobId = h.result.current.m.request({ title: 'Paint bedroom', kind: 'Painting', detail: '', urgency: 'Standard' }); });

    await asPro(h, OTHER_PRO, 'Suresh');
    await act(() => { h.result.current.m.submitProBid(jobId, 5000); });

    await asCustomer(h);
    await act(() => { h.result.current.m.declineProBid(jobId, OTHER_PRO); });
    expect(h.result.current.m.getJob(jobId)!.bids).toHaveLength(0);

    await asPro(h, OTHER_PRO, 'Suresh');
    expect(h.result.current.m.jobs.map(j => j.id)).not.toContain(jobId);

    await asCustomer(h);
    let res = { ok: false };
    await act(() => { res = h.result.current.m.cancelJob(jobId); });
    expect(res.ok).toBe(true);
    expect(h.result.current.m.getJob(jobId)!.stage).toBe('Cancelled');
    // Cannot cancel twice
    await act(() => { res = h.result.current.m.cancelJob(jobId); });
    expect(res.ok).toBe(false);
  });

  it('keeps each account’s bookings and records private', async () => {
    const h = await setup();
    await asCustomer(h);
    await act(() => { h.result.current.m.request({ title: 'Private job', kind: 'Cleaning', detail: '', urgency: 'Standard' }); });
    await waitFor(() => expect(h.result.current.e.events.length).toBe(1));

    await act(() => h.result.current.m.setProfile({ role: 'customer', name: 'Someone Else', phone: '9000000001' }));
    await waitFor(() => expect(h.result.current.e.events.length).toBe(0));
    expect(h.result.current.m.jobs).toHaveLength(0);

    await asCustomer(h);
    await waitFor(() => expect(h.result.current.e.events.length).toBe(1));
    expect(h.result.current.m.jobs).toHaveLength(1);
  });

  it('persists the session and restores it on restart', async () => {
    const h = await setup();
    await asCustomer(h);
    await waitFor(async () => expect(await DatabaseEngine.getActivePhone()).toBe(CUSTOMER));
    await h.unmount();

    const again = await setup();
    await waitFor(() => expect(again.result.current.m.profile?.name).toBe('Priya Sharma'));

    await act(() => again.result.current.m.logout());
    expect(again.result.current.m.profile).toBeNull();
    await waitFor(async () => expect(await DatabaseEngine.getActivePhone()).toBeNull());
  });
});
