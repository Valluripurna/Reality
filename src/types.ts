export type EvidenceKind = 'Photo' | 'Note' | 'Location' | 'Message';
export type TimelineItem = { id: string; kind: EvidenceKind | 'Action' | 'Verification'; title: string; detail: string; at: string; imageUri?: string; verified?: boolean };
export type RealityEvent = { id: string; title: string; type: string; status: 'Open' | 'Resolved'; startedAt: string; items: TimelineItem[] };
export type ServiceKind = string;
export type JobStage = 'Matching' | 'Assigned' | 'On the way' | 'In progress' | 'Completed' | 'Cancelled';

/** Stages an older build (or the server) may still hand us. Normalised on read. */
export type LegacyJobStage = 'Arriving';

/** The forward path of a job. 'Cancelled' is terminal and sits outside it. */
export const STAGE_ORDER: JobStage[] = ['Matching', 'Assigned', 'On the way', 'In progress', 'Completed'];

/** Precedence used when two copies of a job disagree: the further one wins. */
export const STAGE_RANK: Record<JobStage, number> = {
  Matching: 0,
  Assigned: 1,
  'On the way': 2,
  'In progress': 3,
  Completed: 4,
  Cancelled: 5
};

/**
 * Maps any stage string we might receive onto the canonical set. The first
 * server implementation wrote 'Arriving' when a bid was accepted, which used to
 * index to -1 and silently walk the stage list backwards.
 */
export function normaliseStage(stage: JobStage | LegacyJobStage | string | undefined): JobStage {
  if (!stage) return 'Matching';
  if (stage === 'Arriving') return 'Assigned';
  return stage in STAGE_RANK ? (stage as JobStage) : 'Matching';
}

export function nextStage(stage: JobStage): JobStage {
  const idx = STAGE_ORDER.indexOf(stage);
  if (idx < 0 || idx >= STAGE_ORDER.length - 1) return stage;
  return STAGE_ORDER[idx + 1];
}

export function isActiveStage(stage: JobStage) {
  return stage !== 'Completed' && stage !== 'Cancelled';
}

export type ProBid = {
  proName: string;
  proPhone: string;
  bidAmount: number;
  note?: string;
  /** The pro's UPI ID, shared with the customer only after they are booked. */
  proUpi?: string;
  timestamp: string;
};

export type CustomServiceItem = {
  id: string;
  title: string;
  category: string;
  baseRate: number;
  description?: string;
};

export type ServiceJob = {
  id: string;
  eventId: string;
  title: string;
  kind: ServiceKind;
  detail: string;
  urgency: 'Standard' | 'Urgent';
  /** Agreed price. 0 until the customer and pro settle on one. */
  estimate: number;
  /** Optional price the customer suggests; a pro can accept it to agree. */
  budget?: number;
  stage: JobStage;
  /** Who booked it. Jobs are scoped to a phone so users never see each other's bookings. */
  customerPhone?: string;
  customerName?: string;
  /** Set when the customer picked a specific pro on the map before dispatch. */
  preferredProPhone?: string;
  preferredProName?: string;
  paidAt?: string;
  paymentMethod?: PaymentMethod;
  paymentRef?: string;
  proName?: string;
  proPhone?: string;
  eta?: string;
  createdAt: string;
  rating?: number;
  ratingComment?: string;
  distanceKm: number;
  /** Created only when a price is agreed — never at request time. */
  arrivalPin?: string;
  imageUri?: string;
  complexityMultiplier?: number;
  workDurationEst?: string;
  baseMarketRate?: number;
  aiLaborCost?: number;
  aiPartsCost?: number;
  distanceFee?: number;
  timeFee?: number;
  startedWorkAt?: number;
  completedWorkAt?: number;
  actualDurationFormatted?: string;
  bids?: ProBid[];
  hasBids?: boolean;
  lastBidAmount?: number;
  /** Pros whose quote the customer turned down; their bids never come back on sync. */
  declinedPhones?: string[];
  cancelledAt?: string;
  /** ISO time each stage was reached, so every device can show when it happened. */
  stageTimes?: Partial<Record<JobStage, string>>;
  /** Where the work is (the customer's location when booking). */
  lat?: number;
  lng?: number;
  /** The assigned pro's live position, pushed from their phone while the job is active. */
  proLat?: number;
  proLng?: number;
  proLocationAt?: string;
  /** Payment handle of the booked pro, shown to the customer for UPI/QR. */
  proUpi?: string;
  address?: string;
};

export type SavedPlace = { id: string; label: string; address: string; icon: string; lat?: number; lng?: number };

/** Shared by both roles: where the user is, and how sure we are. */
export type LocationFields = {
  locationName?: string;
  liveLat?: number;
  liveLng?: number;
  /** Metres, from the device. */
  locationAccuracy?: number | null;
  locationUpdatedAt?: string;
  /** 'gps' addresses follow the device; 'manual' ones are never overwritten by GPS. */
  addressSource?: 'gps' | 'manual';
};
export type EmergencyContact = { id: string; name: string; phone: string; relation: string };
export type PaymentMethod = 'UPI' | 'Credit / Debit Card' | 'Reality Wallet' | 'Cash after Service';

export type CustomerProfile = LocationFields & {
  name: string;
  phone?: string;
  role: 'customer';
  avatarUri?: string;
  address?: string;
  savedPlaces?: SavedPlace[];
  emergencyContacts?: EmergencyContact[];
  preferredPayment?: PaymentMethod;
  quietServicePref?: boolean;
  ratingScore?: number;
};

export type ProProfile = LocationFields & {
  name: string;
  phone?: string;
  role: 'pro';
  avatarUri?: string;
  isOnline: boolean;
  skills: string;
  address?: string;
  certificateUri?: string;
  idProofUri?: string;
  vehicleInfo?: string;
  serviceRadiusKm?: number;
  payoutUpi?: string;
  bankName?: string;
  accountNumber?: string;
  ifscCode?: string;
  proLevel?: 'Bronze Pro' | 'Silver Pro' | 'Gold Pro' | 'Diamond Pro';
  ratingScore?: number;
  completedJobsCount?: number;
  freeAcceptsRemaining: number;
  monthlyFreeAcceptsRemaining: number;
  subscriptionActive: boolean;
  passType?: 'Day' | 'Monthly';
  passExpiresAt?: string;
  gpsEnabled: boolean;
  aadhaarVerified?: boolean;
  aadhaarMasked?: string;
  aadhaarMobileLinked?: string;
  verificationMessage?: string;
  customServices?: CustomServiceItem[];
};

export type UserProfile = CustomerProfile | ProProfile;

export type MapProPin = {
  id: string;
  name: string;
  skills: ServiceKind[];
  lat: number;
  lng: number;
  rating: number;
  distanceKm: number;
  eta: string;
  avatarUri?: string;
  phone: string;
  isOnline: boolean;
};


