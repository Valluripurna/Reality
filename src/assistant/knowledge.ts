import { ServiceKind } from '../types';

/**
 * What the assistant knows about home problems.
 *
 * Keywords are matched against whole words (with simple prefix stemming for
 * words of 4+ letters, so "leak" also matches "leaking"/"leakage"). Phrases
 * match as a sequence of words. Weights: 3 = strongly specific symptom,
 * 2 = clear signal, 1 = supporting context.
 *
 * Prices are typical totals in Indian metros, labour + common parts, and are
 * always presented as a range — pros send their own quotes.
 */
export type Topic = {
  id: string;
  kind: ServiceKind;
  title: string;
  keys: Record<string, number>;
  cause: string;
  diy: string[];
  pro: string;
  parts?: string[];
  time: string;
  price: [number, number];
  safety?: string;
};

/** Words that point at a whole category (used when no specific symptom matches). */
export const CATEGORY_KEYS: Record<ServiceKind, Record<string, number>> = {
  Plumbing: { plumber: 3, plumbing: 3, tap: 2, pipe: 2, sink: 2, toilet: 2, drain: 2, faucet: 2, nal: 2, flush: 2, commode: 2, basin: 2, 'water tank': 2, shower: 1, bathroom: 1, water: 1, pani: 1 },
  Electrical: { electrician: 3, electrical: 3, wiring: 2, wire: 2, switch: 2, socket: 2, plug: 1, mcb: 3, fuse: 2, fan: 2, light: 1, bulb: 1, tubelight: 2, 'tube light': 2, inverter: 2, power: 1, bijli: 2, current: 1, pankha: 2, voltage: 2 },
  'AC repair': { ac: 3, 'a/c': 3, aircon: 3, 'air conditioner': 3, 'air conditioning': 3, 'split ac': 3, 'window ac': 3, cooling: 1, compressor: 2 },
  'Appliance repair': { fridge: 3, refrigerator: 3, 'washing machine': 3, washer: 2, microwave: 3, oven: 2, geyser: 3, 'water heater': 3, chimney: 2, purifier: 3, ro: 2, dishwasher: 3, appliance: 3, tv: 2, television: 2 },
  Cleaning: { cleaning: 3, clean: 2, cleaner: 3, 'deep clean': 3, dust: 1, dirty: 1, stain: 1, maid: 2, safai: 2 },
  Carpentry: { carpenter: 3, carpentry: 3, door: 2, hinge: 2, wardrobe: 2, cupboard: 2, drawer: 2, furniture: 2, bed: 1, table: 1, wood: 1, wooden: 1, lock: 1 },
  Painting: { painter: 3, painting: 3, paint: 2, wall: 1, walls: 1, putty: 2, whitewash: 3, colour: 1, color: 1 },
  'Pest control': { pest: 3, pests: 3, cockroach: 3, cockroaches: 3, termite: 3, termites: 3, 'bed bug': 3, bedbug: 3, bedbugs: 3, rat: 3, rats: 3, mice: 3, ants: 2, mosquito: 2, mosquitoes: 2, lizard: 2, deemak: 3 },
  'Beauty & wellness': { salon: 3, haircut: 3, facial: 3, waxing: 3, manicure: 3, pedicure: 3, massage: 3, makeup: 3, beauty: 3, threading: 3, spa: 2 },
  'Computer repair': { laptop: 3, computer: 3, pc: 3, desktop: 2, wifi: 3, 'wi-fi': 3, router: 3, internet: 2, printer: 3, keyboard: 2, windows: 1, virus: 2 },
  Tutoring: { tutor: 3, tuition: 3, tutoring: 3, teacher: 2, homework: 2, maths: 2, math: 2, science: 1, exam: 1, coaching: 2 },
  Other: {}
};

