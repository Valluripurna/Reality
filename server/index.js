const fs = require('fs');
const path = require('path');

// Load environment variables from the root .env file, if present.
const envPath = path.join(__dirname, '../.env');
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = (m[2] || '').replace(/(^['"]|['"]$)/g, '').trim();
  }
}

const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const { randomInt } = require('crypto');

/* ---------------------------------------------------------- remote config */

/**
 * Content the apps refresh at runtime: same shape as src/remote-config.ts.
 * Override with REMOTE_CONFIG_JSON (a JSON string) without shipping a build.
 */
const DEFAULT_REMOTE_CONFIG = {
  version: 1,
  banners: [
    {
      id: 'customer-spring-check',
      enabled: true,
      audience: 'customer',
      title: '{{name}}, not sure what the job should cost?',
      body: 'Describe the problem and get likely causes plus a fair range before you book. You and your pro agree the price.',
      cta: 'Ask the assistant',
      icon: 'chatbubbles-outline',
      tone: 'brand',
      action: { type: 'assistant' },
      dismissible: true
    },
    {
      id: 'pro-more-jobs',
      enabled: true,
      audience: 'pro',
      title: '{{name}}, more jobs near you',
      body: 'Add the services you offer and go online — matching requests appear first in your feed.',
      cta: 'Update services',
      icon: 'briefcase-outline',
      tone: 'brand',
      action: { type: 'route', href: '/profile' },
      dismissible: true
    }
  ]
};

function loadRemoteConfig() {
  const raw = process.env.REMOTE_CONFIG_JSON;
  if (!raw) return DEFAULT_REMOTE_CONFIG;
  try {
    const parsed = JSON.parse(raw);
    if (parsed && Array.isArray(parsed.banners)) return parsed;
  } catch (err) {
    console.warn('REMOTE_CONFIG_JSON is not valid JSON; using defaults.');
  }
  return DEFAULT_REMOTE_CONFIG;
}

/* ------------------------------------------------------------------ merge */

const STAGE_RANK = { Matching: 0, Assigned: 1, 'On the way': 2, 'In progress': 3, Completed: 4, Cancelled: 5 };

function normaliseStage(stage) {
  if (stage === 'Arriving') return 'Assigned';
  return Object.prototype.hasOwnProperty.call(STAGE_RANK, stage) ? stage : 'Matching';
}

/**
 * Merge two copies of a job. The copy further along the stage path wins; bids
 * are unioned (latest per pro) and declined pros stay declined. Mirrors
 * mergeJobs() in src/db.ts so phone and server agree.
 */
function mergeJob(existing, incoming) {
  const a = { ...existing, stage: normaliseStage(existing.stage) };
  const b = { ...incoming, stage: normaliseStage(incoming.stage) };
  const base = STAGE_RANK[b.stage] > STAGE_RANK[a.stage] ? { ...a, ...b } : { ...b, ...a, ...pickNewer(a, b) };
  const declined = [...new Set([...(a.declinedPhones || []), ...(b.declinedPhones || [])])];
  const latest = new Map();
  for (const bid of [...(a.bids || []), ...(b.bids || [])]) {
    if (!bid || !bid.proPhone || declined.includes(bid.proPhone)) continue;
    const prev = latest.get(bid.proPhone);
    if (!prev || String(bid.timestamp) > String(prev.timestamp)) latest.set(bid.proPhone, bid);
  }
  const bids = [...latest.values()];
  const out = { ...base, bids, hasBids: bids.length > 0 };
  if (a.stageTimes || b.stageTimes) out.stageTimes = { ...b.stageTimes, ...a.stageTimes, ...base.stageTimes };
  // The pro's live position: whichever copy saw it most recently.
  const loc = String(b.proLocationAt || '') > String(a.proLocationAt || '') ? b : a;
  if (loc.proLocationAt) Object.assign(out, { proLat: loc.proLat, proLng: loc.proLng, proLocationAt: loc.proLocationAt });
  if (declined.length) out.declinedPhones = declined; else delete out.declinedPhones;
  return out;
}

/** On a stage tie, keep facts that only one side has learnt yet (payment, rating). */
function pickNewer(a, b) {
  const out = {};
  for (const k of ['paidAt', 'paymentMethod', 'paymentRef', 'rating', 'ratingComment', 'completedWorkAt', 'actualDurationFormatted']) {
    if (a[k] === undefined && b[k] !== undefined) out[k] = b[k];
  }
  return out;
}

function validJob(job) {
  return job && typeof job.id === 'string' && job.id.length > 0 && job.id.length <= 100 && typeof job.eventId === 'string';
}

/* ------------------------------------------------------------------ storage */

const MAX_JOBS = 1000;

function memoryStore() {
  const jobs = new Map();
  const pros = new Map();
  return {
    kind: 'memory',
    async listJobs() { return [...jobs.values()].sort((x, y) => String(y.createdAt).localeCompare(String(x.createdAt))).slice(0, MAX_JOBS); },
    async getJob(id) { return jobs.get(id) || null; },
    async putJob(job) { jobs.set(job.id, job); return job; },
    async listPros() { return [...pros.values()]; },
    async putPro(pro) { pros.set(pro.phone, pro); return pro; },
    async reset() { jobs.clear(); pros.clear(); }
  };
}

function mongoStore() {
  const opts = { strict: false, versionKey: false, minimize: false };
  const Job = mongoose.models.Job || mongoose.model('Job', new mongoose.Schema({ _id: String, data: Object, createdAt: String }, opts));
  const Pro = mongoose.models.Pro || mongoose.model('Pro', new mongoose.Schema({ _id: String, data: Object }, opts));
  return {
    kind: 'mongo',
    async listJobs() { return (await Job.find().sort({ createdAt: -1 }).limit(MAX_JOBS).lean()).map(d => d.data); },
    async getJob(id) { const d = await Job.findById(id).lean(); return d ? d.data : null; },
    async putJob(job) { await Job.updateOne({ _id: job.id }, { data: job, createdAt: job.createdAt || '' }, { upsert: true }); return job; },
    async listPros() { return (await Pro.find().lean()).map(d => d.data); },
    async putPro(pro) { await Pro.updateOne({ _id: pro.phone }, { data: pro }, { upsert: true }); return pro; },
    async reset() { await Job.deleteMany({}); await Pro.deleteMany({}); }
  };
}

/* ------------------------------------------------------------------ push */

/**
 * Expo's push service accepts up to 100 messages per request. Failures are
 * best-effort: a notification must never break a bid or an acceptance.
 */
async function sendExpoPush(messages) {
  if (!Array.isArray(messages) || !messages.length) return;
  for (let i = 0; i < messages.length; i += 100) {
    try {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(messages.slice(i, i + 100))
      });
    } catch (err) {
      console.warn('Push delivery failed:', err.message);
    }
  }
}

