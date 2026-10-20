import { AssistantContext, localReply } from '../src/ai';

const topicOf = (q: string, ctx?: AssistantContext) => localReply(q, ctx).topicId;
const intentOf = (q: string, ctx?: AssistantContext) => localReply(q, ctx).intent;

describe('assistant: recognises the actual problem', () => {
  it.each([
    ['my kitchen tap keeps dripping', 'dripping-tap'],
    ['bathroom faucet leaking all night', 'dripping-tap'],
    ['nal se pani tapak raha hai', 'dripping-tap'],
    ['water leaking from pipe under the sink', 'pipe-leak'],
    ['bathroom drain is blocked', 'blocked-drain'],
    ['kitchen sink not draining', 'blocked-drain'],
    ['toilet flush keeps running', 'toilet-running'],
    ['toilet is clogged and overflowing', 'toilet-blocked'],
    ['very low water pressure in shower', 'low-pressure'],
    ['mcb trips when I switch on the geyser', 'mcb-trip'],
    ['socket is sparking and smells burnt', 'sparking-socket'],
    ['ceiling fan is very slow', 'fan-issue'],
    ['tube light keeps flickering', 'light-flicker'],
    ['no power in one room', 'no-power'],
    ['AC not cooling properly', 'ac-not-cooling'],
    ['water dripping from my ac indoor unit', 'ac-water-leak'],
    ['ac making a rattling noise', 'ac-noise-smell'],
    ['need ac service', 'ac-service'],
    ['fridge is not cooling', 'fridge-not-cooling'],
    ['washing machine not draining', 'washer-problem'],
    ['geyser not heating water', 'geyser'],
    ['microwave not heating', 'microwave'],
    ['cockroaches in the kitchen', 'cockroaches'],
    ['termites in my wooden door', 'termites'],
    ['bed bugs in the mattress', 'bed-bugs'],
    ['door is not closing properly', 'door-problem'],
    ['damp patches and paint peeling on walls', 'damp-peeling'],
    ['laptop has become very slow', 'slow-computer'],
    ['wifi not working', 'wifi-problem'],
    ['need deep cleaning of my flat before move in', 'deep-clean']
  ])('“%s” → %s', (q, expected) => {
    expect(topicOf(q)).toBe(expected);
  });
});

describe('assistant: no false matches from substrings', () => {
  it('“account” is not AC, “problem” is not the pro intent', () => {
    expect(intentOf('my account login otp is not coming')).toBe('login');
    const r = localReply('problem with my fridge, it is not cooling');
    expect(r.topicId).toBe('fridge-not-cooling');
  });

  it('“actually” does not trigger AC', () => {
    expect(localReply('actually I just want to know how it works').kind).not.toBe('AC repair');
  });

  it('a greeting plus a problem answers the problem', () => {
    expect(topicOf('hi, my bathroom tap is dripping')).toBe('dripping-tap');
    expect(intentOf('hi')).toBe('greeting');
    expect(intentOf('hello there')).toBe('greeting');
  });
});

describe('assistant: answers the question that was asked', () => {
  it('price questions get a price, not a diagnosis', () => {
    const r = localReply('how much does AC service cost?');
    expect(r.topicId).toBe('ac-service');
    expect(r.text).toMatch(/Typical cost/);
    expect(r.text).not.toMatch(/Likely cause/);
  });

  it('category price questions list typical jobs', () => {
    const r = localReply('how much does a plumber charge');
    expect(r.kind).toBe('Plumbing');
    expect(r.text).toMatch(/Plumbing pricing/);
    expect(r.text).toMatch(/₹/);
  });

  it('DIY questions get safe steps', () => {
    const r = localReply('how do I fix a slow drain myself');
    expect(r.topicId).toBe('blocked-drain');
    expect(r.text).toMatch(/What you can safely try/);
  });

  it('dangerous jobs say so', () => {
    expect(localReply('socket sparking').text).toMatch(/Safety/);
  });

  it('every problem answer offers to book the right service', () => {
    const r = localReply('fan making humming noise');
    expect(r.actions?.[0].category).toBe('Electrical');
  });
});

describe('assistant: follow-ups keep the conversation', () => {
  it('“how much?” after a problem prices that problem', () => {
    const first = localReply('my tap is dripping');
    const ctx = { topicId: first.topicId, kind: first.kind };
    const r = localReply('how much will it cost?', ctx);
    expect(r.topicId).toBe('dripping-tap');
    expect(r.text).toMatch(/Typical cost/);
  });

  it('“can I fix it myself?” after a problem gives DIY for it', () => {
    const r = localReply('can I fix it myself?', { topicId: 'mcb-trip', kind: 'Electrical' });
    expect(r.topicId).toBe('mcb-trip');
    expect(r.text).toMatch(/safely try/);
  });

  it('“book it” after a problem offers booking for it', () => {
    const r = localReply('ok book someone', { topicId: 'ac-not-cooling', kind: 'AC repair' });
    expect(r.actions?.[0].category).toBe('AC repair');
  });

  it('a new subject replaces the old one', () => {
    expect(topicOf('and the fridge is not cooling either', { topicId: 'dripping-tap', kind: 'Plumbing' })).toBe('fridge-not-cooling');
  });
});

describe('assistant: app help and safety', () => {
  it.each([
    ['what is the arrival pin?', 'pin'],
    ['how does sos work', 'sos'],
    ['how do I cancel my booking', 'cancel'],
    ['can I pay by upi', 'payment'],
    ['how many free quotes do I get as a pro', 'pass'],
    ['how does this app work', 'how-it-works'],
    ['my location is wrong', 'location'],
    ['I want a refund, the plumber overcharged', 'refund'],
    ['are the pros verified?', 'safety-pros'],
    ['what can you do', 'capabilities'],
    ['thanks', 'thanks']
  ])('“%s” → %s', (q, expected) => {
    expect(intentOf(q)).toBe(expected);
  });

  it('emergencies come first, with the right numbers', () => {
    const gas = localReply('I can smell gas in the kitchen');
    expect(gas.intent).toBe('emergency');
    expect(gas.text).toMatch(/1906/);
    expect(localReply('my son got an electric shock from the switch').intent).toBe('emergency');
    // ...but "gas" in an AC context is not an emergency
    expect(localReply('ac needs gas refill').intent).not.toBe('emergency');
  });

  it('gibberish asks for clarification instead of guessing', () => {
    const r = localReply('asdfgh qwerty');
    expect(r.intent).toBe('fallback');
    expect(r.confident).toBe(false);
    expect(r.suggestions?.length).toBeGreaterThan(0);
  });
});
