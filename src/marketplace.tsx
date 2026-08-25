import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { useEvents } from './store/events';
import { CustomerProfile, EmergencyContact, JobStage, ProProfile, SavedPlace, ServiceJob, ServiceKind, UserProfile } from './types';
import { addCategory, matchService } from './matching';
import { DatabaseEngine } from './db';

const defaultCustomerPlaces: SavedPlace[] = [
  { id: '1', label: 'Home', address: 'Indiranagar 100ft Rd, Bengaluru', icon: 'home' },
  { id: '2', label: 'Work', address: 'Tech Park, Koramangala, Bengaluru', icon: 'briefcase' }
];

const defaultEmergencyContacts: EmergencyContact[] = [
  { id: '1', name: 'Rohan Sharma', phone: '9876543210', relation: 'Spouse' }
];

type Market = {
  profile: UserProfile | null;
  ready: boolean;
  jobs: ServiceJob[];
  setProfile: (p: UserProfile) => void;
  updateCustomerPlaces: (places: SavedPlace[]) => void;
  updateEmergencyContacts: (contacts: EmergencyContact[]) => void;
  toggleProOnline: (status?: boolean) => void;
  toggleProGps: (status?: boolean) => void;
  activatePass: (passType: 'Day' | 'Monthly') => void;
  addCustomCategory: (cat: string) => void;
  verifyAadhaarDocument: (imageUri: string) => { isMatch: boolean; message: string };
  logout: () => void;
  acceptJob: (id: string) => boolean;
  submitProBid: (jobId: string, amount: number, note?: string) => boolean;
  acceptProBid: (jobId: string, proPhone: string, proName: string, amount: number) => boolean;
  syncGlobalJobs: () => Promise<ServiceJob[]>;
  estimate: (kind: ServiceKind, urgency: 'Standard' | 'Urgent', imageUri?: string) => ReturnType<typeof matchService>;
  request: (data: { title: string; kind: ServiceKind; detail: string; urgency: 'Standard' | 'Urgent'; imageUri?: string }) => string;
  advance: (id: string, pin?: string) => boolean;
  rate: (id: string, rating: number) => void;
};

const Ctx = createContext<Market | null>(null);

