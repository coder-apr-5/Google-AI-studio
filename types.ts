export enum UserRole {
  Buyer = 'Buyer',
  Farmer = 'Farmer',
}

export enum ProductCategory {
  Fruit = 'Fruit',
  Vegetable = 'Vegetable',
  Grain = 'Grain',
  Other = 'Other',
}

export enum ProductType {
  /** @deprecated Platform is B2B bulk-only. Kept for legacy data compatibility. */
  Retail = 'Retail',
  Bulk = 'Bulk',
}

/** Bulk lot size units for B2B trading */
export enum BulkUnit {
  Kg = 'kg',
  Quintal = 'quintal',   // 100 kg
  Ton = 'ton',           // 1000 kg
}

/** Minimum bulk order quantity in kg (1 quintal) */
export const MIN_BULK_QUANTITY_KG = 100;

export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  quantity: number;
  category: ProductCategory;
  imageUrl: string;
  farmerId: string;
  type: ProductType;
  isVerified: boolean;
  verificationFeedback?: string;
  // Dynamic pricing data from location-aware price engine
  farmerLocation?: {
    state: string;
    district: string;
  };
  priceEngineData?: {
    floorPrice: number;
    targetPrice: number;
    priceSource: 'district-mandi' | 'state-average' | 'national-fallback';
    isVerified: boolean;
  };
}

export interface CartItem extends Product {
  cartQuantity: number;
}

export enum NegotiationStatus {
  Pending = 'Pending',
  /** @deprecated Use CounterByFarmer or CounterByBuyer instead. Kept for legacy Firestore data compatibility. */
  CounterOffer = 'Counter-Offer',
  CounterByFarmer = 'Counter-By-Farmer',
  CounterByBuyer = 'Counter-By-Buyer',
  Accepted = 'Accepted',
  Rejected = 'Rejected',
}

export enum OrderStatus {
  Processing = 'Processing',
  Shipped = 'Shipped',
  Delivered = 'Delivered',
}

/** Call status for 1-on-1 voice/video calls */
export enum CallStatus {
  Idle = 'idle',
  Ringing = 'ringing',
  Ongoing = 'ongoing',
  Ended = 'ended',
  Declined = 'declined',
  Missed = 'missed',
}

export interface Negotiation {
  id: string;
  productId: string;
  productName: string;
  productImageUrl: string;
  buyerId: string;
  farmerId: string;
  initialPrice: number;
  offeredPrice: number;
  counterPrice?: number;
  quantity: number; // in kg
  status: NegotiationStatus;
  notes: string;
  lastUpdated: Date;
  // Dynamic pricing fields
  floorPrice?: number;      // Minimum acceptable price (per kg)
  targetPrice?: number;     // Suggested fair price (per kg)
  priceSource?: string;     // Where the floor/target came from
  priceVerified?: boolean;  // Whether mandi data was available
  qualityGrade?: string;    // AI-assessed grade (A, B, C)
  farmerLocation?: {        // For price calculation
    state?: string;
    district?: string;
  };
  // Voice/Video call fields
  callStatus?: CallStatus;
  callerId?: string;
  callerName?: string;
  callStartedAt?: Date;
}

export type MessageStatus = 'sending' | 'sent' | 'failed';

export interface ChatMessage {
  id: string;
  negotiationId: string;
  senderId: string; // e.g., 'b1' for buyer, 'f1' for farmer
  recipientId?: string; // The other participant in the conversation
  text: string;
  timestamp: Date;
  status?: MessageStatus; // Optional for backward compatibility
  read?: boolean; // Track if message has been read
}

export interface BotChatMessage {
  role: 'user' | 'model' | 'error';
  text: string;
}

export interface Farmer {
  id: string;
  name: string;
  profileImageUrl: string;
  isVerified: boolean;
  rating: number;
  bio: string;
  yearsFarming: number;
  location: string;
  verificationFeedback?: string;
}

