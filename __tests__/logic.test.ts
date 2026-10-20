import { authMode, DEMO_OTP, isValidIndianMobile, requestOtp, verifyOtp } from '../src/auth';
import { mergeJobs } from '../src/db';
import { categories, matchService, resolveCategory, startingPrice } from '../src/matching';
import { isActiveStage, nextStage, normaliseStage, ServiceJob } from '../src/types';

const job = (over: Partial<ServiceJob> = {}): ServiceJob => ({
  id: '1000',
  eventId: 'e1',
  title: 'Leaking tap',
  kind: 'Plumbing',
  detail: '',
  urgency: 'Standard',
  estimate: 300,
  stage: 'Matching',
  createdAt: '2026-10-20T08:00:00.000Z',
  distanceKm: 1.2,
  arrivalPin: '4321',
  ...over
});

describe('job stages', () => {
  it('normalises legacy and unknown stages', () => {
    expect(normaliseStage('Arriving')).toBe('Assigned');
    expect(normaliseStage('nonsense')).toBe('Matching');
    expect(normaliseStage(undefined)).toBe('Matching');
    expect(normaliseStage('Cancelled')).toBe('Cancelled');
  });

  it('walks forward and stops at the end', () => {
    expect(nextStage('Matching')).toBe('Assigned');
    expect(nextStage('On the way')).toBe('In progress');
    expect(nextStage('Completed')).toBe('Completed');
    expect(nextStage('Cancelled')).toBe('Cancelled');
  });

  it('knows which stages are active', () => {
    expect(isActiveStage('In progress')).toBe(true);
    expect(isActiveStage('Completed')).toBe(false);
    expect(isActiveStage('Cancelled')).toBe(false);
  });
});

describe('mergeJobs', () => {
  it('keeps the copy that is further along', () => {
    const merged = mergeJobs([job({ stage: 'Assigned', proName: 'Ravi' })], [job({ stage: 'In progress', proName: 'Ravi' })]);
    expect(merged[0].stage).toBe('In progress');
    const back = mergeJobs([job({ stage: 'Completed' })], [job({ stage: 'Assigned' })]);
    expect(back[0].stage).toBe('Completed');
  });

  it('a stale copy cannot erase a job another device created', () => {
    const merged = mergeJobs([job({ id: '1' })], [job({ id: '2' })]);
    expect(merged.map(j => j.id).sort()).toEqual(['1', '2']);
  });

  it('keeps only the latest quote from each pro', () => {
    const a = job({ bids: [{ proName: 'Ravi', proPhone: '9123456780', bidAmount: 400, timestamp: '2026-10-20T08:01:00Z' }] });
    const b = job({ bids: [{ proName: 'Ravi', proPhone: '9123456780', bidAmount: 350, timestamp: '2026-10-20T08:05:00Z' }] });
    const merged = mergeJobs([a], [b]);
    expect(merged[0].bids).toHaveLength(1);
    expect(merged[0].bids![0].bidAmount).toBe(350);
  });

  it('declined quotes never come back on sync', () => {
    const local = job({ bids: [], declinedPhones: ['9123456780'] });
    const remote = job({ bids: [{ proName: 'Ravi', proPhone: '9123456780', bidAmount: 400, timestamp: 't' }] });
    const merged = mergeJobs([local], [remote]);
    expect(merged[0].bids).toEqual([]);
    expect(merged[0].hasBids).toBe(false);
  });

  it('normalises legacy stages from the server', () => {
    const merged = mergeJobs([], [job({ stage: 'Arriving' as any })]);
    expect(merged[0].stage).toBe('Assigned');
  });

  it('sorts newest first', () => {
    const merged = mergeJobs([job({ id: '100' }), job({ id: '300' })], [job({ id: '200' })]);
    expect(merged.map(j => j.id)).toEqual(['300', '200', '100']);
  });
});

describe('matching and pricing', () => {
  it('resolves free text to a category', () => {
    expect(resolveCategory('ac')).toBe('AC repair');
    expect(resolveCategory('AC Repair')).toBe('AC repair');
    expect(resolveCategory('electrician')).toBe('Electrical');
    expect(resolveCategory('Plumbing')).toBe('Plumbing');
    expect(resolveCategory('')).toBeNull();
  });

  it('every category has a starting price', () => {
    for (const c of categories) expect(startingPrice(c)).toBeGreaterThan(0);
  });

  it('estimate is the sum of its parts, plus the urgent surcharge', () => {
    const std = matchService('Plumbing', 'Standard');
    expect(std.estimate).toBe(std.aiLaborCost + std.aiPartsCost + std.distanceCharge + std.timeFee);
    const urgent = matchService('Plumbing', 'Urgent');
    expect(urgent.estimate - std.estimate).toBe(150);
  });
});

describe('auth (demo mode)', () => {
  it('uses demo mode without a server', () => {
    expect(authMode()).toBe('demo');
  });

  it('validates Indian mobile numbers', () => {
    expect(isValidIndianMobile('9876543210')).toBe(true);
    expect(isValidIndianMobile('+91 98765 43210')).toBe(true);
    expect(isValidIndianMobile('1234567890')).toBe(false);
    expect(isValidIndianMobile('98765')).toBe(false);
  });

  it('accepts only the demo code', async () => {
    expect((await requestOtp('12345')).ok).toBe(false);
    expect((await requestOtp('9876543210')).ok).toBe(true);
    expect((await verifyOtp('9876543210', '000000')).ok).toBe(false);
    expect((await verifyOtp('9876543210', '12345')).ok).toBe(false);
    expect((await verifyOtp('9876543210', DEMO_OTP)).ok).toBe(true);
  });
});