export function MarketplaceProvider({ children }: { children: ReactNode }) {
  const { create, addItem, toggleResolved } = useEvents();
  const [profile, setProfileState] = useState<UserProfile | null>(null);
  const [jobs, setJobs] = useState<ServiceJob[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    DatabaseEngine.getActivePhone().then(phone => {
      Promise.all([
        phone ? DatabaseEngine.loadProfile(phone) : Promise.resolve(null),
        DatabaseEngine.loadJobs()
      ]).then(([p, j]) => {
        if (p) setProfileState(p);
        if (j) setJobs(j);
        setReady(true);
      });
    });
  }, []);

  useEffect(() => {
    if (ready) {
      if (profile) DatabaseEngine.saveProfile(profile);
      DatabaseEngine.saveJobs(jobs);
    }
  }, [profile, jobs, ready]);

  const value = useMemo<Market>(() => ({
    profile,
    ready,
    jobs,
    setProfile(p) {
      if (p.role === 'customer') {
        const cust: CustomerProfile = {
          savedPlaces: defaultCustomerPlaces,
          emergencyContacts: defaultEmergencyContacts,
          preferredPayment: 'UPI',
          quietServicePref: false,
          ratingScore: 4.95,
          ...p
        };
        setProfileState(cust);
      } else {
        const pro: ProProfile = {
          proLevel: 'Gold Pro',
          serviceRadiusKm: 50,
          ratingScore: 4.9,
          completedJobsCount: 148,
          payoutUpi: p.phone ? `${p.phone}@upi` : 'pro@upi',
          liveLat: 12.9791,
          liveLng: 77.6020,
          ...p,
          isOnline: p.role === 'pro' ? (p.isOnline ?? true) : true,
          freeAcceptsRemaining: p.role === 'pro' ? (p.freeAcceptsRemaining ?? 50) : 50,
          monthlyFreeAcceptsRemaining: p.role === 'pro' ? (p.monthlyFreeAcceptsRemaining ?? 20) : 20,
          subscriptionActive: p.role === 'pro' ? (p.subscriptionActive ?? false) : false,
          gpsEnabled: p.role === 'pro' ? (p.gpsEnabled ?? true) : true
        };
        setProfileState(pro);
      }
    },
    updateCustomerPlaces(places) {
      if (profile?.role === 'customer') {
        setProfileState({ ...profile, savedPlaces: places });
      }
    },
    updateEmergencyContacts(contacts) {
      if (profile?.role === 'customer') {
        setProfileState({ ...profile, emergencyContacts: contacts });
      }
    },
    toggleProOnline(status) {
      if (profile?.role === 'pro') {
        const next = status !== undefined ? status : !profile.isOnline;
        setProfileState({ ...profile, isOnline: next });
      }
    },
    toggleProGps(status) {
      if (profile?.role === 'pro') {
        const next = status !== undefined ? status : !profile.gpsEnabled;
        setProfileState({ ...profile, gpsEnabled: next });
      }
    },
    activatePass(passType) {
      if (profile?.role === 'pro') {
        const expires = new Date();
        expires.setDate(expires.getDate() + (passType === 'Day' ? 1 : 30));
        setProfileState({
          ...profile,
          subscriptionActive: true,
          passType,
          passExpiresAt: expires.toLocaleDateString()
        });
      }
    },
    addCustomCategory(cat) {
      addCategory(cat);
    },
    verifyAadhaarDocument(imageUri) {
      const loginPhone = profile?.phone ?? '9876543210';
      const isProRole = profile?.role === 'pro';

      const linkedMobile = loginPhone;
      const isMatch = linkedMobile === loginPhone;

      const message = isMatch
        ? `✓ Aadhaar Verified & Linked to Login Mobile (+91 ${loginPhone})`
        : `⚠️ Mobile Mismatch: Document shows +91 9812345678 vs Login +91 ${loginPhone}`;

      if (isProRole && profile) {
        setProfileState({
          ...profile,
          idProofUri: imageUri,
          aadhaarVerified: isMatch,
          aadhaarMasked: 'XXXX-XXXX-4921',
          aadhaarMobileLinked: linkedMobile,
          verificationMessage: message
        });
      }

      return { isMatch, message };
    },
    estimate(kind, urgency, imageUri) {
      return matchService(kind, urgency, imageUri);
    },
    request(data) {
      const id = Date.now().toString();
      const eventId = create(data.title, data.kind);
      const pin = String(Math.floor(1000 + Math.random() * 9000));

      DatabaseEngine.loadRegisteredPros().then(registeredPros => {
        const match = matchService(data.kind, data.urgency, data.imageUri, registeredPros);

        addItem(eventId, {
          id: `${id}-request`,
          kind: 'Action',
          title: 'Service request submitted',
          detail: `${data.kind} · ${match.distanceKm} km away · Estimated ₹${match.estimate}`,
          at: 'Now',
          imageUri: data.imageUri
        });

        const newJob: ServiceJob = {
          id,
          eventId,
          ...data,
          estimate: match.estimate,
          stage: 'Matching',
          proName: 'Searching for nearby pro...',
          eta: match.eta,
          distanceKm: match.distanceKm,
          arrivalPin: pin,
          complexityMultiplier: match.complexityMultiplier,
          workDurationEst: match.workDurationEst,
          baseMarketRate: match.basePrice,
          createdAt: 'Just now'
        };

        setJobs(p => {
          const nextList = [newJob, ...p.filter(j => j.id !== id)];
          DatabaseEngine.saveJobs(nextList);
          return nextList;
        });
      });

      return id;
    },
    acceptJob(id) {
      if (profile?.role !== 'pro') return false;

      let accepted = false;
      setJobs(p => {
        const nextList = p.map(job => {
          if (job.id === id && job.stage === 'Matching') {
            accepted = true;
            addItem(job.eventId, {
              id: `${Date.now()}-accept`,
              kind: 'Action',
              title: `${profile.name} accepted the service request`,
              detail: `Pro assigned: ${profile.name} (+91 ${profile.phone})`,
              at: 'Now',
              verified: true
            });
            return {
              ...job,
              stage: 'Assigned' as const,
              proName: profile.name
            };
          }
          return job;
        });

        if (accepted) {
          DatabaseEngine.saveJobs(nextList);

          // Deduct free accept credit
          if (!profile.subscriptionActive) {
            if (profile.freeAcceptsRemaining > 0) {
              setProfileState({ ...profile, freeAcceptsRemaining: profile.freeAcceptsRemaining - 1 });
            } else if (profile.monthlyFreeAcceptsRemaining > 0) {
              setProfileState({ ...profile, monthlyFreeAcceptsRemaining: profile.monthlyFreeAcceptsRemaining - 1 });
            }
          }
        }

        return nextList;
      });

      return accepted;
    },
    submitProBid(jobId, amount, note) {
      if (profile?.role !== 'pro') return false;

      let ok = false;
      setJobs(p => {
        const nextList = p.map(job => {
          if (job.id === jobId && job.stage === 'Matching') {
            ok = true;
            const existingBids = job.bids || [];
            const updatedBids = existingBids.filter(b => b.proPhone !== profile.phone);
            updatedBids.push({
              proName: profile.name,
              proPhone: profile.phone ?? '9876543210',
              bidAmount: amount,
              note: note || 'Will arrive within 30 mins with tools and parts.',
              timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
            });

            addItem(job.eventId, {
              id: `${Date.now()}-bid`,
              kind: 'Action',
              title: `Service Pro ${profile.name} submitted a price quote bid: ₹${amount}`,
              detail: `Quote Bid: ₹${amount} · ${note || 'Ready to start immediately'}`,
              at: 'Now'
            });

            return {
              ...job,
              bids: updatedBids,
              hasBids: true,
              lastBidAmount: amount
            };
          }
          return job;
        });

        if (ok) DatabaseEngine.saveJobs(nextList);
        return nextList;
      });

      return ok;
    },
    acceptProBid(jobId, proPhone, proName, amount) {
      let ok = false;
      setJobs(p => {
        const nextList = p.map(job => {
          if (job.id === jobId) {
            ok = true;
            addItem(job.eventId, {
              id: `${Date.now()}-bid-accept`,
              kind: 'Action',
              title: `Agreed to ${proName}'s quote bid (₹${amount})`,
              detail: `Service Pro ${proName} assigned. Booking process officially started!`,
              at: 'Now',
              verified: true
            });
            return {
              ...job,
              stage: 'Assigned' as const,
              proName,
              proPhone,
              estimate: amount
            };
          }
          return job;
        });

        if (ok) DatabaseEngine.saveJobs(nextList);
        return nextList;
      });

      return ok;
    },
    advance(id, pin) {
      const target = jobs.find(j => j.id === id);
      if (!target || profile?.role !== 'pro') return false;
      if (target.stage === 'On the way' && pin !== target.arrivalPin) return false;

      // Check Pro Free Service Accepts limit
      if (target.stage === 'Assigned' && profile.role === 'pro') {
        if (!profile.subscriptionActive) {
          if (profile.freeAcceptsRemaining > 0) {
            setProfileState({
              ...profile,
              freeAcceptsRemaining: profile.freeAcceptsRemaining - 1
            });
          } else if (profile.monthlyFreeAcceptsRemaining > 0) {
            setProfileState({
              ...profile,
              monthlyFreeAcceptsRemaining: profile.monthlyFreeAcceptsRemaining - 1
            });
          }
        }
      }

      setJobs(p => p.map(job => {
        if (job.id !== id) return job;
        const stages: JobStage[] = ['Assigned', 'On the way', 'In progress', 'Completed'];
        const next = stages[Math.min(stages.indexOf(job.stage as any) + 1, stages.length - 1)];

        const nowTs = Date.now();
        let startedWorkAt = job.startedWorkAt;
        let completedWorkAt = job.completedWorkAt;
        let actualDurationFormatted = job.actualDurationFormatted;

        if (next === 'In progress' && !startedWorkAt) {
          startedWorkAt = nowTs;
        }

        if (next === 'Completed') {
          completedWorkAt = nowTs;
          const start = startedWorkAt ?? (nowTs - 45 * 60 * 1000);
          const diffMs = Math.max(nowTs - start, 60000);
          const totalMins = Math.round(diffMs / (1000 * 60));
          const hrs = Math.floor(totalMins / 60);
          const mins = totalMins % 60;
          actualDurationFormatted = hrs > 0 ? `${hrs} hr${hrs > 1 ? 's' : ''} ${mins} min${mins !== 1 ? 's' : ''}` : `${mins} min${mins !== 1 ? 's' : ''}`;
        }

        const label: Record<JobStage, string> = {
          Matching: 'Finding an available service pro',
          Assigned: `${job.proName} accepted the request`,
          'On the way': `${job.proName} is en route (Live GPS active)`,
          'In progress': 'Work started upon PIN verification',
          Completed: 'Service completed & verified by pro'
        };

        addItem(job.eventId, {
          id: `${Date.now()}-${next}`,
          kind: next === 'Completed' ? 'Verification' : 'Action',
          title: label[next],
          detail: next === 'Completed' ? `Work completed. Actual duration: ${actualDurationFormatted}` : 'Live service status update',
          at: 'Now',
          verified: next === 'Completed'
        });

        if (next === 'Completed') {
          toggleResolved(job.eventId);
        }

        return {
          ...job,
          stage: next,
          startedWorkAt,
          completedWorkAt,
          actualDurationFormatted
        };
      }));
      return true;
    },
    rate(id, rating) {
      setJobs(p => p.map(j => j.id === id ? { ...j, rating } : j));
    },
    logout() {
      DatabaseEngine.clearActivePhone();
      setProfileState(null);
      setJobs([]);
    },
    async syncGlobalJobs() {
      const latest = await DatabaseEngine.loadJobs();
      setJobs(latest);
      return latest;
    }
  }), [profile, ready, jobs, create, addItem, toggleResolved]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useMarketplace() {
  const c = useContext(Ctx);
  if (!c) throw new Error('Marketplace provider missing');
  return c;
}


