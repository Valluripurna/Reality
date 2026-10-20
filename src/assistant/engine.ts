import { FREE_ACCEPTS } from '../marketplace';
import { serviceCatalog, startingPrice } from '../matching';
import { ServiceKind } from '../types';
import { AppIntent, BYES, CATEGORY_KEYS, GREETINGS, INTENT_KEYS, THANKS, Topic, TOPICS } from './knowledge';

/**
 * Service assistant engine.
 *
 *  1. Normalise the message into words.
 *  2. Score every symptom topic, category and app-help intent on whole-word
 *     matches (each word counts once, at its strongest keyword).
 *  3. Work out what kind of question it is (price, DIY, time, safety, booking).
 *  4. Emergencies win outright. Otherwise the strongest of topic / category /
 *     app-intent answers, shaped by the question type.
 *  5. Follow-ups ("how much will it cost?") reuse the last topic.
 *  6. Anything unrecognised goes to the server AI if configured, else a
 *     clarifying question with suggestions.
 */

export type AssistantContext = { topicId?: string; kind?: ServiceKind };
export type AssistantAction = { label: string; category: ServiceKind; title?: string };
export type AssistantReply = {
  text: string;
  topicId?: string;
  kind?: ServiceKind;
  intent?: AppIntent | 'category' | 'topic' | 'fallback';
  actions?: AssistantAction[];
  suggestions?: string[];
  source: 'local' | 'remote';
};
export type ChatTurn = { from: 'user' | 'bot'; text: string };

/* ------------------------------------------------------------------ text */

