/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANNA BAZAAR - DYNAMIC PRICE ENGINE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Source of Truth for ALL negotiation pricing.
 * 
 * STRICT FORMULA:
 *   FloorPrice = ((MandiModal / 100) × GradeMultiplier) - 1.5
 *   TargetPrice = FloorPrice × 1.15
 * 
 * @author Anna Bazaar Team - Calcutta Hacks 2025
 */

import { collection, getDocs, query, where, orderBy, limit } from 'firebase/firestore';
import { db } from '../firebase';

// ═══════════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════════

/** Grade multipliers for quality-adjusted pricing */
export const GRADE_MULTIPLIERS: Record<string, number> = {
  'A': 1.0,      // Premium quality - full price
  'B': 0.90,    // Standard quality - 90% of modal
  'C': 0.80,    // Economy quality - 80% of modal
  'X': 0.0,     // Invalid/Non-agricultural - blocked
  'default': 0.90,
};

/** State-level average fallback prices (₹/quintal) when district data unavailable */
export const STATE_AVERAGE_PRICES: Record<string, Record<string, number>> = {
  'West Bengal': {
    'Rice': 3200, 'Wheat': 2400, 'Potato': 1600, 'Onion': 2100, 'Tomato': 2800,
    'Cauliflower': 2200, 'Cabbage': 1400, 'Brinjal': 2000, 'Mango': 5500, 'Banana': 2800,
    'default': 2500,
  },
  'Maharashtra': {
    'Rice': 3000, 'Wheat': 2600, 'Potato': 1800, 'Onion': 1900, 'Tomato': 2500,
    'Grapes': 6000, 'Orange': 4500, 'Mango': 6500, 'Sugarcane': 3200, 'Cotton': 7000,
    'default': 2800,
  },
  'Punjab': {
    'Rice': 3500, 'Wheat': 2800, 'Potato': 1500, 'Maize': 2200, 'Cotton': 7500,
    'Sugarcane': 3500, 'Mustard': 5500, 'Barley': 2000,
    'default': 3000,
  },
  'Uttar Pradesh': {
    'Rice': 3100, 'Wheat': 2500, 'Potato': 1400, 'Onion': 1800, 'Sugarcane': 3400,
    'Mango': 5000, 'Tomato': 2600, 'Cauliflower': 2000,
    'default': 2600,
  },
  'Karnataka': {
    'Rice': 3300, 'Ragi': 3500, 'Tomato': 2400, 'Onion': 2000, 'Potato': 1700,
    'Mango': 6000, 'Coconut': 2500, 'Coffee': 8000,
    'default': 2700,
  },
  'Tamil Nadu': {
    'Rice': 3400, 'Coconut': 2800, 'Banana': 3000, 'Mango': 5800, 'Tomato': 2700,
    'Onion': 2200, 'Groundnut': 5500,
    'default': 2900,
  },
  'Gujarat': {
    'Cotton': 7200, 'Groundnut': 5800, 'Wheat': 2600, 'Potato': 1600, 'Onion': 2000,
    'Cumin': 18000, 'Castor': 6500,
    'default': 3000,
  },
  'Madhya Pradesh': {
    'Wheat': 2700, 'Soybean': 4500, 'Gram': 5000, 'Onion': 1800, 'Potato': 1500,
    'Tomato': 2300, 'Garlic': 12000,
    'default': 2800,
  },
  'Rajasthan': {
    'Wheat': 2600, 'Mustard': 5600, 'Gram': 5200, 'Barley': 2100, 'Cumin': 17000,
    'Coriander': 8000, 'Onion': 1700,
    'default': 2700,
  },
  'default': {
    'Rice': 3200, 'Wheat': 2500, 'Potato': 1600, 'Onion': 2000, 'Tomato': 2500,
    'Mango': 5500, 'Banana': 2600, 'default': 2500,
  },
};

/** National fallback when no state data available */
export const NATIONAL_FALLBACK_PRICE = 2500; // ₹/quintal

// ═══════════════════════════════════════════════════════════════════════════════
// INTERFACES
// ═══════════════════════════════════════════════════════════════════════════════

export interface MandiData {
  modalPrice: number;        // ₹/quintal
  minPrice: number | null;
  maxPrice: number | null;
  market: string;
  district: string;
  state: string;
  commodity: string;
  isVerified: boolean;
  source: string;
  lastUpdated: string;
}