export interface User {
  uid: string;
  name: string;
  avatarUrl?: string;
  phone?: string;
  email?: string;
  location?: string;
  role: UserRole;
}

export interface LiveTranscript {
    role: 'user' | 'model';
    text: string;
}

export type MarketTrend = 'up' | 'flat' | 'down';

export interface MarketRate {
  id: string;
  crop: string;
  pricePerQuintal: number;
  changePct: number;
  trend: MarketTrend;
  updatedAt: Date;
}

export interface FarmerDashboardWeather {
  locationLabel: string;
  temperatureC: number;
  conditionLabel: string;
  weatherIcon: string;
  humidityPct: number;
  windKmh: number;
  rainPct: number;
  updatedAt: Date;
}

export enum TransactionType {
  Payment = 'Payment',
  Withdrawal = 'Withdrawal',
  TopUp = 'TopUp',
  Subsidy = 'Subsidy',
}

export enum TransactionStatus {
  Completed = 'Completed',
  Pending = 'Pending',
  Failed = 'Failed',
}

export interface Transaction {
  id: string;
  farmerId: string;
  type: TransactionType;
  status: TransactionStatus;
  amount: number;
  description: string;
  timestamp: Date;
  relatedId?: string; // negotiationId for payments, etc.
  metadata?: Record<string, any>;
}

export interface FarmerWallet {
  farmerId: string;
  totalBalance: number;
  lastUpdated: Date;
}

// ═══════════════════════════════════════════════════════════════════════════════
// MANDI PRICE DATA (Synced from Agmarknet via Scraper)
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Mandi price document structure - synced from Agmarknet government portal
 * Document ID format: {state}_{district}_{market}_{commodity}
 */
export interface MandiPriceDoc {
  /** State name (e.g., "West Bengal") */
  state: string;
  /** District name (e.g., "Kolkata") */
  district: string;
  /** Market/Mandi name (e.g., "Sealdah") */
  market: string;
  /** Commodity name (e.g., "Rice", "Wheat", "Potato") */
  commodity: string;
  /** Variety of the commodity (e.g., "Basmati", "Common") */
  variety: string;
  /** Quality grade (e.g., "FAQ", "Grade-A") */
  grade: string;
  /** Minimum price in ₹ per quintal */
  minPrice: number | null;
  /** Maximum price in ₹ per quintal */
  maxPrice: number | null;
  /** Modal (most common) price in ₹ per quintal */
  modalPrice: number | null;
  /** Date when this price was reported (ISO string) */
  reportDate: string;
  /** Data source identifier */
  source: 'agmarknet' | 'manual' | 'api';
  /** Original source URL */
  sourceUrl?: string;
  /** When this record was last synced/updated (ISO string) */
  lastUpdated: string;
  /** Whether this data has been verified/validated */
  isVerified: boolean;
  /** Price unit for display (e.g., "INR/Quintal") */
  priceUnit: string;
}

/**
 * Simplified mandi rate for display in widgets
 */
export interface MandiRateDisplay {
  commodity: string;
  market: string;
  pricePerQuintal: number;
  pricePerKg: number;
  change24h?: number;
  trend: MarketTrend;
  lastUpdated: Date;
  isVerified: boolean;
}

/**
 * Convert MandiPriceDoc to per-kg pricing for app usage
 */
export function mandiDocToRateDisplay(doc: MandiPriceDoc): MandiRateDisplay {
  const pricePerQuintal = doc.modalPrice ?? doc.maxPrice ?? doc.minPrice ?? 0;
  return {
    commodity: doc.commodity,
    market: doc.market,
    pricePerQuintal,
    pricePerKg: Math.round((pricePerQuintal / 100) * 100) / 100, // Quintal = 100kg
    trend: 'flat', // Would need historical data to calculate
    lastUpdated: new Date(doc.lastUpdated),
    isVerified: doc.isVerified,
  };
}