export function normalise(text: string) {
  return text
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/[^a-z0-9₹/'\- ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

type Parsed = { norm: string; tokens: string[] };
const parse = (text: string): Parsed => {
  const norm = normalise(text);
  return { norm, tokens: norm.split(' ').filter(Boolean) };
};

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** Index of the token a single keyword matches, or -1. Words of 4+ letters also match as prefixes (leak → leaking). */
function tokenHit(tokens: string[], key: string) {
  return tokens.findIndex(t => t === key || (key.length >= 4 && t.startsWith(key)) || t.replace(/'/g, '') === key.replace(/'/g, ''));
}

function phraseHit(norm: string, key: string) {
  const words = key.split(' ');
  const pattern = words.map((w, i) => (i === words.length - 1 && w.length >= 4 ? `${escape(w)}\\w*` : escape(w))).join(' ');
  return new RegExp(`(^| )${pattern}( |$)`).test(norm);
}

/** Sum of weights; each token counts once (at its best weight), phrases add on top. */
export function score(p: Parsed, keys: Record<string, number>) {
  const perToken = new Map<number, number>();
  let phrases = 0;
  let strongest = 0;
  for (const [key, w] of Object.entries(keys)) {
    if (key.includes(' ')) {
      if (phraseHit(p.norm, key)) { phrases += w; strongest = Math.max(strongest, w); }
    } else {
      const i = tokenHit(p.tokens, key);
      if (i >= 0) { perToken.set(i, Math.max(perToken.get(i) ?? 0, w)); strongest = Math.max(strongest, w); }
    }
  }
  let total = phrases;
  perToken.forEach(w => { total += w; });
  return { total, strongest };
}

/* ------------------------------------------------------------------ question type */

type QType = { price: boolean; diy: boolean; time: boolean; safety: boolean; book: boolean; why: boolean };

export function questionType(p: Parsed): QType {
  const has = (keys: string[]) => keys.some(k => (k.includes(' ') ? phraseHit(p.norm, k) : p.tokens.includes(k)));
  return {
    price: has(['how much', 'cost', 'costs', 'price', 'prices', 'pricing', 'charge', 'charges', 'charged', 'rate', 'rates', 'fee', 'fees', 'expensive', 'cheap', 'budget', 'kitna', 'paisa', 'rs', '₹', 'estimate', 'quote']),
    diy: has(['myself', 'diy', 'fix it', 'can i fix', 'how to fix', 'how do i fix', 'how can i fix', 'what should i do', 'what can i do', 'on my own', 'khud', 'repair it myself', 'temporary fix']),
    time: has(['how long', 'how much time', 'duration', 'kitna time', 'take long', 'how many hours', 'how many minutes']),
    safety: has(['safe', 'dangerous', 'danger', 'risky', 'risk', 'hazard']),
    book: has(['book', 'hire', 'need a', 'need an', 'send someone', 'send a', 'get a', 'find a', 'find me', 'call a', 'someone to', 'schedule', 'appointment', 'want a', 'looking for']),
    why: has(['why', 'cause', 'causes', 'reason', "what's wrong", 'whats wrong', 'what is wrong'])
  };
}

/* ------------------------------------------------------------------ classification */

export type Classification = {
  emergency: number;
  topic?: { t: Topic; score: number };
  category?: { kind: ServiceKind; score: number };
  intent?: { name: AppIntent; score: number };
  q: QType;
  smallTalk?: 'greeting' | 'thanks' | 'bye';
};

export function classify(text: string): Classification {
  const p = parse(text);
  const q = questionType(p);

  const catScores = new Map<ServiceKind, number>();
  for (const [kind, keys] of Object.entries(CATEGORY_KEYS)) catScores.set(kind, score(p, keys).total);

  let topic: Classification['topic'];
  for (const t of TOPICS) {
    const s = score(p, t.keys);
    if (s.strongest < 2) continue; // needs at least one specific signal
    const total = s.total + Math.min(catScores.get(t.kind) ?? 0, 3) * 0.6;
    if (!topic || total > topic.score) topic = { t, score: total };
  }
  // A lone weak symptom ("slow", "leak") with no category context is not enough.
  if (topic && topic.score < 3) topic = undefined;

  let category: Classification['category'];
  catScores.forEach((s, kind) => { if (s >= 2 && (!category || s > category.score)) category = { kind, score: s }; });

  let intent: Classification['intent'];
  for (const [name, keys] of Object.entries(INTENT_KEYS)) {
    const s = score(p, keys).total;
    if (name === 'emergency') continue;
    if (s >= 3 && (!intent || s > intent.score)) intent = { name: name as AppIntent, score: s };
  }
  const emergency = score(p, INTENT_KEYS.emergency).total;

  // Small talk only when the message is *just* small talk.
  const words = p.tokens.length;
  const only = (list: string[]) => list.some(g => p.norm === g || p.norm.startsWith(`${g} `)) && words <= 4 && !topic && !category && !intent;
  const smallTalk = only(GREETINGS) ? 'greeting' : only(THANKS) ? 'thanks' : only(BYES) ? 'bye' : undefined;

  return { emergency, topic, category, intent, q, smallTalk };
}

/* ------------------------------------------------------------------ answers */

const rupees = (n: number) => `₹${n.toLocaleString('en-IN')}`;
const range = (t: Topic) => `${rupees(t.price[0])}–${rupees(t.price[1])}`;
const bullets = (items: string[]) => items.map(i => `• ${i}`).join('\n');
const bookAction = (kind: ServiceKind, title?: string): AssistantAction => ({ label: `Book ${kind === 'Other' ? 'a pro' : kind.toLowerCase()}`, category: kind, title });

function followUps(q: QType, t: Topic) {
  const all = [
    !q.price && 'How much will it cost?',
    !q.diy && t.diy.length > 0 && 'Can I fix it myself?',
    !q.time && 'How long will it take?',
    t.safety && !q.safety && 'Is it safe to use?'
  ].filter(Boolean) as string[];
  return all.slice(0, 3);
}

function topicAnswer(t: Topic, q: QType): AssistantReply {
  const base = { topicId: t.id, kind: t.kind, intent: 'topic' as const, actions: [bookAction(t.kind, t.title)], suggestions: followUps(q, t), source: 'local' as const };
  const priceBlock = `**Typical cost**\n${range(t)} in most cities, including common parts. About ${t.time}.${t.parts?.length ? `\n${bullets(t.parts)}` : ''}`;
  const safety = t.safety ? `**Safety**\n${t.safety}` : '';

  if (q.price && !q.diy) {
    return { ...base, text: [`**${t.title}**`, priceBlock, 'Pros send their own quotes — you accept one before anything is charged.'].join('\n\n') };
  }
  if (q.diy) {
    const text = t.diy.length
      ? [`**What you can safely try**`, bullets(t.diy), `**If that doesn't fix it**\n${t.pro}`, safety].filter(Boolean).join('\n\n')
      : [`**Best left to a pro**`, t.pro, safety, `Typical cost ${range(t)}.`].filter(Boolean).join('\n\n');
    return { ...base, text };
  }
  if (q.time && !q.price) {
    return { ...base, text: `**${t.title}**\n\nUsually about ${t.time} once the pro arrives. ${t.pro}` };
  }
  if (q.safety && !q.price) {
    return { ...base, text: `**${t.title}**\n\n${t.safety ?? 'Generally safe to wait for a pro, but stop using it if it gets worse, smells of burning or sparks.'}` };
  }

  const isJob = t.cause.endsWith('job.') || t.cause === 'Routine work.' || t.cause === 'Installation job.';
  return {
    ...base,
    text: [
      `**${t.title}**`,
      isJob ? '' : `**Likely cause**\n${t.cause}`,
      t.diy.length ? `**Try this first**\n${bullets(t.diy)}` : '',
      `**What a pro does**\n${t.pro}`,
      priceBlock,
      safety
    ].filter(Boolean).join('\n\n')
  };
}

function categoryAnswer(kind: ServiceKind, q: QType): AssistantReply {
  const topics = TOPICS.filter(t => t.kind === kind);
  const blurb = serviceCatalog.find(c => c.kind === kind)?.blurb;
  const from = startingPrice(kind);
  const base = { kind, intent: 'category' as const, actions: [bookAction(kind)], source: 'local' as const, suggestions: topics.slice(0, 4).map(t => t.title) };

  if (q.price) {
    const lines = topics.length ? topics.slice(0, 5).map(t => `• ${t.title}: ${range(t)}`).join('\n') : '';
    return { ...base, text: [`**${kind} pricing**`, `Labour starts around ${rupees(from)}.`, lines ? `**Typical jobs**\n${lines}` : '', 'Pros send their own quotes, so you can compare before you accept.'].filter(Boolean).join('\n\n') };
  }
  if (!topics.length) {
    return { ...base, text: `**${kind}**\n\n${blurb ? `${blurb}. ` : ''}Visits start around ${rupees(from)}. Post a request with what you need and pros nearby will send quotes.` };
  }
  return {
    ...base,
    text: [
      q.book ? `Sure — I can help you book ${kind === 'AC repair' ? 'an AC technician' : kind.toLowerCase()}.` : `**${kind}**`,
      `What's happening? Common problems:\n${bullets(topics.slice(0, 5).map(t => t.title))}`,
      `Labour starts around ${rupees(from)}. Tap a problem below for likely causes and prices, or book now.`
    ].join('\n\n')
  };
}

function emergencyAnswer(text: string): AssistantReply {
  const n = normalise(text);
  let body: string;
  if (/gas|lpg|cylinder/.test(n)) {
    body = [
      '**Possible gas leak — act now**',
      bullets([
        "Don't switch any lights, fans or appliances on or off, and don't use a lighter.",
        'Turn off the cylinder regulator if you can reach it safely.',
        'Open doors and windows, and get everyone out.',
        'From outside, call the LPG emergency line **1906** or **112**.'
      ])
    ].join('\n\n');
  } else if (/shock/.test(n)) {
    body = [
      '**Electric shock**',
      bullets([
        "If someone is still touching the source, don't touch them — switch off the main power first.",
        'Call **112** (or **108** for an ambulance) if they are hurt, unconscious or were shocked by mains power.',
        'Keep the circuit off until an electrician checks it.'
      ])
    ].join('\n\n');
  } else if (/fire|smoke/.test(n)) {
    body = '**Fire**\n\n' + bullets(['Get everyone out and close the door behind you.', 'Call the fire service on **101** or **112**.', 'Never use water on an electrical fire — switch off the mains if it is safe.']);
  } else if (/flood/.test(n)) {
    body = '**Flooding**\n\n' + bullets(['Switch off the mains if you can reach the board without standing in water.', 'Close the main water valve.', 'Move valuables up, then book an urgent plumber.']);
  } else {
    body = '**Emergency**\n\nIf anyone is in danger, call **112** now. You can also use the red **SOS** button at the top of the app.';
  }
  return { text: body, intent: 'emergency', source: 'local', suggestions: ['How does SOS work?'] };
}

function intentAnswer(name: AppIntent): AssistantReply {
  const r = (text: string, suggestions?: string[]): AssistantReply => ({ text, intent: name, source: 'local', suggestions });
  switch (name) {
    case 'pin': return r('**Arrival PIN**\n\nWhen you accept a quote you get a private 4-digit PIN on the booking screen. Share it only when the pro is at your door — they enter it to start the job, so you know exactly who arrived and when.', ['How do I pay?', 'Can I cancel?']);
    case 'sos': return r('**SOS**\n\nTap the red **SOS** button at the top of the screen. After a 5-second countdown your phone dials **112**, and you can text your saved emergency contacts a link to your live location. Nothing is sent without you. Add contacts in **Account → Emergency contacts**.');
    case 'cancel': return r('**Cancelling a booking**\n\nOpen the booking and tap **Cancel booking**. You can cancel while pros are quoting, or after a pro accepts but before they set off. Once they are on the way, call them from the booking screen.');
    case 'payment': return r('**Paying your pro**\n\nAfter the work is marked complete, tap **Pay** on the booking. Choose **UPI** to scan your pro\'s payment code (opens GPay, PhonePe, Paytm…) or **Cash**. The receipt is saved to your record. Nothing is charged before the job is done.');
    case 'pass': return r(`**For service pros**\n\nSign up with "I'm a service professional", choose your services and go online. Every pro gets **${FREE_ACCEPTS} free quotes**; after that a **Day pass (₹49)** or **Monthly pass (₹499)** gives unlimited quotes. A 10% platform fee applies to completed jobs.`);
    case 'records': return r('**Records**\n\nEvery booking has a timestamped record: your request, each quote, who accepted, when they arrived (PIN), when work finished, and the payment receipt. Find them in the **Records** tab — handy for warranties, landlords or disputes. You can also share a record.');
    case 'how-it-works': return r('**How RealityChain works**\n\n1. Pick a service and describe the problem (a photo helps).\n2. Pros near you send quotes.\n3. Accept one — you get a 4-digit arrival PIN.\n4. Track the pro live on the map.\n5. Share the PIN at the door to start the job.\n6. Pay by UPI or cash and rate. Everything is saved in Records.\n\nThere is an animated walkthrough in **Account → About & How it works**.');
    case 'location': return r('**Your location**\n\nGo to **Account → Location** and tap the round locate button for an accurate GPS fix and street address. You can also tap your address at the top of Home, or enter one manually. Make sure Location is allowed for RealityChain in your phone settings.');
    case 'login': return r('**Signing in**\n\nEnter your 10-digit mobile number and the 6-digit code. In this demo build the code is **123456**. If the code doesn’t arrive on a live build, check the number and tap **Resend code** after 30 seconds.');
    case 'rating': return r('**Rating your pro**\n\nAfter you pay, the booking shows stars — tap to rate. Ratings help good pros get more work.');
    case 'refund': return r('**Not happy with a job?**\n\nFirst talk to the pro from the booking screen. If it isn’t resolved, email **support@realitychain.app** with the booking — your record (quotes, timestamps, photos, receipt) is the evidence. Payments go directly to the pro, so refunds are arranged with them.');
    case 'safety-pros': return r('**Can I trust the pros?**\n\nPros sign in with a verified mobile number and can upload ID for a verified badge (reviewed by our team). The arrival PIN confirms the right person turned up, every step is timestamped, and SOS is always one tap away.');
    case 'capabilities': return r("**I'm the RealityChain service assistant**\n\nDescribe a problem at home and I'll tell you the likely cause, what you can safely try, what a pro would do and a fair price range. I can also explain booking, the arrival PIN, payments and SOS.", ['Tap keeps dripping', 'AC not cooling', 'How does this app work?']);
    default: return r('');
  }
}

const STARTERS = ['Tap keeps dripping', 'MCB keeps tripping', 'AC not cooling', 'Fridge not cooling', 'How does this app work?'];

/* ------------------------------------------------------------------ main */

/** Local, deterministic answer. `confident: false` means it is only a clarifying question. */
export function localReply(text: string, ctx: AssistantContext = {}): AssistantReply & { confident: boolean } {
  const c = classify(text);
  const ctxTopic = ctx.topicId ? TOPICS.find(t => t.id === ctx.topicId) : undefined;
  const asksSomething = c.q.price || c.q.diy || c.q.time || c.q.safety || c.q.why;

  if (c.emergency >= 4) return { ...emergencyAnswer(text), confident: true };
  if (c.smallTalk === 'greeting') return { text: "Hi! What's the problem at home? For example: **“bathroom tap keeps dripping”** or **“fan is very slow”**.", intent: 'greeting', suggestions: STARTERS.slice(0, 4), source: 'local', confident: true };
  if (c.smallTalk === 'thanks') return { text: "You're welcome! Anything else I can help with?", intent: 'thanks', source: 'local', confident: true };
  if (c.smallTalk === 'bye') return { text: 'Bye! Hope it gets sorted quickly.', intent: 'bye', source: 'local', confident: true };

  const topicScore = c.topic?.score ?? 0;
  if (c.intent && c.intent.score >= topicScore && c.intent.score >= (c.category?.score ?? 0)) {
    return { ...intentAnswer(c.intent.name), confident: true };
  }
  if (c.topic) return { ...topicAnswer(c.topic.t, c.q), confident: true };

  // Category named; if we were already discussing a problem in it, stay on that problem.
  if (c.category) {
    if (ctxTopic && ctxTopic.kind === c.category.kind && asksSomething) return { ...topicAnswer(ctxTopic, c.q), confident: true };
    return { ...categoryAnswer(c.category.kind, c.q), confident: true };
  }

  // Follow-up with no new subject: reuse the conversation's topic or category.
  if (asksSomething || c.q.book) {
    if (ctxTopic) return c.q.book && !asksSomething
      ? { text: `Sure — tap below to book a ${ctxTopic.kind.toLowerCase()} pro for "${ctxTopic.title.toLowerCase()}". Pros nearby will send quotes.`, topicId: ctxTopic.id, kind: ctxTopic.kind, intent: 'book', actions: [bookAction(ctxTopic.kind, ctxTopic.title)], source: 'local', confident: true }
      : { ...topicAnswer(ctxTopic, c.q), confident: true };
    if (ctx.kind) return { ...categoryAnswer(ctx.kind, c.q), confident: true };
    if (c.q.price) {
      return {
        text: '**How pricing works**\n\nThere is no fixed price. You post the problem (optionally with a budget), pros send their own quotes or accept your budget, and you agree on a price together. The arrival PIN is created only once you agree, and nothing is charged until the job is done.\n\nTell me the problem and I can give a range.',
        intent: 'payment', suggestions: STARTERS.slice(0, 3), source: 'local', confident: true
      };
    }
  }

  return {
    text: "I didn't quite catch the problem. Describe it in a sentence — for example **“kitchen sink is blocked”** — or pick one below.",
    intent: 'fallback', suggestions: STARTERS, source: 'local', confident: false
  };
}

/* ------------------------------------------------------------------ remote */

function apiBase() {
  const base = process.env.EXPO_PUBLIC_API_URL;
  return base && base.startsWith('http') ? base.replace(/\/$/, '') : null;
}

async function remoteReply(text: string, history: ChatTurn[]): Promise<string | null> {
  const base = apiBase();
  if (!base) return null;
  const transcript = history.slice(-6).map(t => `${t.from === 'user' ? 'Customer' : 'Assistant'}: ${t.text}`).join('\n');
  const prompt = `${transcript ? `Conversation so far:\n${transcript}\n\n` : ''}Customer: ${text}`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(`${base}/api/ai`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ prompt }), signal: controller.signal });
    if (!res.ok) return null;
    const data = await res.json();
    return typeof data.text === 'string' && data.text.trim() ? data.text.trim() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Full reply: local knowledge first; the server AI only for things it doesn't recognise. */
export async function assistantReply(text: string, ctx: AssistantContext = {}, history: ChatTurn[] = []): Promise<AssistantReply> {
  const local = localReply(text, ctx);
  if (local.confident) {
    const { confident, ...reply } = local;
    return reply;
  }
  const remote = await remoteReply(text, history);
  if (remote) return { text: remote, intent: 'fallback', source: 'remote' };
  const { confident, ...reply } = local;
  return reply;
}