export interface PriceEngineResult {
  floorPrice: number;        // ₹/kg - HARD MINIMUM
  targetPrice: number;       // ₹/kg - SUGGESTED FAIR PRICE
  suggestedPrice: number;    // ₹/kg - For farmer listing
  mandiModalPerKg: number;   // ₹/kg - Reference
  mandiModalPerQuintal: number; // ₹/quintal - Reference
  gradeMultiplier: number;
  isVerified: boolean;       // Whether we have real mandi data
  priceSource: string;       // Human-readable source description
  validationMessage?: string;
}

export interface PriceValidation {
  isValid: boolean;
  errorMessage?: string;
  floorPrice: number;
  offerPrice: number;
  shortfall?: number;        // How much below floor
}

// ═══════════════════════════════════════════════════════════════════════════════
// CORE PRICING FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Get mandi price from Firestore with state fallback
 */
export async function getLatestMandiPrice(
  state: string,
  district: string,
  commodity: string
): Promise<MandiData | null> {
  const normalizedCommodity = commodity.toLowerCase().trim();
  const normalizedState = state.trim();
  const normalizedDistrict = district.trim();

  try {
    // 1. Try exact district match
    const districtQuery = query(
      collection(db, 'mandiPrices'),
      where('state', '==', normalizedState),
      where('district', '==', normalizedDistrict),
      limit(20)
    );

    const districtSnap = await getDocs(districtQuery);
    for (const doc of districtSnap.docs) {
      const data = doc.data();
      const commodityName = (data.commodity || data.commodityName || '').toLowerCase();
      if (commodityName.includes(normalizedCommodity) || normalizedCommodity.includes(commodityName)) {
        return {
          modalPrice: Number(data.modalPrice || 0),
          minPrice: data.minPrice ? Number(data.minPrice) : null,
          maxPrice: data.maxPrice ? Number(data.maxPrice) : null,
          market: data.market || data.marketName || '',
          district: data.district || '',
          state: data.state || '',
          commodity: data.commodity || data.commodityName || '',
          isVerified: true,
          source: `${data.market || 'Mandi'}, ${data.district}`,
          lastUpdated: data.lastUpdated || new Date().toISOString(),
        };
      }
    }

    // 2. Fallback: State-level average
    console.log(`[PricingEngine] District data unavailable for ${commodity} in ${district}, ${state}. Using state average.`);
    const stateAvg = getStateAveragePrice(normalizedState, commodity);
    if (stateAvg) {
      return {
        modalPrice: stateAvg,
        minPrice: Math.round(stateAvg * 0.9),
        maxPrice: Math.round(stateAvg * 1.1),
        market: 'State Average',
        district: normalizedDistrict,
        state: normalizedState,
        commodity: commodity,
        isVerified: false,
        source: `${normalizedState} State Average (district data unavailable)`,
        lastUpdated: new Date().toISOString(),
      };
    }

    // 3. Fallback: National average
    console.log(`[PricingEngine] No state data for ${commodity}. Using national fallback.`);
    return {
      modalPrice: NATIONAL_FALLBACK_PRICE,
      minPrice: Math.round(NATIONAL_FALLBACK_PRICE * 0.9),
      maxPrice: Math.round(NATIONAL_FALLBACK_PRICE * 1.1),
      market: 'National Average',
      district: '',
      state: '',
      commodity: commodity,
      isVerified: false,
      source: 'National Average (no regional data)',
      lastUpdated: new Date().toISOString(),
    };

  } catch (error) {
    console.error('[PricingEngine] Error fetching mandi price:', error);
    return null;
  }
}

/**
 * Get state-level average price for a commodity
 */
export function getStateAveragePrice(state: string, commodity: string): number | null {
  const normalizedState = state.trim();
  const normalizedCommodity = commodity.toLowerCase().trim();

  // Find state data
  let stateData = STATE_AVERAGE_PRICES[normalizedState];
  if (!stateData) {
    // Try partial match
    for (const [key, data] of Object.entries(STATE_AVERAGE_PRICES)) {
      if (key.toLowerCase().includes(normalizedState.toLowerCase()) ||
          normalizedState.toLowerCase().includes(key.toLowerCase())) {
        stateData = data;
        break;
      }
    }
  }

  if (!stateData) {
    stateData = STATE_AVERAGE_PRICES['default'];
  }

  // Find commodity price
  for (const [key, price] of Object.entries(stateData)) {
    if (key.toLowerCase().includes(normalizedCommodity) ||
        normalizedCommodity.includes(key.toLowerCase())) {
      return price;
    }
  }

  return stateData['default'] || null;
}

