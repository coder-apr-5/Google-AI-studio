/**
 * ═══════════════════════════════════════════════════════════════════════════════
 * ANNA BAZAAR - GEOLOCATION SERVICE
 * ═══════════════════════════════════════════════════════════════════════════════
 * 
 * Provides automatic location detection using Browser Geolocation API
 * and Google Maps Reverse Geocoding for State/District extraction.
 * 
 * @author Anna Bazaar Team - Calcutta Hacks 2025
 */

// Declare google namespace for TypeScript
declare global {
  interface Window {
    google?: {
      maps?: {
        Geocoder: new () => {
          geocode: (
            request: { location: { lat: number; lng: number } },
            callback: (
              results: Array<{
                address_components: Array<{
                  long_name: string;
                  short_name: string;
                  types: string[];
                }>;
                formatted_address: string;
              }> | null,
              status: string
            ) => void
          ) => void;
        };
        GeocoderStatus: {
          OK: string;
          ZERO_RESULTS: string;
          OVER_QUERY_LIMIT: string;
          REQUEST_DENIED: string;
          INVALID_REQUEST: string;
          UNKNOWN_ERROR: string;
        };
      };
    };
  }
}

// Google Maps API Key
const GOOGLE_MAPS_API_KEY = 'AIzaSyCGGq8VUFMbE6KTzrzxIRjtxu7AI8os1O4';

export interface GeoLocation {
  state: string;
  district: string;
  locality?: string;
  formattedAddress?: string;
  coordinates: {
    lat: number;
    lng: number;
  };
  accuracy?: number;
  timestamp: number;
}

export interface GeolocationError {
  code: 'PERMISSION_DENIED' | 'POSITION_UNAVAILABLE' | 'TIMEOUT' | 'GEOCODING_FAILED' | 'UNKNOWN';
  message: string;
}

/**
 * Load Google Maps API dynamically
 */