/* ------------------------------------------------------------------ app */

function createApp({
  store = memoryStore(),
  authMode = process.env.AUTH_MODE,
  aiKey = process.env.GROK_API_KEY,
  pushSender = sendExpoPush
} = {}) {
  const app = express();
  const allowed = (process.env.CORS_ORIGINS || '').split(',').map(v => v.trim()).filter(Boolean);
  app.use(cors({ origin: allowed.length ? allowed : true }));
  app.use(express.json({ limit: '2mb' }));

  const otps = new Map();
  /** phone -> { token, role } for devices registered in a real build. */
  const pushTokens = new Map();
  const clean = p => (typeof p === 'string' ? p.replace(/\D/g, '').slice(-10) : '');
  const notify = async (phone, message) => {
    const entry = pushTokens.get(clean(phone));
    if (!entry) return;
    try {
      await pushSender([{ to: entry.token, sound: 'default', ...message }]);
    } catch (err) {
      console.warn('Push delivery failed:', err.message);
    }
  };
  const wrap = fn => (req, res) => Promise.resolve(fn(req, res)).catch(err => {
    console.error(err);
    res.status(500).json({ success: false, message: 'Server error' });
  });

  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', store: store.kind, mongoConnected: mongoose.connection.readyState === 1, timestamp: new Date().toISOString() });
  });

  // --- remote config ------------------------------------------------------
  app.get('/api/config', (req, res) => {
    res.set('Cache-Control', 'public, max-age=60');
    res.json({ success: true, config: loadRemoteConfig() });
  });

  // --- push registration ---------------------------------------------------
  app.post('/api/push/register', (req, res) => {
    const phone = clean(req.body && req.body.phone);
    const token = typeof (req.body && req.body.token) === 'string' ? req.body.token.trim() : '';
    const role = req.body && req.body.role === 'pro' ? 'pro' : 'customer';
    if (!/^[6-9]\d{9}$/.test(phone) || !/^(Expo|Exponent)PushToken\[[^\]]+\]$/.test(token)) {
      return res.status(400).json({ success: false, message: 'Invalid push registration' });
    }
    pushTokens.set(phone, { token, role, updatedAt: new Date().toISOString() });
    res.json({ success: true });
  });

  app.post('/api/push/unregister', (req, res) => {
    const phone = clean(req.body && req.body.phone);
    if (phone) pushTokens.delete(phone);
    res.json({ success: true });
  });

  // --- auth ---------------------------------------------------------------
  app.post('/api/auth/request-otp', (req, res) => {
    const phone = clean(req.body && req.body.phone);
    if (!/^[6-9]\d{9}$/.test(phone)) return res.status(400).json({ success: false, message: 'Invalid phone number' });
    if (authMode !== 'development') return res.status(503).json({ success: false, message: 'SMS provider is not configured' });
    const otp = String(randomInt(100000, 1000000));
    otps.set(phone, { otp, expiresAt: Date.now() + 5 * 60 * 1000, tries: 0 });
    console.info(`[development] OTP for ${phone}: ${otp}`);
    return res.json({ success: true, expiresIn: 300 });
  });

  app.post('/api/auth/verify-otp', (req, res) => {
    const phone = clean(req.body && req.body.phone);
    const otp = typeof (req.body && req.body.otp) === 'string' ? req.body.otp : '';
    const pending = otps.get(phone);
    if (!pending || pending.expiresAt < Date.now() || pending.tries >= 5) {
      otps.delete(phone);
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }
    if (pending.otp !== otp) {
      pending.tries += 1;
      return res.status(401).json({ success: false, message: 'Invalid or expired OTP' });
    }
    otps.delete(phone);
    return res.json({ success: true });
  });

  // --- assistant ----------------------------------------------------------
  app.post('/api/ai', wrap(async (req, res) => {
    const prompt = typeof (req.body && req.body.prompt) === 'string' ? req.body.prompt.trim() : '';
    if (!prompt || prompt.length > 4000) return res.status(400).json({ success: false, message: 'Invalid prompt' });
    if (!aiKey) return res.status(503).json({ success: false, message: 'AI provider is not configured' });
    const upstream = await fetch('https://api.x.ai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${aiKey}` },
      body: JSON.stringify({
        model: process.env.GROK_MODEL || 'grok-3-mini',
        messages: [
          { role: 'system', content: 'You are the RealityChain service assistant for home repairs in India. Be concise and practical, give safety advice first when relevant, quote prices in rupees as ranges, and suggest booking a pro for anything risky. Use **bold** for short headings. No emojis.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.3,
        max_tokens: 512
      })
    }).catch(() => null);
    if (!upstream || !upstream.ok) return res.status(502).json({ success: false, message: 'AI provider unavailable' });
    const data = await upstream.json();
    return res.json({ success: true, text: (data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content) || '' });
  }));

  // --- jobs ---------------------------------------------------------------
  app.get('/api/jobs', wrap(async (req, res) => {
    const data = await store.listJobs();
    res.json({ success: true, count: data.length, data });
  }));

  /** Accepts one job or an array. Each is merged into what we have — never a blind overwrite. */
  app.post('/api/jobs', wrap(async (req, res) => {
    const list = Array.isArray(req.body) ? req.body : req.body && req.body.id ? [req.body] : null;
    if (!list) return res.status(400).json({ success: false, message: 'Expected a job or jobs array' });
    if (list.length > 500 || list.some(j => !validJob(j))) return res.status(400).json({ success: false, message: 'Invalid jobs payload' });
    for (const job of list) {
      const existing = await store.getJob(job.id);
      await store.putJob(existing ? mergeJob(existing, job) : { ...job, stage: normaliseStage(job.stage) });
    }
    const data = await store.listJobs();
    res.json({ success: true, count: data.length, data });
  }));

  app.post('/api/jobs/:id/bid', wrap(async (req, res) => {
    const { proName, proPhone, proBidAmount, note } = req.body || {};
    const amount = Number(proBidAmount);
    if (!proName || !proPhone || !Number.isFinite(amount) || amount <= 0 || amount > 1000000) {
      return res.status(400).json({ success: false, message: 'Invalid bid details' });
    }
    const job = await store.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job request not found' });
    if (normaliseStage(job.stage) !== 'Matching') return res.status(409).json({ success: false, message: 'Job is no longer open' });
    const bid = { proName, proPhone, bidAmount: amount, note: note || 'Can start right away.', timestamp: new Date().toISOString() };
    const merged = mergeJob(job, { ...job, bids: [bid], lastBidAmount: amount });
    await store.putJob(merged);
    await notify(job.customerPhone, {
      title: 'New quote',
      body: `${proName} quoted ₹${amount} for ${job.title || job.kind || 'your request'}.`,
      data: { jobId: merged.id, kind: 'bid' }
    });
    res.json({ success: true, job: merged });
  }));

  app.post('/api/jobs/:id/accept-bid', wrap(async (req, res) => {
    const { proName, proPhone, agreedAmount } = req.body || {};
    const agreed = Number(agreedAmount);
    if (!proName || !proPhone || !Number.isFinite(agreed) || agreed <= 0 || agreed > 1000000) {
      return res.status(400).json({ success: false, message: 'Invalid acceptance details' });
    }
    const job = await store.getJob(req.params.id);
    if (!job) return res.status(404).json({ success: false, message: 'Job request not found' });
    if (normaliseStage(job.stage) !== 'Matching') return res.status(409).json({ success: false, message: 'Job is no longer open' });
    // Both sides have agreed on the price, so this is when the arrival PIN exists.
    const arrivalPin = String(Math.floor(1000 + Math.random() * 9000));
    const updated = { ...job, stage: 'Assigned', proName, proPhone, estimate: agreed, arrivalPin, acceptedAt: new Date().toISOString() };
    await store.putJob(updated);
    await notify(proPhone, {
      title: 'You got the job',
      body: `Agreed ₹${agreed}. Open the job for the arrival PIN.`,
      data: { jobId: updated.id, kind: 'accepted' }
    });
    res.json({ success: true, job: updated });
  }));

  // --- pros ---------------------------------------------------------------
  app.get('/api/pros', wrap(async (req, res) => {
    const data = await store.listPros();
    res.json({ success: true, count: data.length, data });
  }));

  app.post('/api/pros', wrap(async (req, res) => {
    const pro = req.body;
    if (!pro || typeof pro.phone !== 'string' || typeof pro.name !== 'string' || pro.phone.length > 30 || pro.name.length > 120) {
      return res.status(400).json({ success: false, message: 'Invalid pro profile' });
    }
    // Never store bank details server-side in this open endpoint.
    const { accountNumber, ifscCode, ...publicPro } = pro;
    await store.putPro(publicPro);
    const data = await store.listPros();
    res.json({ success: true, count: data.length, data });
  }));

  return app;
}

module.exports = { createApp, memoryStore, mergeJob, normaliseStage };

/* ------------------------------------------------------------------ boot */

if (require.main === module) {
  const PORT = process.env.PORT || 5000;
  const uri = process.env.MONGODB_URI || '';
  const start = store => createApp({ store }).listen(PORT, () => {
    console.log(`RealityChain API on http://localhost:${PORT} (storage: ${store.kind})`);
  });
  if (uri.startsWith('mongodb') && !uri.includes('username:password')) {
    mongoose.connect(uri, { serverSelectionTimeoutMS: 8000 })
      .then(() => start(mongoStore()))
      .catch(err => {
        console.warn(`MongoDB unavailable (${err.message}); using in-memory storage.`);
        start(memoryStore());
      });
  } else {
    start(memoryStore());
  }
}