/**
 * CORE PRICING FORMULA
 * 
 * FloorPrice = ((MandiModal / 100) × GradeMultiplier) - 1.5
 * TargetPrice = FloorPrice × 1.15
 */
export function calculatePrices(
  mandiModalPerQuintal: number,
  grade: string = 'B'
): { floorPrice: number; targetPrice: number; suggestedPrice: number; gradeMultiplier: number } {
  const gradeMultiplier = GRADE_MULTIPLIERS[grade.toUpperCase()] || GRADE_MULTIPLIERS['default'];

  // Convert to per-kg and apply formula
  const mandiModalPerKg = mandiModalPerQuintal / 100;

  // STRICT FORMULA: FloorPrice = (MandiModal/100 × GradeMultiplier) - 1.5
  const floorPrice = Math.max(0, (mandiModalPerKg * gradeMultiplier) - 1.5);

  // TargetPrice = FloorPrice × 1.15
  const targetPrice = floorPrice * 1.15;

  // Suggested price for farmer = Target price (fair value)
  const suggestedPrice = targetPrice;

  return {
    floorPrice: Math.round(floorPrice * 100) / 100,
    targetPrice: Math.round(targetPrice * 100) / 100,
    suggestedPrice: Math.round(suggestedPrice * 100) / 100,
    gradeMultiplier,
  };
}

/**
 * Full pricing engine computation
 */
export async function computeDynamicPrice(
  commodity: string,
  grade: string = 'B',
  state?: string,
  district?: string
): Promise<PriceEngineResult> {
  // Get mandi data (with fallbacks)
  const mandiData = await getLatestMandiPrice(
    state || '',
    district || '',
    commodity
  );

  const modalPrice = mandiData?.modalPrice || NATIONAL_FALLBACK_PRICE;
  const isVerified = mandiData?.isVerified ?? false;
  const priceSource = mandiData?.source || 'National Average';

  // Calculate prices using strict formula
  const { floorPrice, targetPrice, suggestedPrice, gradeMultiplier } = calculatePrices(modalPrice, grade);

  return {
    floorPrice,
    targetPrice,
    suggestedPrice,
    mandiModalPerKg: Math.round((modalPrice / 100) * 100) / 100,
    mandiModalPerQuintal: modalPrice,
    gradeMultiplier,
    isVerified,
    priceSource,
  };
}

// ═══════════════════════════════════════════════════════════════════════════════
// VALIDATION FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * HARD STOP validation for buyer offers
 * Returns false if offer is below floor price
 */
export function validateOfferAgainstFloor(
  offerPrice: number,
  floorPrice: number
): PriceValidation {
  if (offerPrice < floorPrice) {
    return {
      isValid: false,
      errorMessage: `System Block: Price below regional market floor (₹${floorPrice.toFixed(2)}/kg)`,
      floorPrice,
      offerPrice,
      shortfall: Math.round((floorPrice - offerPrice) * 100) / 100,
    };
  }

  return {
    isValid: true,
    floorPrice,
    offerPrice,
  };
}

/**
 * Full offer validation with async price lookup
 */
export async function validateOffer(
  offerPrice: number,
  commodity: string,
  grade: string = 'B',
  state?: string,
  district?: string
): Promise<PriceValidation> {
  const priceResult = await computeDynamicPrice(commodity, grade, state, district);
  return validateOfferAgainstFloor(offerPrice, priceResult.floorPrice);
}

// ═══════════════════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════════

/**
 * Format price for display
 */
export function formatPrice(price: number): string {
  return `₹${price.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Format price per kg for display
 */
export function formatPricePerKg(price: number): string {
  return `${formatPrice(price)}/kg`;
}

/**
 * Get grade label for display
 */
export function getGradeLabel(grade: string): string {
  const labels: Record<string, string> = {
    'A': 'Premium Quality',
    'B': 'Standard Quality',
    'C': 'Economy Quality',
    'X': 'Invalid',
  };
  return labels[grade.toUpperCase()] || 'Standard Quality';
}
