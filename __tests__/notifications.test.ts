import { collectJobNotifications, notificationJobId } from '../src/notification-events';
import { ServiceJob } from '../src/types';

const job = (over: Partial<ServiceJob> = {}): ServiceJob => ({
  id: 'j1',
  eventId: 'e1',
  title: 'Leaking tap',
  detail: 'Dripping under the sink',
  kind: 'Plumbing',
  urgency: 'Standard',
  stage: 'Matching',
  estimate: 0,
  distanceKm: 1,
  createdAt: '2026-10-20T08:00:00Z',
  ...over
});

const customer = '9876543210';
const pro = '9123456780';

test('first run seeds current jobs without notifying', () => {
  const jobs = [job({ customerPhone: customer, bids: [{ proName: 'Ravi', proPhone: pro, bidAmount: 400, timestamp: '2026-10-20T09:00:00Z' }] })];
  const first = collectJobNotifications({ role: 'customer', phone: customer, jobs, seen: [], baseline: true });
  expect(first.events).toHaveLength(0);
  expect(first.keys).toContain('j1:bid:9123456780:400');

  const second = collectJobNotifications({ role: 'customer', phone: customer, jobs, seen: first.keys });
  expect(second.events).toHaveLength(0);
});

test('customer is notified about a new quote exactly once', () => {
  const jobs = [job({ customerPhone: customer, bids: [{ proName: 'Ravi', proPhone: pro, bidAmount: 400, timestamp: '2026-10-20T09:00:00Z' }] })];
  const first = collectJobNotifications({ role: 'customer', phone: customer, jobs, seen: [] });
  expect(first.events).toEqual([
    expect.objectContaining({ title: 'New quote from Ravi', jobId: 'j1' })
  ]);
  expect(first.events[0].body).toContain('400');
  expect(first.events[0].key).toBe('j1:bid:9123456780:400');

  const again = collectJobNotifications({ role: 'customer', phone: customer, jobs, seen: first.keys });
  expect(again.events).toHaveLength(0);
});

test('customer only hears about the current stage, never the history', () => {
  const jobs = [job({ customerPhone: customer, stage: 'In progress', proName: 'Ravi' })];
  const result = collectJobNotifications({ role: 'customer', phone: customer, jobs, seen: [] });
  expect(result.events).toHaveLength(1);
  expect(result.events[0].title).toBe('Work has started');
  expect(result.events[0].key).toBe('j1:stage:In progress');
});

test('customer never sees another customer’s job', () => {
  const jobs = [job({ id: 'other', customerPhone: '9000000000', stage: 'Completed' })];
  expect(collectJobNotifications({ role: 'customer', phone: customer, jobs, seen: [] }).events).toHaveLength(0);
});

test('pro is told about matching open requests but not their own or an already quoted one', () => {
  const jobs = [
    job({ id: 'open', customerPhone: '9000000001', kind: 'AC repair', budget: 800 }),
    job({ id: 'mine', customerPhone: pro }),
    job({ id: 'quoted', customerPhone: '9000000002', bids: [{ proName: 'Me', proPhone: pro, bidAmount: 500, timestamp: 'x' }] }),
    job({ id: 'declined', customerPhone: '9000000003', declinedPhones: [pro] })
  ];
  const result = collectJobNotifications({ role: 'pro', phone: pro, jobs, seen: [] });
  expect(result.events).toHaveLength(1);
  expect(result.events[0].jobId).toBe('open');
  expect(result.events[0].body).toContain('800');
});

test('pro hears about payment and rating once each', () => {
  const jobs = [
    job({
      customerPhone: '9000000001',
      proPhone: pro,
      stage: 'Completed',
      estimate: 650,
      paidAt: '2026-10-20T10:00:00Z',
      rating: 5
    })
  ];
  const first = collectJobNotifications({ role: 'pro', phone: pro, jobs, seen: [] });
  expect(first.events.map(e => e.title)).toEqual(['Payment received', '5★ rating']);
  const again = collectJobNotifications({ role: 'pro', phone: pro, jobs, seen: first.keys });
  expect(again.events).toHaveLength(0);
});

test('notification data opens the matching job', () => {
  expect(notificationJobId({ jobId: 'j9' })).toBe('j9');
  expect(notificationJobId(null, '/job/j9')).toBe('j9');
  expect(notificationJobId({}, '/bookings')).toBeNull();
});