export const TOPICS: Topic[] = [
  /* ------------------------------------------------------------- Plumbing */
  {
    id: 'dripping-tap', kind: 'Plumbing', title: 'Dripping or leaking tap',
    keys: { tap: 2, faucet: 2, nal: 2, mixer: 1, drip: 3, tapak: 3, dripping: 3, 'wont stop': 2, "won't stop": 2, 'keeps running': 1, leak: 1, loose: 1 },
    cause: 'Almost always a worn rubber washer or a worn cartridge inside the tap. Hard water speeds this up.',
    diy: ['Close the small angle valve under or behind the tap to stop the drip for now.', 'If the handle is loose, tighten the screw under its cap.'],
    pro: 'A plumber replaces the washer or cartridge, or the whole tap if the body is cracked.',
    parts: ['Washer / O-ring (₹20–50)', 'Cartridge (₹150–450)', 'New tap if needed (₹350–1,500)'],
    time: '20–40 min', price: [200, 450]
  },
  {
    id: 'pipe-leak', kind: 'Plumbing', title: 'Leaking pipe or joint',
    keys: { pipe: 2, pipes: 2, joint: 2, 'under the sink': 3, 'under sink': 3, leak: 2, leaking: 2, leakage: 2, burst: 3, seepage: 1, connection: 1, 'water on the floor': 2, wet: 1 },
    cause: 'A loose or perished joint, a cracked trap under the sink, or a worn connection hose. Pinhole leaks happen on old GI pipes.',
    diy: ['Put a bucket under it and close the nearest valve (or the main inlet).', 'Hand-tighten slip nuts on a plastic trap — don’t force them.'],
    pro: 'A plumber reseals or replaces the joint, trap or hose. Leaks inside walls need the wall opened.',
    parts: ['Teflon tape (₹30)', 'Connection hose (₹80–200)', 'PVC trap / coupler (₹60–250)'],
    time: '30–60 min', price: [250, 700],
    safety: 'If water is near sockets or a geyser, switch off that circuit at the MCB.'
  },
  {
    id: 'blocked-drain', kind: 'Plumbing', title: 'Blocked sink or drain',
    keys: { drain: 2, blocked: 3, block: 2, clog: 3, clogged: 3, choke: 3, choked: 3, 'not draining': 3, 'slow drain': 3, 'water not going': 3, overflow: 1, sink: 1, basin: 1, 'floor drain': 3, 'bad smell': 1 },
    cause: 'Hair and soap in bathroom drains, grease and food in kitchen sinks. Smell usually means a dry or dirty trap.',
    diy: ['Pour a kettle of hot (not boiling, for PVC) water down the drain.', 'Use a plunger with the overflow hole covered.', 'Avoid strong acid cleaners — they damage pipes and are dangerous.'],
    pro: 'A plumber clears it with a drain snake or pressure pump and cleans the trap.',
    time: '30–60 min', price: [250, 600]
  },
  {
    id: 'toilet-running', kind: 'Plumbing', title: 'Toilet flush keeps running or weak',
    keys: { toilet: 2, commode: 2, flush: 2, cistern: 3, 'keeps running': 3, running: 1, 'not flushing': 3, 'weak flush': 3, 'water keeps': 2, tank: 1 },
    cause: 'A worn flapper/seal or a misadjusted fill valve inside the cistern; a weak flush is often a stuck button or low fill level.',
    diy: ['Lift the cistern lid and check the float isn’t stuck.', 'Close the angle valve behind the toilet to stop water waste.'],
    pro: 'A plumber replaces the flush valve, seal or fill valve — or the whole flush mechanism.',
    parts: ['Seal / washer (₹50–150)', 'Flush valve kit (₹350–1,200)'],
    time: '30–60 min', price: [300, 900]
  },
  {
    id: 'toilet-blocked', kind: 'Plumbing', title: 'Blocked toilet',
    keys: { toilet: 2, commode: 2, blocked: 3, clogged: 3, choke: 3, choked: 3, overflowing: 3, 'not going down': 3 },
    cause: 'Usually wipes, sanitary products or too much paper stuck in the bend.',
    diy: ['Stop flushing. Use a toilet plunger (flange type) with slow, firm pushes.'],
    pro: 'A plumber uses a closet auger or pressure pump to clear the line.',
    time: '30–60 min', price: [350, 900]
  },
  {
    id: 'low-pressure', kind: 'Plumbing', title: 'Low water pressure',
    keys: { pressure: 3, 'low pressure': 3, 'no water': 2, 'water not coming': 3, 'slow water': 2, weak: 1, trickle: 3, aerator: 3, motor: 1, pump: 1 },
    cause: 'A clogged tap aerator or shower head, a half-closed valve, an airlock, or a weak pump/overhead tank.',
    diy: ['Unscrew the tap tip (aerator) and rinse out the grit.', 'Check that every valve on the line is fully open.'],
    pro: 'A plumber clears airlocks, descales fittings or fits a pressure pump.',
    time: '30–90 min', price: [250, 800]
  },

  /* ------------------------------------------------------------- Electrical */
  {
    id: 'mcb-trip', kind: 'Electrical', title: 'MCB / trip switch keeps tripping',
    keys: { mcb: 3, trip: 3, tripping: 3, trips: 3, rccb: 3, elcb: 3, fuse: 2, 'power cut': 1, breaker: 3, 'goes off': 2 },
    cause: 'An overloaded circuit, a short in an appliance or wiring, or earth leakage (often from a geyser element or damp wiring).',
    diy: ['Unplug everything on that circuit and reset the MCB.', 'Plug things back one by one — the one that trips it is the culprit.'],
    pro: 'An electrician tests the circuit for shorts and leakage and fixes the wiring or replaces a faulty MCB.',
    parts: ['MCB (₹200–450)', 'RCCB (₹1,500–3,000)'],
    time: '30–90 min', price: [300, 900],
    safety: 'If it trips again immediately with nothing plugged in, leave it off and call an electrician.'
  },
  {
    id: 'sparking-socket', kind: 'Electrical', title: 'Sparking or burning socket / switch',
    keys: { spark: 3, sparking: 3, sparks: 3, burning: 3, burnt: 3, melted: 3, 'burning smell': 3, smoke: 2, socket: 2, switch: 1, plug: 1, hot: 1 },
    cause: 'A loose terminal or a worn socket arcing under load — common with heavy appliances on 6A sockets.',
    diy: ['Switch off that circuit at the MCB now and don’t use the socket.'],
    pro: 'An electrician replaces the socket/switch and checks the wire for heat damage. Heavy appliances need a 16A socket.',
    parts: ['6A/16A socket (₹80–250)', 'Modular switch (₹60–200)'],
    time: '20–45 min', price: [200, 500],
    safety: 'Do not touch a scorched socket. Turn off the MCB first. If there is smoke or fire, leave and call 112.'
  },
  {
    id: 'fan-issue', kind: 'Electrical', title: 'Ceiling fan slow, noisy or not working',
    keys: { fan: 2, fans: 2, pankha: 2, 'ceiling fan': 3, slow: 2, noisy: 2, humming: 2, wobble: 3, wobbling: 3, 'not running': 2, 'not working': 1, capacitor: 3, regulator: 3 },
    cause: 'A slow or humming fan almost always needs a new capacitor. Wobbling means loose blades or canopy; no movement can be the regulator or winding.',
    diy: ['Try the fan at full speed with the regulator bypassed (another switch) to rule out the regulator.'],
    pro: 'An electrician swaps the capacitor or regulator, balances blades, or rewinds/replaces the motor.',
    parts: ['Capacitor (₹50–120)', 'Regulator (₹150–400)'],
    time: '20–45 min', price: [200, 450]
  },
  {
    id: 'light-flicker', kind: 'Electrical', title: 'Flickering or dead lights',
    keys: { flicker: 3, flickering: 3, blinking: 3, light: 2, lights: 2, tubelight: 3, 'tube light': 3, bulb: 2, led: 2, 'not glowing': 3, dim: 2 },
    cause: 'A failing LED driver or bulb, a loose holder, or a loose connection in the switchboard.',
    diy: ['Swap in a bulb you know works.', 'Switch off and check the holder is tight.'],
    pro: 'An electrician replaces the driver/fitting or fixes the loose connection.',
    time: '20–40 min', price: [150, 400]
  },
  {
    id: 'no-power', kind: 'Electrical', title: 'No power in part of the house',
    keys: { 'no power': 3, 'no electricity': 3, 'no current': 3, 'bijli nahi': 3, 'bijli chali': 3, 'power gone': 3, 'one room': 2, 'half the house': 3, dead: 1, outage: 2 },
    cause: 'A tripped MCB, a blown fuse, a loose neutral, or a fault on one phase from the supply.',
    diy: ['Check the distribution board for a tripped MCB.', 'Ask neighbours — if they’re off too, it’s a supply outage.'],
    pro: 'An electrician traces the fault in the board or wiring.',
    time: '30–90 min', price: [300, 800],
    safety: 'Never open the main meter or service cable — that is the electricity board’s job.'
  },
  {
    id: 'install-fitting', kind: 'Electrical', title: 'Install a fan, light or socket',
    keys: { install: 3, installation: 3, fit: 1, fitting: 2, 'new fan': 3, 'new light': 3, 'new socket': 3, chandelier: 3, 'extra socket': 3, 'add a socket': 3, mount: 2 },
    cause: 'Installation job.',
    diy: [],
    pro: 'An electrician mounts and wires it, and checks the load on the circuit.',
    time: '30–60 min', price: [200, 600]
  },

  /* ------------------------------------------------------------- AC */
  {
    id: 'ac-not-cooling', kind: 'AC repair', title: 'AC not cooling',
    keys: { 'not cooling': 3, 'no cooling': 3, 'less cooling': 3, 'cooling less': 3, 'not cold': 3, 'warm air': 3, 'hot air': 3, cooling: 2, gas: 2, refill: 2 },
    cause: 'Most often clogged filters or dirty coils; if a service doesn’t fix it, refrigerant may be low (a leak) or the outdoor unit isn’t running.',
    diy: ['Wash the indoor filters and refit them dry.', 'Check the outdoor unit fan is spinning and nothing blocks it.', 'Set 24°C on Cool mode, not Fan or Dry.'],
    pro: 'A technician services the coils, checks gas pressure and fixes leaks before any top-up.',
    parts: ['Service / jet wash (₹500–800)', 'Gas top-up (₹1,500–2,500)', 'Full gas refill after leak repair (₹2,500–4,000)'],
    time: '45–90 min', price: [500, 3000]
  },
  {
    id: 'ac-water-leak', kind: 'AC repair', title: 'Water dripping from the indoor AC',
    keys: { drip: 2, dripping: 3, leak: 2, leaking: 3, water: 2, 'water coming': 3, 'water dripping': 3, 'drain pipe': 3, indoor: 2, 'from ac': 3 },
    cause: 'A blocked condensate drain pipe or tray, or an indoor unit that isn’t level. Frozen coils from dirty filters also drip when they thaw.',
    diy: ['Clean the filters.', 'Check the drain pipe outside isn’t kinked or blocked.'],
    pro: 'A technician flushes the drain line, cleans the tray and re-levels the unit.',
    time: '30–60 min', price: [400, 900]
  },
  {
    id: 'ac-noise-smell', kind: 'AC repair', title: 'AC noisy or smells bad',
    keys: { noise: 3, noisy: 3, sound: 2, rattling: 3, vibration: 3, smell: 3, smells: 3, odour: 3, odor: 3, musty: 3 },
    cause: 'Smell: mould on coils or a dirty drain tray. Noise: loose panels, a fan hitting ice or debris, or worn fan bearings.',
    diy: ['Clean the filters; run Fan mode for 10 min after cooling to dry the coil.'],
    pro: 'A technician does a deep coil clean and checks the blower and fan motor.',
    time: '45–90 min', price: [500, 1200]
  },
  {
    id: 'ac-not-starting', kind: 'AC repair', title: 'AC not turning on',
    keys: { 'not turning on': 3, 'not starting': 3, 'wont start': 3, "won't start": 3, 'not switching on': 3, dead: 2, remote: 2, stabilizer: 3, stabiliser: 3, 'no display': 3 },
    cause: 'Dead remote batteries, a tripped MCB or stabiliser, or a fault in the PCB/capacitor.',
    diy: ['Replace the remote batteries; try the manual button on the indoor unit.', 'Check the AC’s MCB and stabiliser.'],
    pro: 'A technician tests the capacitor, PCB and wiring.',
    parts: ['Capacitor (₹300–700)', 'PCB repair (₹1,500–4,000)'],
    time: '45–90 min', price: [400, 2500]
  },
  {
    id: 'ac-service', kind: 'AC repair', title: 'AC service, installation or uninstall',
    keys: { service: 3, servicing: 3, 'jet wash': 3, 'jet service': 3, install: 3, installation: 3, uninstall: 3, shift: 2, shifting: 2, 'deep clean': 2, maintenance: 2, yearly: 1 },
    cause: 'Routine work.',
    diy: [],
    pro: 'Service: filter and coil jet wash plus a gas-pressure check. Installation includes mounting, piping and a vacuum test.',
    time: '45–120 min', price: [500, 1500]
  },

  /* ------------------------------------------------------------- Appliances */
  {
    id: 'fridge-not-cooling', kind: 'Appliance repair', title: 'Fridge not cooling',
    keys: { fridge: 3, refrigerator: 3, freezer: 2, 'not cooling': 3, 'not cold': 3, warm: 2, ice: 1, frost: 2, 'not working': 1 },
    cause: 'Blocked vents or a frosted evaporator, a failed thermostat or defrost sensor, a weak compressor relay, or a gas leak.',
    diy: ['Leave space behind the fridge; clean the back coil.', 'Don’t pack food against the inner vents.', 'Check the door seal closes on a sheet of paper.'],
    pro: 'A technician tests the thermostat, relay, defrost system and gas.',
    parts: ['Thermostat (₹300–800)', 'Relay / overload (₹200–500)', 'Gas charging (₹1,500–3,000)'],
    time: '45–90 min', price: [400, 3000]
  },
  {
    id: 'washer-problem', kind: 'Appliance repair', title: 'Washing machine not draining, spinning or leaking',
    keys: { 'washing machine': 3, washer: 2, drum: 2, 'not draining': 3, 'not spinning': 3, spin: 2, drain: 1, leaking: 1, 'error code': 2, door: 1, noise: 1 },
    cause: 'A blocked drain filter or hose is the most common cause; also a failed drain pump, door lock or worn belt.',
    diy: ['Unplug it, then clean the drain filter (front-bottom on front loaders) — keep a towel ready.', 'Check the drain hose isn’t kinked.'],
    pro: 'A technician replaces the pump, belt, door lock or inlet valve as needed.',
    parts: ['Drain pump (₹800–1,800)', 'Belt (₹300–600)'],
    time: '45–90 min', price: [400, 2000]
  },
  {
    id: 'geyser', kind: 'Appliance repair', title: 'Geyser / water heater not heating',
    keys: { geyser: 3, 'water heater': 3, heater: 2, 'no hot water': 3, 'not heating': 3, 'cold water': 2, element: 2 },
    cause: 'A burnt heating element, a failed thermostat, or a tripped thermal cut-out. Scale build-up makes it slow.',
    diy: ['Check the geyser’s switch and MCB; some have a reset button on the thermostat.'],
    pro: 'A technician replaces the element or thermostat and descales the tank.',
    parts: ['Element (₹400–900)', 'Thermostat (₹300–600)'],
    time: '45–90 min', price: [400, 1500],
    safety: 'If the geyser trips the MCB or gives a shock, switch it off and don’t use it until it’s checked.'
  },
  {
    id: 'microwave', kind: 'Appliance repair', title: 'Microwave not heating',
    keys: { microwave: 3, oven: 2, 'not heating': 3, 'turntable': 2, sparks: 1 },
    cause: 'A failed magnetron, diode, capacitor or door switch.',
    diy: ['Make sure the door closes fully; try a cup of water for 1 min.'],
    pro: 'A technician tests the high-voltage parts — these hold a dangerous charge even when unplugged.',
    time: '45–90 min', price: [400, 2000],
    safety: 'Never open a microwave’s case yourself.'
  },
  {
    id: 'ro-purifier', kind: 'Appliance repair', title: 'Water purifier (RO) issues',
    keys: { ro: 3, purifier: 3, 'water purifier': 3, aquaguard: 3, kent: 3, filter: 1, 'bad taste': 3, 'no water': 1 },
    cause: 'Filters and membrane due for change (every 6–12 months), or a low-pressure/pump issue.',
    diy: ['Check the inlet valve is open.'],
    pro: 'A technician services the unit and replaces filters/membrane.',
    parts: ['Filter set (₹800–1,500)', 'Membrane (₹1,200–2,500)'],
    time: '30–60 min', price: [400, 2500]
  },

  /* ------------------------------------------------------------- Cleaning */
  {
    id: 'deep-clean', kind: 'Cleaning', title: 'Home deep cleaning',
    keys: { 'deep clean': 3, 'deep cleaning': 3, 'full house': 3, 'whole house': 3, 'move in': 3, 'move out': 3, 'home cleaning': 3, house: 1, flat: 1 },
    cause: 'Cleaning job.',
    diy: [],
    pro: 'A team cleans floors, windows, kitchen and bathrooms with machines and chemicals they bring.',
    time: '4–8 hours', price: [2500, 6000]
  },
  {
    id: 'bathroom-kitchen-clean', kind: 'Cleaning', title: 'Bathroom or kitchen cleaning',
    keys: { bathroom: 2, kitchen: 2, tiles: 2, stains: 2, grease: 2, 'hard water': 3, chimney: 1 },
    cause: 'Cleaning job.',
    diy: [],
    pro: 'Descaling of tiles and fittings, degreasing of counters and cabinets.',
    time: '1.5–3 hours', price: [500, 1500]
  },
  {
    id: 'sofa-carpet', kind: 'Cleaning', title: 'Sofa, carpet or mattress cleaning',
    keys: { sofa: 3, carpet: 3, mattress: 3, couch: 3, upholstery: 3, curtains: 2 },
    cause: 'Cleaning job.',
    diy: [],
    pro: 'Shampoo and vacuum extraction; allow a few hours to dry.',
    time: '1–3 hours', price: [500, 2000]
  },

  /* ------------------------------------------------------------- Carpentry */
  {
    id: 'door-problem', kind: 'Carpentry', title: 'Door sticking, squeaking or not closing',
    keys: { door: 3, doors: 3, hinge: 3, hinges: 3, squeak: 3, squeaking: 3, stuck: 2, jammed: 3, 'not closing': 3, swollen: 2, sagging: 3 },
    cause: 'Loose or sagging hinges, swelling in damp weather, or a misaligned strike plate.',
    diy: ['Tighten the hinge screws; a drop of oil stops squeaks.'],
    pro: 'A carpenter re-hangs or planes the door and replaces hinges.',
    time: '30–90 min', price: [250, 800]
  },
  {
    id: 'lock-problem', kind: 'Carpentry', title: 'Lock or handle broken',
    keys: { lock: 3, locked: 2, 'locked out': 3, key: 2, handle: 2, latch: 3, 'door lock': 3, 'key stuck': 3 },
    cause: 'A worn lock mechanism, a misaligned latch or a broken key.',
    diy: [],
    pro: 'A carpenter repairs or replaces the lock or handle.',
    parts: ['Mortise lock (₹600–2,500)', 'Handle set (₹300–1,200)'],
    time: '30–60 min', price: [250, 900]
  },
  {
    id: 'furniture', kind: 'Carpentry', title: 'Furniture repair or assembly',
    keys: { furniture: 3, assemble: 3, assembly: 3, wardrobe: 3, cupboard: 3, drawer: 3, bed: 2, table: 2, chair: 2, shelf: 3, ikea: 3, channel: 2 },
    cause: 'Loose joints, worn drawer channels, or new flat-pack furniture.',
    diy: [],
    pro: 'A carpenter fixes joints, replaces channels and hinges, or assembles new furniture.',
    time: '1–3 hours', price: [300, 1500]
  },

  /* ------------------------------------------------------------- Painting */
  {
    id: 'damp-peeling', kind: 'Painting', title: 'Damp patches or peeling paint',
    keys: { damp: 3, dampness: 3, seepage: 3, peeling: 3, flaking: 3, fungus: 3, mould: 3, mold: 3, patches: 2, bubbles: 2, wall: 1, walls: 1, 'paint coming off': 3 },
    cause: 'Moisture coming through the wall — from a leaking pipe, the roof or the outside wall. Painting over it won’t last.',
    diy: [],
    pro: 'First find and fix the source (plumber or waterproofing), let the wall dry, then scrape, treat and repaint.',
    time: '1–3 days incl. drying', price: [1500, 6000]
  },
  {
    id: 'repaint', kind: 'Painting', title: 'Repainting a room or home',
    keys: { repaint: 3, repainting: 3, 'paint my': 3, 'paint the': 3, painting: 2, 'per sq ft': 3, 'sq ft': 2, room: 1, bedroom: 1, colour: 1 },
    cause: 'Painting job.',
    diy: [],
    pro: 'Prep (scraping, putty, primer) and two coats. Interior labour + paint is usually ₹12–25 per sq ft.',
    time: '1–3 days per room', price: [4000, 15000]
  },

  /* ------------------------------------------------------------- Pest control */
  {
    id: 'cockroaches', kind: 'Pest control', title: 'Cockroaches',
    keys: { cockroach: 3, cockroaches: 3, roach: 3, roaches: 3, kitchen: 1 },
    cause: 'Food, moisture and cracks around the kitchen and drains.',
    diy: ['Keep food sealed and drains covered at night.'],
    pro: 'Gel baiting in the kitchen and a spray in drains; a follow-up visit is usually included.',
    time: '1–2 hours', price: [900, 2000],
    safety: 'Keep children and pets away from treated areas for a few hours.'
  },
  {
    id: 'termites', kind: 'Pest control', title: 'Termites',
    // Where termites are found (door, furniture) counts towards termites, not carpentry.
    keys: { termite: 3, termites: 3, deemak: 3, 'white ants': 3, 'wood dust': 3, hollow: 2, mud: 1, wood: 1, door: 1, furniture: 1, cupboard: 1, wardrobe: 1, frame: 1 },
    cause: 'Subterranean termites enter through the ground and eat wood from inside.',
    diy: [],
    pro: 'Drill-fill-seal treatment along walls and woodwork; usually comes with a 1–5 year warranty.',
    time: '3–6 hours', price: [3000, 12000]
  },
  {
    id: 'bed-bugs', kind: 'Pest control', title: 'Bed bugs',
    keys: { 'bed bug': 3, 'bed bugs': 3, bedbug: 3, bedbugs: 3, khatmal: 3, bites: 2, mattress: 1 },
    cause: 'Brought in on luggage or furniture; they hide in mattress seams and bed joints.',
    diy: ['Wash bedding at high temperature and vacuum seams.'],
    pro: 'Two treatments about two weeks apart are usually needed.',
    time: '1–2 hours per visit', price: [1500, 3500]
  },
  {
    id: 'rodents', kind: 'Pest control', title: 'Rats or mice',
    keys: { rat: 3, rats: 3, mice: 3, mouse: 2, rodent: 3, rodents: 3, chuha: 3 },
    cause: 'Gaps around pipes and doors, and accessible food.',
    diy: ['Seal gaps with steel wool; store food in containers.'],
    pro: 'Baiting stations and entry-point proofing.',
    time: '1–2 hours', price: [1000, 2500]
  },

  /* ------------------------------------------------------------- Computers */
  {
    id: 'slow-computer', kind: 'Computer repair', title: 'Slow laptop or PC',
    keys: { slow: 2, hang: 3, hangs: 3, hanging: 3, lag: 3, freezing: 3, 'very slow': 3, laptop: 2, computer: 2, pc: 2, virus: 3 },
    cause: 'A nearly full or ageing hard disk, too many startup apps, low RAM, or malware.',
    diy: ['Free up 15%+ of disk space; disable startup apps you don’t need.'],
    pro: 'A technician cleans up software, scans for malware, or upgrades to an SSD/more RAM — the biggest speed boost.',
    parts: ['SSD 512 GB (₹2,500–4,500)', 'RAM 8 GB (₹1,500–2,500)'],
    time: '1–2 hours', price: [500, 5000]
  },
  {
    id: 'wifi-problem', kind: 'Computer repair', title: 'Wi-Fi or internet not working',
    keys: { wifi: 3, 'wi-fi': 3, internet: 3, router: 3, 'no internet': 3, 'not connecting': 3, network: 2, signal: 2, broadband: 3 },
    cause: 'Router needs a restart, an outage at the provider, or poor signal in parts of the home.',
    diy: ['Restart the router (unplug 30 s).', 'Check with your provider for an outage.'],
    pro: 'A technician reconfigures the router or adds a mesh/extender for dead zones.',
    time: '30–60 min', price: [300, 800]
  },
  {
    id: 'computer-dead', kind: 'Computer repair', title: 'Laptop or PC won’t turn on',
    keys: { 'wont turn on': 3, "won't turn on": 3, 'not turning on': 3, 'not starting': 2, 'black screen': 3, 'no display': 3, dead: 2, charging: 2, battery: 2, laptop: 2 },
    cause: 'Charger or battery failure, RAM not seated, or a motherboard fault.',
    diy: ['Try a different charger/outlet; hold the power button 30 s with the charger removed.'],
    pro: 'A technician diagnoses the power path, battery, RAM and board.',
    time: '1–2 hours', price: [500, 4000]
  }
];

