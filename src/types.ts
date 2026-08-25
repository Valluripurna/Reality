export type EvidenceKind = 'Photo' | 'Note' | 'Location' | 'Message';
export type TimelineItem = { id: string; kind: EvidenceKind | 'Action' | 'Verification'; title: string; detail: string; at: string; imageUri?: string; verified?: boolean };
export type RealityEvent = { id: string; title: string; type: string; status: 'Open' | 'Resolved'; startedAt: string; items: TimelineItem[] };
export type ServiceKind = string;
export type JobStage = 'Matching' | 'Assigned' | 'On the way' | 'In progress' | 'Completed';

export type ProBid = {
  proName: string;
  proPhone: string;
  bidAmount: number;
  note?: string;
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
  estimate: number;
  stage: JobStage;
  proName?: string;
  proPhone?: string;
  eta?: string;
  createdAt: string;
  rating?: number;
  distanceKm: number;
  arrivalPin: string;
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
};

export type SavedPlace = { id: string; label: string; address: string; icon: string };
export type EmergencyContact = { id: string; name: string; phone: string; relation: string };
export type PaymentMethod = 'UPI' | 'Credit / Debit Card' | 'Reality Wallet' | 'Cash after Service';

export type CustomerProfile = {
  name: string;
  phone?: string;
  role: 'customer';
  avatarUri?: string;
  address?: string;
  locationName?: string;
  liveLat?: number;
  liveLng?: number;
  savedPlaces?: SavedPlace[];
  emergencyContacts?: EmergencyContact[];
  preferredPayment?: PaymentMethod;
  quietServicePref?: boolean;
  ratingScore?: number;
};

export type ProProfile = {
  name: string;
  phone?: string;
  role: 'pro';
  avatarUri?: string;
  locationName?: string;
  liveLat?: number;
  liveLng?: number;
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