export function loadGoogleMapsAPI(): Promise<void> {
  return new Promise((resolve, reject) => {
    // Check if already loaded
    if (window.google?.maps?.Geocoder) {
      resolve();
      return;
    }

    // Check if script is already loading
    const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => resolve());
      existingScript.addEventListener('error', () => reject(new Error('Failed to load Google Maps')));
      return;
    }

    // Create and load script
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=geocoding`;
    script.async = true;
    script.defer = true;

    script.onload = () => {
      console.log('[Geolocation] Google Maps API loaded successfully');
      resolve();
    };

    script.onerror = () => {
      reject(new Error('Failed to load Google Maps API'));
    };

    document.head.appendChild(script);
  });
}

/**
 * Get current position from Browser Geolocation API
 */
export function getCurrentPosition(): Promise<GeolocationPosition> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject({
        code: 'POSITION_UNAVAILABLE',
        message: 'Geolocation is not supported by this browser',
      } as GeolocationError);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => resolve(position),
      (error) => {
        let code: GeolocationError['code'] = 'UNKNOWN';
        switch (error.code) {
          case error.PERMISSION_DENIED:
            code = 'PERMISSION_DENIED';
            break;
          case error.POSITION_UNAVAILABLE:
            code = 'POSITION_UNAVAILABLE';
            break;
          case error.TIMEOUT:
            code = 'TIMEOUT';
            break;
        }
        reject({
          code,
          message: error.message || 'Failed to get location',
        } as GeolocationError);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000, // Cache for 1 minute
      }
    );
  });
}

/**
 * Reverse geocode coordinates to get State and District
 * Uses Google Maps Geocoding API
 */
export async function reverseGeocode(lat: number, lng: number): Promise<{
  state: string;
  district: string;
  locality?: string;
  formattedAddress?: string;
}> {
  await loadGoogleMapsAPI();

  return new Promise((resolve, reject) => {
    if (!window.google?.maps?.Geocoder) {
      reject({
        code: 'GEOCODING_FAILED',
        message: 'Google Maps API not loaded',
      } as GeolocationError);
      return;
    }

    const geocoder = new window.google.maps.Geocoder();

    geocoder.geocode(
      { location: { lat, lng } },
      (results, status) => {
        if (status !== 'OK' || !results || results.length === 0) {
          reject({
            code: 'GEOCODING_FAILED',
            message: `Geocoding failed: ${status}`,
          } as GeolocationError);
          return;
        }

        // Extract address components
        let state = '';
        let district = '';
        let locality = '';
        let formattedAddress = results[0]?.formatted_address || '';

        for (const result of results) {
          for (const component of result.address_components) {
            const types = component.types;

            // State (administrative_area_level_1)
            if (types.includes('administrative_area_level_1') && !state) {
              state = component.long_name;
            }

            // District (administrative_area_level_2)
            if (types.includes('administrative_area_level_2') && !district) {
              district = component.long_name;
            }

            // Fallback: administrative_area_level_3 for district
            if (types.includes('administrative_area_level_3') && !district) {
              district = component.long_name;
            }

            // Locality (sublocality or locality)
            if ((types.includes('sublocality') || types.includes('locality')) && !locality) {
              locality = component.long_name;
            }
          }

          // Stop if we have both state and district
          if (state && district) break;
        }

        // Validate we got the minimum required data
        if (!state) {
          state = 'Unknown State';
        }
        if (!district) {
          district = locality || 'Unknown District';
        }

        console.log('[Geolocation] Reverse geocoding result:', { state, district, locality });

        resolve({
          state,
          district,
          locality,
          formattedAddress,
        });
      }
    );
  });
}

/**
 * Full geolocation flow: Get position + Reverse geocode
 */
export async function detectUserLocation(): Promise<GeoLocation> {
  console.log('[Geolocation] Starting location detection...');

  // Step 1: Get coordinates
  const position = await getCurrentPosition();
  const { latitude: lat, longitude: lng } = position.coords;

  console.log(`[Geolocation] Coordinates: ${lat}, ${lng}`);

  // Step 2: Reverse geocode to get State/District
  const geocodeResult = await reverseGeocode(lat, lng);

  return {
    state: geocodeResult.state,
    district: geocodeResult.district,
    locality: geocodeResult.locality,
    formattedAddress: geocodeResult.formattedAddress,
    coordinates: { lat, lng },
    accuracy: position.coords.accuracy,
    timestamp: position.timestamp,
  };
}

/**
 * React hook for location detection
 */
export function useGeolocation(): {
  location: GeoLocation | null;
  loading: boolean;
  error: GeolocationError | null;
  refresh: () => void;
} {
  // This is a placeholder - actual hook implementation will be in the component
  // due to React import requirements
  throw new Error('Use useGeolocationHook from components instead');
}

// ═══════════════════════════════════════════════════════════════════════════════
// STATE NAME MAPPINGS (for normalization)
// ═══════════════════════════════════════════════════════════════════════════════

const STATE_NAME_MAPPINGS: Record<string, string> = {
  // Common variations
  'andhra pradesh': 'Andhra Pradesh',
  'arunachal pradesh': 'Arunachal Pradesh',
  'assam': 'Assam',
  'bihar': 'Bihar',
  'chhattisgarh': 'Chhattisgarh',
  'goa': 'Goa',
  'gujarat': 'Gujarat',
  'haryana': 'Haryana',
  'himachal pradesh': 'Himachal Pradesh',
  'jharkhand': 'Jharkhand',
  'karnataka': 'Karnataka',
  'kerala': 'Kerala',
  'madhya pradesh': 'Madhya Pradesh',
  'maharashtra': 'Maharashtra',
  'manipur': 'Manipur',
  'meghalaya': 'Meghalaya',
  'mizoram': 'Mizoram',
  'nagaland': 'Nagaland',
  'odisha': 'Odisha',
  'orissa': 'Odisha', // Old name
  'punjab': 'Punjab',
  'rajasthan': 'Rajasthan',
  'sikkim': 'Sikkim',
  'tamil nadu': 'Tamil Nadu',
  'telangana': 'Telangana',
  'tripura': 'Tripura',
  'uttar pradesh': 'Uttar Pradesh',
  'uttarakhand': 'Uttarakhand',
  'uttaranchal': 'Uttarakhand', // Old name
  'west bengal': 'West Bengal',
  // Union Territories
  'andaman and nicobar islands': 'Andaman and Nicobar Islands',
  'chandigarh': 'Chandigarh',
  'dadra and nagar haveli and daman and diu': 'Dadra and Nagar Haveli and Daman and Diu',
  'delhi': 'Delhi',
  'national capital territory of delhi': 'Delhi',
  'nct of delhi': 'Delhi',
  'jammu and kashmir': 'Jammu and Kashmir',
  'ladakh': 'Ladakh',
  'lakshadweep': 'Lakshadweep',
  'puducherry': 'Puducherry',
  'pondicherry': 'Puducherry', // Old name
};

/**
 * Normalize state name to standard format
 */
export function normalizeStateName(state: string): string {
  const lower = state.toLowerCase().trim();
  return STATE_NAME_MAPPINGS[lower] || state;
}