export type AppIntent =
  | 'greeting' | 'thanks' | 'bye' | 'capabilities' | 'emergency'
  | 'pin' | 'sos' | 'cancel' | 'payment' | 'pass' | 'records' | 'how-it-works'
  | 'location' | 'login' | 'rating' | 'refund' | 'safety-pros' | 'book';

/** App-help intents. Scored like topics; phrases beat single words. */
export const INTENT_KEYS: Record<Exclude<AppIntent, 'greeting' | 'thanks' | 'bye' | 'book'>, Record<string, number>> = {
  emergency: { 'gas leak': 4, 'smell gas': 4, 'gas smell': 4, 'lpg leak': 4, 'cylinder leak': 4, 'electric shock': 4, 'got shocked': 4, 'getting shock': 4, shock: 2, fire: 4, 'on fire': 4, flood: 3, flooding: 3, emergency: 2 },
  pin: { pin: 3, 'arrival pin': 4, 'arrival code': 4, '4 digit': 3, 'four digit': 3, 'share the code': 3 },
  sos: { sos: 4, 'panic button': 4, 'feel unsafe': 4, unsafe: 3, harass: 4, harassment: 4, 'emergency contact': 4, 'emergency contacts': 4 },
  cancel: { cancel: 4, cancellation: 4, 'call off': 3 },
  payment: { pay: 3, payment: 3, upi: 3, cash: 3, 'how to pay': 4, receipt: 3, gpay: 3, phonepe: 3, paytm: 3, card: 1 },
  pass: { pass: 3, 'free quotes': 4, 'day pass': 4, 'monthly pass': 4, commission: 4, 'platform fee': 4, subscription: 3, 'as a pro': 3, earnings: 3, 'join as': 3, 'become a pro': 4, 'register as': 3 },
  records: { record: 3, records: 3, timeline: 3, proof: 3, evidence: 3, history: 2, warranty: 2 },
  'how-it-works': { 'how does this app work': 5, 'how does it work': 4, 'how it works': 4, 'how do i book': 4, 'how to book': 4, 'what is realitychain': 5, 'what is this app': 5, 'how does realitychain': 5, process: 2, steps: 2 },
  location: { location: 3, address: 3, gps: 3, 'wrong location': 4, 'change address': 4, 'my area': 2 },
  login: { login: 4, 'log in': 4, 'sign in': 4, otp: 3, 'verification code': 4, 'not getting code': 4, account: 2, logout: 3, 'log out': 3 },
  rating: { rate: 2, rating: 3, review: 3, feedback: 3, stars: 2 },
  refund: { refund: 4, 'money back': 4, overcharged: 4, 'charged extra': 4, dispute: 4, complaint: 3, 'bad service': 3, 'not happy': 3 },
  'safety-pros': { verified: 3, verification: 3, 'background check': 4, trust: 2, trustworthy: 3, 'is it safe': 3, genuine: 3 },
  capabilities: { 'what can you do': 5, 'who are you': 5, 'are you a bot': 5, 'what do you do': 4, help: 1 }
};

export const GREETINGS = ['hi', 'hii', 'hiii', 'hello', 'hey', 'heya', 'namaste', 'namaskar', 'hola', 'yo', 'good morning', 'good afternoon', 'good evening', 'hai', 'helo'];
export const THANKS = ['thanks', 'thank you', 'thankyou', 'thx', 'ty', 'dhanyavad', 'shukriya', 'great', 'ok thanks', 'cool', 'awesome', 'perfect'];
export const BYES = ['bye', 'goodbye', 'see you', 'cya'];
