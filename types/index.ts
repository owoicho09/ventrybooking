export type EventCategory =
  | 'Concert'
  | 'Party'
  | 'Sports'
  | 'Theater'
  | 'Festival'
  | 'Conference'
  | 'Other';

export type EventStatus = 'approved' | 'under_review' | 'completed' | 'draft' | 'rejected';

export type TicketStatus = 'valid' | 'used' | 'cancelled' | 'refunded';

export type OrganizerTier = 'Standard' | 'Trusted' | 'Elite';

export type KYCStatus = 'pending' | 'approved' | 'rejected';

export type PayoutStatus = 'pending' | 'processing' | 'completed';

export type ComplaintType =
  | 'Event Cancelled'
  | 'Fraud'
  | 'Ticket Issue'
  | 'Payment Issue';

export interface Organizer {
  id: string;
  name: string;
  email: string;
  phone: string;
  tier: OrganizerTier;
  verified: boolean;
  memberSince: string;
  member_since?: string;
  eventsHosted: number;
  events_hosted?: number;
  handle?: string | null;
  kycStatus: KYCStatus;
  submittedAt?: string;
}

export interface TicketTier {
  id: string;
  name: string;
  price: number;
  available: number;
  sold: number;
}

export interface Event {
  id: string;
  slug: string;
  name: string;
  category: EventCategory;
  description: string;
  date: string;
  time: string;
  event_mode?: 'physical' | 'online';
  venue: string;
  address: string;
  city: string;
  landmark?: string | null;
  location_hidden?: boolean;
  locationHidden?: boolean;
  organizer: Organizer;
  tiers: TicketTier[];
  status: EventStatus;
  badge?: 'selling_fast' | 'limited' | 'sold_out';
  totalSold: number;
  bannerColor: string;
  banner_url?: string | null;
  accentColor?: string | null;
  lineup?: { name: string; role: string }[];
}

export interface Ticket {
  id: string;
  eventId: string;
  event: Event;
  tier: TicketTier;
  quantity: number;
  buyerName: string;
  buyerEmail: string;
  totalPaid: number;
  status: TicketStatus;
  purchasedAt: string;
  refundCode: string;
  qrData: string;
  qrDataUrl?: string | null;
  banner_url?: string;
}

export interface Payout {
  id: string;
  eventId: string;
  eventName: string;
  date: string;
  gross: number;
  fee: number;
  net: number;
  status: PayoutStatus;
  reference: string;
}

export interface Complaint {
  id: string;
  ticketId: string;
  type: ComplaintType;
  buyerName: string;
  buyerEmail: string;
  eventName: string;
  submittedAt: string;
  status: 'open' | 'investigating' | 'resolved' | 'rejected';
  priority: 'high' | 'medium' | 'low';
  notes?: string;
}

export interface ScanLog {
  id: string;
  ticketId: string;
  attendeeName: string;
  ticketType: string;
  scannedAt: string;
  result: 'success' | 'already_used' | 'invalid';
}

// --- Sanity blog content ---

export interface SanityImageRef {
  asset?: { _ref: string; _type: string };
  hotspot?: { x: number; y: number; height: number; width: number };
  alt?: string;
}

export interface PortableTextBlockLite {
  _type: string;
  _key?: string;
  style?: string;
  children?: { text?: string }[];
  [key: string]: unknown;
}

export interface BlogSlug {
  current: string;
}

export interface BlogAuthor {
  name: string;
  slug?: BlogSlug;
  image?: SanityImageRef;
  bio?: PortableTextBlockLite[];
}

export interface BlogCategory {
  title: string;
  slug?: BlogSlug;
}

export interface BlogPost {
  _id: string;
  title: string;
  slug: BlogSlug;
  mainImage?: SanityImageRef;
  publishedAt: string;
  author?: BlogAuthor;
  body?: PortableTextBlockLite[];
  categories?: BlogCategory[];
}
