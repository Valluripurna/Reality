import React, { createContext, ReactNode, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { stamp, useEvents } from './store/events';
import {
  CustomerProfile,
  EmergencyContact,
  JobStage,
  PaymentMethod,
  ProProfile,
  SavedPlace,
  ServiceJob,
  ServiceKind,
  STAGE_ORDER,
  STAGE_RANK,
  UserProfile,
  nextStage,
  normaliseStage
} from './types';
import { addCategory, matchService } from './matching';
import { DatabaseEngine, mergeJobs } from './db';
import { distanceKm, etaMinutes, Fix, Place } from './location';

/** A pro gets this many free job claims/quotes before a pass is required. */
export const FREE_ACCEPTS = 10;

/** Private arrival PIN: created only once a price is agreed. */
function newPin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export type RequestData = {
  title: string;
  kind: ServiceKind;
  detail: string;
  urgency: 'Standard' | 'Urgent';
  imageUri?: string;
  address?: string;
  /** Where the work is. Defaults to the customer's current position. */
  lat?: number;
  lng?: number;
  preferredProPhone?: string;
  preferredProName?: string;
  /** Optional price the customer suggests; pros can accept it or quote their own. */
  budget?: number;
};

export type ActionResult = { ok: boolean; reason?: string };

/**
 * 'auto'     — background GPS update: never overwrites an address the user typed.
 * 'explicit' — the user tapped "use my current location": always replaces it.
 */
export type LocationMode = 'auto' | 'explicit';

type Market = {
  profile: UserProfile | null;
  ready: boolean;
  /** Every job this user is party to: booked by them, or open/assigned to them as a pro. */
  jobs: ServiceJob[];
  /** The open pool, for the pro's request feed. */
  openJobs: ServiceJob[];
  setProfile: (p: UserProfile) => void;
  updateProfile: (patch: Partial<UserProfile>) => void;
  /** Record a GPS fix (and, if known, its address) on the signed-in profile. */
  applyLocation: (fix: Fix, place: Place | null, mode: LocationMode) => void;
  /** Save an address the user chose or typed; never overwritten by background GPS. */
  setManualAddress: (address: string, short?: string, coords?: { lat: number; lng: number } | null) => void;
  updateCustomerPlaces: (places: SavedPlace[]) => void;
  updateEmergencyContacts: (contacts: EmergencyContact[]) => void;
  toggleProOnline: (status?: boolean) => void;
  toggleProGps: (status?: boolean) => void;
  activatePass: (passType: 'Day' | 'Monthly') => void;
  addCustomCategory: (cat: string) => void;
  addCustomService: (title: string, baseRate: number, description?: string) => void;
  removeCustomService: (id: string) => void;
  verifyAadhaarDocument: (imageUri: string) => { isMatch: boolean; message: string };
  logout: () => void;
  submitProBid: (jobId: string, amount: number, note?: string) => ActionResult;
  acceptProBid: (jobId: string, proPhone: string, proName: string, amount: number) => boolean;
  /** A pro accepts the price the customer suggested; that completes the agreement. */
  acceptBudget: (jobId: string) => ActionResult;
  declineProBid: (jobId: string, proPhone: string) => boolean;
  cancelJob: (id: string) => ActionResult;
  syncGlobalJobs: () => Promise<ServiceJob[]>;
  estimate: (kind: ServiceKind, urgency: 'Standard' | 'Urgent', imageUri?: string) => ReturnType<typeof matchService>;
  request: (data: RequestData) => string;
  advance: (id: string, pin?: string) => boolean;
  markPaid: (id: string, method: PaymentMethod) => boolean;
  rate: (id: string, rating: number, comment?: string) => void;
  getJob: (id: string) => ServiceJob | undefined;
};

const Ctx = createContext<Market | null>(null);

export function phoneKey(phone?: string) {
  return (phone ?? '').replace(/[^0-9]/g, '').slice(-10);
}

/** Timeline copy for a stage, written into the customer's proof record. */
export function stageLabel(stage: JobStage, proName?: string): string {
  const who = proName || 'Your pro';
  switch (stage) {
    case 'Assigned': return `${who} accepted the request`;
    case 'On the way': return `${who} is on the way`;
    case 'In progress': return 'Work started after PIN check';
    case 'Completed': return 'Work marked complete';
    case 'Cancelled': return 'Booking cancelled';
    default: return 'Looking for an available pro';
  }
}

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const { create, addItem, setStatus, switchUser, events } = useEvents();
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [pool, setPool] = useState<ServiceJob[]>([]);
  const [ready, setReady] = useState(false);

  // Refs mirror state so callbacks and timers never act on a stale copy.
  const profileRef = useRef<UserProfile | null>(null);
  profileRef.current = profile;
  const poolRef = useRef<ServiceJob[]>([]);
  poolRef.current = pool;
  const hydrated = useRef(false);
  /** Registered pros (with their live positions), refreshed alongside jobs. */
  const knownPros = useRef<ProProfile[]>([]);
  const refreshPros = () => DatabaseEngine.loadRegisteredPros().then(p => { knownPros.current = p; }).catch(() => {});

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const phone = await DatabaseEngine.getActivePhone();
      const [p, jobs] = await Promise.all([
        phone ? DatabaseEngine.loadProfile(phone) : Promise.resolve(null),
        DatabaseEngine.loadJobs()
      ]);
      if (cancelled) return;
      if (p) {
        setProfileState(p);
        profileRef.current = p;
      }
      setPool((jobs ?? []).map(j => ({ ...j, stage: normaliseStage(j.stage) })));
      refreshPros();
      hydrated.current = true;
      setReady(true);
    })();
    return () => { cancelled = true; };
  }, []);

  // Evidence timelines follow the signed-in account.
  useEffect(() => {
    if (!ready) return;
    switchUser(profile?.phone ?? null);
  }, [ready, profile?.phone, switchUser]);

  // Persist only after hydration, so an empty pre-load state never overwrites storage.
  useEffect(() => {
    if (hydrated.current && profile) DatabaseEngine.saveProfile(profile);
  }, [profile]);

  useEffect(() => {
    if (hydrated.current) DatabaseEngine.saveJobs(pool);
  }, [pool]);

  /**
   * Keep the customer's proof record complete. The pro moves the job forward
   * on *their* phone, so those steps reach this device only via the shared
   * job. Whenever bookings or records change, write any stage or quote the
   * booking has reached but the record is missing. Ids are deterministic, so
   * this never duplicates an entry written locally.
   */
  useEffect(() => {
    if (!profile || profile.role !== 'customer') return;
    const me = phoneKey(profile.phone);
    for (const job of pool) {
      if (phoneKey(job.customerPhone) !== me) continue;
      const ev = events.find(e => e.id === job.eventId);
      if (!ev) continue;
      const has = new Set(ev.items.map(i => i.id));
      for (const bid of job.bids ?? []) {
        const id = `${job.id}-bid-${phoneKey(bid.proPhone)}-${bid.bidAmount}`;
        if (!has.has(id)) {
          addItem(job.eventId, { id, kind: 'Message', title: `${bid.proName} quoted ₹${bid.bidAmount}`, detail: bid.note || 'Quote received', at: bid.timestamp ? stamp(bid.timestamp) : 'Now' });
        }
      }
      const reached = job.stage === 'Cancelled' ? ['Cancelled' as JobStage] : STAGE_ORDER.slice(1, STAGE_RANK[job.stage] + 1);
      for (const stage of reached) {
        const id = `${job.id}-stage-${stage}`;
        if (has.has(id)) continue;
        const when = job.stageTimes?.[stage] ?? (stage === 'In progress' ? job.startedWorkAt : stage === 'Completed' ? job.completedWorkAt : undefined);
        addItem(job.eventId, {
          id,
          kind: stage === 'Completed' ? 'Verification' : 'Action',
          title: stageLabel(stage, job.proName),
          detail: stage === 'Completed' ? `${job.actualDurationFormatted ? `Took ${job.actualDurationFormatted}. ` : ''}Confirm payment and rate your pro.` : stage === 'Assigned' ? `Agreed price ₹${job.estimate}` : 'Status update from your pro',
          at: when ? stamp(when) : 'Now',
          verified: stage === 'Completed'
        });
      }
      if ((job.stage === 'Completed' || job.stage === 'Cancelled') && ev.status !== 'Resolved') setStatus(job.eventId, 'Resolved');
    }
  }, [pool, events, profile, addItem, setStatus]);

  /**
   * Live tracking: when a pro's position changes, stamp it on every job they
   * are actively working so the customer's map and ETA follow the real pro.
   */
  useEffect(() => {
    if (profile?.role !== 'pro' || profile.liveLat == null || profile.liveLng == null) return;
    const me = phoneKey(profile.phone);
    const here = { lat: profile.liveLat, lng: profile.liveLng };
    let changed = false;
    const next = poolRef.current.map(j => {
      if (phoneKey(j.proPhone) !== me || !['Assigned', 'On the way', 'In progress'].includes(j.stage)) return j;
      if (j.proLat != null && j.proLng != null && distanceKm(here, { lat: j.proLat, lng: j.proLng }) < 0.015) return j;
      changed = true;
      const km = j.lat != null && j.lng != null ? distanceKm(here, { lat: j.lat, lng: j.lng }) : j.distanceKm;
      return { ...j, proLat: here.lat, proLng: here.lng, proLocationAt: new Date().toISOString(), distanceKm: Number(km.toFixed(1)), eta: `${etaMinutes(km)} min` };
    });
    if (changed) {
      poolRef.current = next;
      setPool(next);
    }
  }, [profile?.role, profile?.phone, profile?.liveLat, profile?.liveLng]);

  const value = useMemo<Market>(() => {
    const myPhone = phoneKey(profile?.phone);
    const isPro = profile?.role === 'pro';

    // Visibility: a customer sees what they booked; a pro sees the open pool
    // (minus their own requests and quotes the customer declined) plus jobs
    // assigned to them. Nobody sees a stranger's booking or its PIN.
    const visibleJobs = !profile
      ? []
      : isPro
        ? pool.filter(j =>
            phoneKey(j.proPhone) === myPhone ||
            (j.stage === 'Matching' && phoneKey(j.customerPhone) !== myPhone && !(j.declinedPhones ?? []).includes(myPhone)))
        : pool.filter(j => phoneKey(j.customerPhone) === myPhone);

    const openJobs = pool.filter(j => j.stage === 'Matching');

    function evidenceId(jobId: string, suffix: string) {
      return `${jobId}-${suffix}`;
    }

    /** Replace one job and (optionally) write a timeline entry with a stable id. */
    function updateJob(id: string, mutate: (job: ServiceJob) => ServiceJob, evidence?: { key: string; title: string; detail: string; verified?: boolean }) {
      const current = poolRef.current.find(j => j.id === id);
      if (!current) return;
      let updated = mutate(current);
      if (updated.stage !== current.stage) {
        updated = { ...updated, stageTimes: { ...current.stageTimes, [updated.stage]: new Date().toISOString() } };
      }
      const next = poolRef.current.map(j => (j.id === id ? updated : j));
      poolRef.current = next;
      setPool(next);
      if (evidence) {
        addItem(current.eventId, {
          id: evidenceId(id, evidence.key),
          kind: evidence.verified ? 'Verification' : 'Action',
          title: evidence.title,
          detail: evidence.detail,
          at: 'Now',
          verified: evidence.verified
        });
      }
    }

    function patchProfile(patch: Partial<UserProfile>) {
      const current = profileRef.current;
      if (!current) return;
      const merged = { ...current, ...patch } as UserProfile;
      profileRef.current = merged;
      setProfileState(merged);
    }

    function hasClaimsLeft(p: ProProfile) {
      if (p.subscriptionActive && p.passExpiresAt && new Date(p.passExpiresAt).getTime() > Date.now()) return true;
      return (p.freeAcceptsRemaining ?? 0) > 0;
    }

    function spendClaim(p: ProProfile) {
      const passValid = p.subscriptionActive && p.passExpiresAt && new Date(p.passExpiresAt).getTime() > Date.now();
      if (!passValid) {
        patchProfile({ freeAcceptsRemaining: Math.max(0, (p.freeAcceptsRemaining ?? 0) - 1), subscriptionActive: false } as Partial<ProProfile>);
      }
    }

    return {
      profile,
      ready,
      jobs: visibleJobs,
      openJobs,

      setProfile(p) {
        if (p.role === 'customer') {
          const cust: CustomerProfile = {
            savedPlaces: [],
            emergencyContacts: [],
            preferredPayment: 'UPI',
            quietServicePref: false,
            ...p
          };
          profileRef.current = cust;
          setProfileState(cust);
        } else {
          const pro: ProProfile = {
            proLevel: 'Bronze Pro',
            serviceRadiusKm: 10,
            completedJobsCount: 0,
            // No invented UPI handle: the pro adds their own in Payouts.
            // No fake coordinates: a pro appears on maps once their phone reports a real fix.
            ...p,
            isOnline: p.isOnline ?? true,
            freeAcceptsRemaining: p.freeAcceptsRemaining ?? FREE_ACCEPTS,
            monthlyFreeAcceptsRemaining: p.monthlyFreeAcceptsRemaining ?? 0,
            subscriptionActive: p.subscriptionActive ?? false,
            gpsEnabled: p.gpsEnabled ?? true
          };
          profileRef.current = pro;
          setProfileState(pro);
        }
      },

      updateProfile(patch) {
        patchProfile(patch);
      },

      applyLocation(fix, place, mode) {
        const current = profileRef.current;
        if (!current) return;
        const patch: Partial<UserProfile> = {
          liveLat: fix.lat,
          liveLng: fix.lng,
          locationAccuracy: fix.accuracy,
          locationUpdatedAt: new Date(fix.timestamp).toISOString()
        };
        const mayReplaceAddress = mode === 'explicit' || current.addressSource !== 'manual' || !current.address;
        if (place && mayReplaceAddress) {
          patch.locationName = place.short;
          patch.address = place.full;
          patch.addressSource = 'gps';
        }
        patchProfile(patch);
      },

      setManualAddress(address, short, coords) {
        const text = address.trim();
        if (!text) return;
        patchProfile({
          address: text,
          locationName: short || text.split(',')[0],
          addressSource: 'manual',
          ...(coords ? { liveLat: coords.lat, liveLng: coords.lng, locationAccuracy: null, locationUpdatedAt: new Date().toISOString() } : {})
        });
      },

      updateCustomerPlaces(places) {
        if (profileRef.current?.role === 'customer') patchProfile({ savedPlaces: places });
      },

      updateEmergencyContacts(contacts) {
        if (profileRef.current?.role === 'customer') patchProfile({ emergencyContacts: contacts });
      },

      toggleProOnline(status) {
        const current = profileRef.current;
        if (current?.role !== 'pro') return;
        patchProfile({ isOnline: status ?? !current.isOnline });
      },

      toggleProGps(status) {
        const current = profileRef.current;
        if (current?.role !== 'pro') return;
        patchProfile({ gpsEnabled: status ?? !current.gpsEnabled });
      },

      activatePass(passType) {
        if (profileRef.current?.role !== 'pro') return;
        const expires = new Date();
        expires.setDate(expires.getDate() + (passType === 'Day' ? 1 : 30));
        patchProfile({ subscriptionActive: true, passType, passExpiresAt: expires.toISOString() } as Partial<ProProfile>);
      },

      addCustomCategory(cat) {
        addCategory(cat);
      },

      addCustomService(title, baseRate, description) {
        const current = profileRef.current;
        if (current?.role !== 'pro') return;
        const item = {
          id: `cs-${Date.now()}`,
          title: title.trim(),
          category: title.trim(),
          baseRate: Math.max(0, Math.round(baseRate)),
          description: description?.trim()
        };
        addCategory(item.title);
        patchProfile({ customServices: [...(current.customServices ?? []), item] } as Partial<ProProfile>);
      },

      removeCustomService(id) {
        const current = profileRef.current;
        if (current?.role !== 'pro') return;
        patchProfile({ customServices: (current.customServices ?? []).filter(c => c.id !== id) } as Partial<ProProfile>);
      },

      /**
       * Records the uploaded ID for manual review. There is no document parser
       * behind this, so it never claims the ID is verified.
       */
      verifyAadhaarDocument(imageUri) {
        const current = profileRef.current;
        const message = 'ID received. Our team will review it — your verified badge appears once approved.';
        if (current?.role === 'pro') {
          patchProfile({
            idProofUri: imageUri,
            aadhaarVerified: false,
            aadhaarMobileLinked: current.phone,
            verificationMessage: message
          } as Partial<ProProfile>);
        }
        return { isMatch: false, message };
      },

      estimate(kind, urgency, imageUri) {
        const p = profileRef.current;
        const here = p?.liveLat != null && p?.liveLng != null ? { lat: p.liveLat, lng: p.liveLng } : null;
        return matchService(kind, urgency, imageUri, knownPros.current, here);
      },

      request(data) {
        const id = `${Date.now()}`;
        const eventId = create(data.title, data.kind);
        const p = profileRef.current;
        const lat = data.lat ?? p?.liveLat;
        const lng = data.lng ?? p?.liveLng;
        const here = lat != null && lng != null ? { lat, lng } : null;
        // Used only for travel distance/ETA and the pro's private context; the
        // price is never shown or fixed — the two sides agree on it.
        const match = matchService(data.kind, data.urgency, data.imageUri, knownPros.current, here);
        const budget = data.budget != null && data.budget > 0 ? Math.round(data.budget) : undefined;

        addItem(eventId, {
          id: evidenceId(id, 'request'),
          kind: 'Action',
          title: 'Service request posted',
          detail: `${data.kind} · ${data.urgency}${budget ? ` · customer budget ₹${budget}` : ''} · waiting for quotes`,
          at: 'Now',
          imageUri: data.imageUri
        });

        const newJob: ServiceJob = {
          id,
          eventId,
          ...data,
          customerPhone: profileRef.current?.phone,
          customerName: profileRef.current?.name,
          estimate: 0,
          budget,
          stage: 'Matching',
          eta: match.eta,
          distanceKm: match.distanceKm,
          complexityMultiplier: match.complexityMultiplier,
          workDurationEst: match.workDurationEst,
          baseMarketRate: match.basePrice,
          aiLaborCost: match.aiLaborCost,
          aiPartsCost: match.aiPartsCost,
          distanceFee: match.distanceCharge,
          timeFee: match.timeFee,
          lat: here?.lat,
          lng: here?.lng,
          createdAt: new Date().toISOString()
        };

        const next = [newJob, ...poolRef.current.filter(j => j.id !== id)];
        poolRef.current = next;
        setPool(next);
        return id;
      },

      submitProBid(jobId, amount, note) {
        const current = profileRef.current;
        if (current?.role !== 'pro') return { ok: false, reason: 'Only service pros can send quotes.' };
        if (!Number.isFinite(amount) || amount <= 0) return { ok: false, reason: 'Enter a valid quote amount.' };
        if (amount > 1000000) return { ok: false, reason: 'That amount looks too high.' };
        if (!current.isOnline) return { ok: false, reason: 'Go online to send quotes.' };

        const job = poolRef.current.find(j => j.id === jobId);
        if (!job || job.stage !== 'Matching') return { ok: false, reason: 'This request is no longer available.' };
        if (job.customerPhone && phoneKey(job.customerPhone) === phoneKey(current.phone)) {
          return { ok: false, reason: 'You cannot quote on your own request.' };
        }
        const alreadyBid = (job.bids ?? []).some(b => phoneKey(b.proPhone) === phoneKey(current.phone));
        if (!alreadyBid && !hasClaimsLeft(current)) {
          return { ok: false, reason: 'You have used your free claims. Get a pass to keep quoting.' };
        }

        const bids = [
          ...(job.bids ?? []).filter(b => phoneKey(b.proPhone) !== phoneKey(current.phone)),
          {
            proName: current.name,
            proPhone: current.phone ?? '',
            bidAmount: Math.round(amount),
            note: note?.trim() || 'Can start right away with my own tools.',
            // Shared with the customer only if this quote is accepted.
            proUpi: current.payoutUpi,
            timestamp: new Date().toISOString()
          }
        ];
        updateJob(jobId, j => ({ ...j, bids, hasBids: true, lastBidAmount: Math.round(amount) }));
        if (!alreadyBid) spendClaim(current);
        return { ok: true };
      },

      acceptProBid(jobId, proPhone, proName, amount) {
        if (profileRef.current?.role !== 'customer') return false;
        if (!Number.isFinite(amount) || amount <= 0) return false;
        const job = poolRef.current.find(j => j.id === jobId);
        if (!job || job.stage !== 'Matching') return false;
        const bid = (job.bids ?? []).find(b => phoneKey(b.proPhone) === phoneKey(proPhone));

        updateJob(jobId, j => ({
          ...j,
          stage: 'Assigned',
          proName,
          proPhone,
          estimate: amount,
          // Both sides have now agreed, so the arrival PIN exists.
          arrivalPin: newPin(),
          proUpi: bid?.proUpi
        }), {
          key: 'stage-Assigned',
          title: `You accepted ${proName}'s quote of ₹${amount}`,
          detail: 'Your arrival PIN is ready. Share it only when they reach you.',
          verified: true
        });
        return true;
      },

      acceptBudget(jobId) {
        const current = profileRef.current;
        if (current?.role !== 'pro') return { ok: false, reason: 'Only service pros can accept a price.' };
        const job = poolRef.current.find(j => j.id === jobId);
        if (!job || job.stage !== 'Matching') return { ok: false, reason: 'This request is no longer available.' };
        if (!job.budget || job.budget <= 0) return { ok: false, reason: 'This customer has not suggested a price.' };
        if (job.customerPhone && phoneKey(job.customerPhone) === phoneKey(current.phone)) {
          return { ok: false, reason: 'You cannot accept your own request.' };
        }
        if (!hasClaimsLeft(current)) return { ok: false, reason: 'You have used your free claims. Get a pass to keep accepting work.' };

        updateJob(jobId, j => ({
          ...j,
          stage: 'Assigned',
          proName: current.name,
          proPhone: current.phone,
          estimate: job.budget!,
          arrivalPin: newPin(),
          proUpi: current.payoutUpi
        }), {
          key: 'stage-Assigned',
          title: `You accepted the customer's ₹${job.budget}`,
          detail: 'Agreed price locked. Ask for their PIN when you arrive.',
          verified: true
        });
        spendClaim(current);
        return { ok: true };
      },

      declineProBid(jobId, proPhone) {
        const job = poolRef.current.find(j => j.id === jobId);
        if (!job || job.stage !== 'Matching') return false;
        const key = phoneKey(proPhone);
        updateJob(jobId, j => {
          const bids = (j.bids ?? []).filter(b => phoneKey(b.proPhone) !== key);
          return {
            ...j,
            bids,
            hasBids: bids.length > 0,
            lastBidAmount: bids.at(-1)?.bidAmount,
            declinedPhones: [...new Set([...(j.declinedPhones ?? []), proPhone])]
          };
        });
        return true;
      },

      cancelJob(id) {
        const current = profileRef.current;
        const job = poolRef.current.find(j => j.id === id);
        if (!job) return { ok: false, reason: 'Booking not found.' };
        if (current?.role !== 'customer' || phoneKey(job.customerPhone) !== phoneKey(current.phone)) {
          return { ok: false, reason: 'Only the person who booked can cancel.' };
        }
        if (job.stage !== 'Matching' && job.stage !== 'Assigned') {
          return { ok: false, reason: 'This booking can no longer be cancelled from the app.' };
        }
        updateJob(id, j => ({ ...j, stage: 'Cancelled', cancelledAt: new Date().toISOString() }), {
          key: 'stage-Cancelled',
          title: 'Booking cancelled',
          detail: job.proName ? `${job.proName} has been released from this job.` : 'Cancelled before a pro was assigned.'
        });
        setStatus(job.eventId, 'Resolved');
        return { ok: true };
      },

      advance(id, pin) {
        const current = profileRef.current;
        const job = poolRef.current.find(j => j.id === id);
        if (!job) return false;
        const byPro = current?.role === 'pro' && phoneKey(job.proPhone) === phoneKey(current.phone);
        if (!byPro) return false;
        if (job.stage === 'Completed' || job.stage === 'Cancelled') return false;
        if (job.stage === 'On the way' && (!job.arrivalPin || pin !== job.arrivalPin)) return false;

        const target = nextStage(job.stage);
        const now = Date.now();
        updateJob(id, j => {
          let { startedWorkAt, completedWorkAt, actualDurationFormatted } = j;
          if (target === 'In progress' && !startedWorkAt) startedWorkAt = now;
          if (target === 'Completed') {
            completedWorkAt = now;
            const totalMins = Math.max(1, Math.round((now - (startedWorkAt ?? now - 45 * 60000)) / 60000));
            const hrs = Math.floor(totalMins / 60);
            const mins = totalMins % 60;
            actualDurationFormatted = hrs > 0 ? `${hrs} hr ${mins} min` : `${mins} min`;
          }
          return { ...j, stage: target, startedWorkAt, completedWorkAt, actualDurationFormatted };
        }, {
          key: `stage-${target}`,
          title: stageLabel(target, job.proName),
          detail: target === 'Completed' ? 'Confirm payment and rate your pro to close the record.' : 'Status update from your pro',
          verified: target === 'Completed'
        });

        if (target === 'Completed') {
          setStatus(job.eventId, 'Resolved');
          if (current?.role === 'pro') patchProfile({ completedJobsCount: (current.completedJobsCount ?? 0) + 1 } as Partial<ProProfile>);
        }
        return true;
      },

      markPaid(id, method) {
        const job = poolRef.current.find(j => j.id === id);
        if (!job || job.paidAt || job.stage !== 'Completed') return false;
        const ref = `RC${Date.now().toString().slice(-8)}`;
        updateJob(id, j => ({ ...j, paidAt: new Date().toISOString(), paymentMethod: method, paymentRef: ref }), {
          key: 'paid',
          title: `Paid ₹${job.estimate} by ${method}`,
          detail: `Receipt ${ref}`,
          verified: true
        });
        return true;
      },

      rate(id, rating, comment) {
        const job = poolRef.current.find(j => j.id === id);
        if (!job) return;
        updateJob(id, j => ({ ...j, rating, ratingComment: comment }), {
          key: 'rating',
          title: `Rated ${rating} out of 5`,
          detail: comment?.trim() || 'Thanks for closing the loop.'
        });
      },

      logout() {
        profileRef.current = null;
        setProfileState(null);
        // The shared job pool is everyone's; only the session ends.
        DatabaseEngine.clearActivePhone().catch(() => {});
      },

      async syncGlobalJobs() {
        const [latest] = await Promise.all([DatabaseEngine.loadJobs(), refreshPros()]);
        // Merge rather than replace: storage may not yet hold a write made a moment ago.
        const merged = mergeJobs(poolRef.current, latest);
        poolRef.current = merged;
        setPool(merged);
        return merged;
      },

      getJob(id) {
        return visibleJobs.find(j => j.id === id);
      }
    } as Market;
  }, [profile, ready, pool, create, addItem, setStatus]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMarketplace() {
  const c = useContext(Ctx);
  if (!c) throw new Error('Marketplace provider missing');
  return c;
}
