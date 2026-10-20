const { test, before, after, beforeEach } = require('node:test');
const assert = require('node:assert/strict');
const { createApp, memoryStore, mergeJob } = require('./index');

let server;
let base;
let store;
const logs = [];
const pushes = [];
const realInfo = console.info;

before(async () => {
  store = memoryStore();
  console.info = msg => logs.push(String(msg)); // capture dev OTPs
  server = createApp({
    store,
    authMode: 'development',
    aiKey: '',
    pushSender: async messages => { pushes.push(...messages); }
  }).listen(0);
  await new Promise(r => server.once('listening', r));
  base = `http://127.0.0.1:${server.address().port}`;
});

after(() => {
  console.info = realInfo;
  server.close();
});

beforeEach(() => {
  store.reset();
  pushes.length = 0;
});

const post = (path, body) => fetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
const job = over => ({ id: '1', eventId: 'e1', title: 'Leak', kind: 'Plumbing', stage: 'Matching', estimate: 300, createdAt: '2026-10-20T08:00:00Z', ...over });

test('health reports storage', async () => {
  const res = await fetch(base + '/api/health');
  assert.equal(res.status, 200);
  assert.equal((await res.json()).store, 'memory');
});

test('OTP: issue, reject wrong, accept right, single use', async () => {
  assert.equal((await post('/api/auth/request-otp', { phone: '123' })).status, 400);
  assert.equal((await post('/api/auth/request-otp', { phone: '9876543210' })).status, 200);
  const otp = logs.at(-1).match(/(\d{6})$/)[1];
  assert.equal((await post('/api/auth/verify-otp', { phone: '9876543210', otp: '000000' === otp ? '111111' : '000000' })).status, 401);
  assert.equal((await post('/api/auth/verify-otp', { phone: '9876543210', otp })).status, 200);
  assert.equal((await post('/api/auth/verify-otp', { phone: '9876543210', otp })).status, 401);
});

test('OTP: locks after 5 wrong attempts', async () => {
  await post('/api/auth/request-otp', { phone: '9876543211' });
  const otp = logs.at(-1).match(/(\d{6})$/)[1];
  const wrong = otp === '999999' ? '888888' : '999999';
  for (let i = 0; i < 5; i++) await post('/api/auth/verify-otp', { phone: '9876543211', otp: wrong });
  assert.equal((await post('/api/auth/verify-otp', { phone: '9876543211', otp })).status, 401);
});

test('OTP: 503 when SMS is not configured', async () => {
  const s = createApp({ store: memoryStore(), authMode: 'production' }).listen(0);
  await new Promise(r => s.once('listening', r));
  const res = await fetch(`http://127.0.0.1:${s.address().port}/api/auth/request-otp`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ phone: '9876543210' }) });
  s.close();
  assert.equal(res.status, 503);
});

test('jobs: rejects bad payloads', async () => {
  assert.equal((await post('/api/jobs', { nope: true })).status, 400);
  assert.equal((await post('/api/jobs', [{ id: 5 }])).status, 400);
});

test('jobs: a stale phone cannot erase or rewind other jobs', async () => {
  await post('/api/jobs', [job({ id: 'a', stage: 'In progress' }), job({ id: 'b' })]);
  // Phone 2 only knows an older copy of "a" and nothing about "b"
  const res = await post('/api/jobs', [job({ id: 'a', stage: 'Assigned' })]);
  const { data } = await res.json();
  assert.deepEqual(data.map(j => j.id).sort(), ['a', 'b']);
  assert.equal(data.find(j => j.id === 'a').stage, 'In progress');
});

test('jobs: legacy Arriving stage is normalised', async () => {
  const { data } = await (await post('/api/jobs', job({ stage: 'Arriving' }))).json();
  assert.equal(data[0].stage, 'Assigned');
});

test('bids: one per pro, latest wins, closed jobs refuse bids', async () => {
  await post('/api/jobs', job());
  await post('/api/jobs/1/bid', { proName: 'Ravi', proPhone: '9123456780', proBidAmount: 400 });
  await new Promise(r => setTimeout(r, 5));
  const res = await post('/api/jobs/1/bid', { proName: 'Ravi', proPhone: '9123456780', proBidAmount: 350 });
  const { job: updated } = await res.json();
  assert.equal(updated.bids.length, 1);
  assert.equal(updated.bids[0].bidAmount, 350);

  assert.equal((await post('/api/jobs/1/bid', { proName: 'X', proPhone: '1', proBidAmount: -5 })).status, 400);
  assert.equal((await post('/api/jobs/404/bid', { proName: 'X', proPhone: '1', proBidAmount: 5 })).status, 404);

  const acc = await (await post('/api/jobs/1/accept-bid', { proName: 'Ravi', proPhone: '9123456780', agreedAmount: 350 })).json();
  assert.equal(acc.job.stage, 'Assigned');
  assert.equal(acc.job.estimate, 350);
  assert.match(acc.job.arrivalPin, /^\d{4}$/);
  assert.equal((await post('/api/jobs/1/bid', { proName: 'Late', proPhone: '9000000000', proBidAmount: 300 })).status, 409);
});

test('push: a quote notifies the customer, acceptance notifies the pro', async () => {
  assert.equal((await post('/api/push/register', { phone: '9876543210', role: 'customer', token: 'nope' })).status, 400);
  assert.equal((await post('/api/push/register', { phone: '9876543210', role: 'customer', token: 'ExponentPushToken[customer-1]' })).status, 200);
  assert.equal((await post('/api/push/register', { phone: '9123456780', role: 'pro', token: 'ExponentPushToken[pro-1]' })).status, 200);

  await post('/api/jobs', job({ customerPhone: '9876543210' }));
  await post('/api/jobs/1/bid', { proName: 'Ravi', proPhone: '9123456780', proBidAmount: 400 });
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].to, 'ExponentPushToken[customer-1]');
  assert.match(pushes[0].body, /400/);
  assert.equal(pushes[0].data.jobId, '1');

  await post('/api/jobs/1/accept-bid', { proName: 'Ravi', proPhone: '9123456780', agreedAmount: 400 });
  assert.equal(pushes.length, 2);
  assert.equal(pushes[1].to, 'ExponentPushToken[pro-1]');
  assert.equal(pushes[1].data.kind, 'accepted');

  assert.equal((await post('/api/push/unregister', { phone: '9123456780' })).status, 200);
});

test('pros: stored without bank details', async () => {
  const res = await post('/api/pros', { name: 'Ravi', phone: '9123456780', accountNumber: '123456789', ifscCode: 'HDFC0001234', payoutUpi: 'ravi@okhdfc' });
  const { data } = await res.json();
  assert.equal(data.length, 1);
  assert.equal(data[0].accountNumber, undefined);
  assert.equal(data[0].ifscCode, undefined);
  assert.equal((await post('/api/pros', { name: 'No phone' })).status, 400);
});

test('ai: 503 without a provider key, 400 on empty prompt', async () => {
  assert.equal((await post('/api/ai', { prompt: '' })).status, 400);
  assert.equal((await post('/api/ai', { prompt: 'tap leaking' })).status, 503);
});

test('jobs: the newest pro live position wins regardless of arrival order', async () => {
  await post('/api/jobs', job({ stage: 'On the way', proLat: 2, proLng: 2, proLocationAt: '2026-10-20T10:00:30Z' }));
  const { data } = await (await post('/api/jobs', job({ stage: 'On the way', proLat: 1, proLng: 1, proLocationAt: '2026-10-20T10:00:00Z' }))).json();
  assert.equal(data[0].proLat, 2);
});

test('mergeJob keeps payment learnt on either side at the same stage', () => {
  const a = job({ stage: 'Completed' });
  const b = job({ stage: 'Completed', paidAt: '2026-10-20T10:00:00Z', paymentMethod: 'UPI' });
  assert.equal(mergeJob(a, b).paidAt, '2026-10-20T10:00:00Z');
  assert.equal(mergeJob(b, a).paidAt, '2026-10-20T10:00:00Z');
});

test('config: serves a banner for each role, and env can override it', async () => {
  const res = await fetch(base + '/api/config');
  assert.equal(res.status, 200);
  const { config } = await res.json();
  assert.ok(config.banners.some(b => b.audience === 'customer' && b.enabled));
  assert.ok(config.banners.some(b => b.audience === 'pro' && b.enabled));

  process.env.REMOTE_CONFIG_JSON = JSON.stringify({ version: 9, banners: [{ id: 'x', audience: 'pro', title: 'Heads up' }] });
  try {
    const { config: custom } = await (await fetch(base + '/api/config')).json();
    assert.equal(custom.version, 9);
    assert.equal(custom.banners[0].title, 'Heads up');
  } finally {
    delete process.env.REMOTE_CONFIG_JSON;
  }
});
