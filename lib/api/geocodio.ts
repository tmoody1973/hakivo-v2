/**
 * Geocodio API Client
 *
 * Provides functions for geocoding and Congressional district lookup
 * using zip codes.
 *
 * API Base URL: https://api.geocod.io/v1.7
 * Documentation: https://www.geocod.io/docs/
 *
 * Rate Limits: Varies by plan (free: 2,500/day)
 */

import {
  GeocodeResponse,
  DistrictLookupResult,
  RepresentativeSummary,
  Legislator,
} from '../api-specs/geocodio.types';
import { APIResponse } from '../api-specs/common.types';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_DISTRICT_LOOKUP: DistrictLookupResult = {
  state: 'CA',
  district: 12,
  representatives: {
    senators: [
      {
        type: 'senator',
        bio: {
          last_name: 'Padilla',
          first_name: 'Alex',
          birthday: '1973-03-22',
          gender: 'M',
          party: 'Democrat',
        },
        contact: {
          url: 'https://www.padilla.senate.gov',
          phone: '202-224-3553',
        },
        references: {
          bioguide_id: 'P000145',
        },
        source: 'Legislator data is originally collected and aggregated by https://github.com/unitedstates/',
      },
    ],
    representative: {
      type: 'representative',
      bio: {
        last_name: 'Pelosi',
        first_name: 'Nancy',
        birthday: '1940-03-26',
        gender: 'F',
        party: 'Democrat',
      },
      contact: {
        url: 'https://pelosi.house.gov',
        phone: '202-225-4965',
      },
      references: {
        bioguide_id: 'P000197',
      },
      source: 'Legislator data is originally collected and aggregated by https://github.com/unitedstates/',
    },
  },
};

// ============================================================================
// Geocoding Functions
// ============================================================================

/**
 * Lookup Congressional district and representatives by zip code
 *
 * @param zipCode - 5-digit US zip code
 * @returns District number, state, and representative information
 *
 * API ENDPOINT: GET https://api.geocod.io/v1.7/geocode
 * HEADERS: None (API key in query param)
 * QUERY PARAMETERS: {
 *   q: string (zip code),
 *   fields: 'cd,cd116' (congressional districts),
 *   api_key: string
 * }
 * SUCCESS RESPONSE (200): {
 *   input: {
 *     address_components: { zip: string, state: string, city: string },
 *     formatted_address: string
 *   },
 *   results: [{
 *     address_components: { zip: string, state: string, city: string, country: string },
 *     formatted_address: string,
 *     location: { lat: number, lng: number },
 *     accuracy: number,
 *     accuracy_type: string,
 *     fields: {
 *       congressional_districts: [{
 *         name: string (e.g., "Congressional District 12"),
 *         district_number: number,
 *         congress_number: string (e.g., "119"),
 *         congress_years: string (e.g., "2025-2027"),
 *         proportion: number,
 *         current_legislators: [{
 *           type: "senator" | "representative",
 *           bio: {
 *             last_name: string,
 *             first_name: string,
 *             birthday: string,
 *             gender: string,
 *             party: string
 *           },
 *           contact: {
 *             url: string,
 *             address: string,
 *             phone: string
 *           },
 *           references: {
 *             bioguide_id: string,
 *             ...
 *           }
 *         }]
 *       }]
 *     }
 *   }]
 * }
 * ERROR RESPONSES:
 *   400: { error: "Could not geocode address" }
 *   401: { error: "Invalid API key" }
 *   403: { error: "API key does not have access to this resource" }
 *   422: { error: "Invalid input format" }
 *   429: { error: "Rate limit exceeded" }
 */
export async function lookupByZipCode(
  zipCode: string
): Promise<APIResponse<DistrictLookupResult>> {
  // API ENDPOINT: GET https://api.geocod.io/v1.7/geocode
  // QUERY PARAMETERS: {
  //   q: zipCode,
  //   fields: 'cd',  // Congressional district with current legislators
  //   api_key: process.env.GEOCODIO_API_KEY
  // }

  // Parse response to extract:
  // - State abbreviation from address_components.state
  // - District number from fields.congressional_districts[0].district_number
  // - Legislators from fields.congressional_districts[0].current_legislators

  // TODO: Replace with actual API call
  return {
    success: true,
    data: MOCK_DISTRICT_LOOKUP,
  };
}

/**
 * Get representatives for a Congressional district
 *
 * This is a helper function that formats the Geocodio response
 * into a simplified representative summary.
 *
 * @param zipCode - 5-digit US zip code
 * @returns Simplified list of representatives
 */
export async function getRepresentatives(
  zipCode: string
): Promise<APIResponse<RepresentativeSummary[]>> {
  // First call lookupByZipCode to get full district information
  // Then transform Legislator objects into RepresentativeSummary

  // TODO: Replace with actual implementation
  const mockReps: RepresentativeSummary[] = [
    {
      type: 'senator',
      name: 'Alex Padilla',
      party: 'Democrat',
      bioguideId: 'P000145',
      phone: '202-224-3553',
      website: 'https://www.padilla.senate.gov',
    },
    {
      type: 'representative',
      name: 'Nancy Pelosi',
      party: 'Democrat',
      bioguideId: 'P000197',
      phone: '202-225-4965',
      website: 'https://pelosi.house.gov',
    },
  ];

  return {
    success: true,
    data: mockReps,
  };
}

/**
 * Geocode a full address
 *
 * @param address - Full street address
 * @returns Geocoded result with lat/lng and Congressional district
 *
 * API ENDPOINT: GET https://api.geocod.io/v1.7/geocode
 * QUERY PARAMETERS: {
 *   q: string (full address),
 *   fields: 'cd',
 *   api_key: string
 * }
 * SUCCESS RESPONSE: Same structure as lookupByZipCode
 */
export async function geocodeAddress(
  address: string
): Promise<APIResponse<GeocodeResponse>> {
  // API ENDPOINT: GET https://api.geocod.io/v1.7/geocode
  // QUERY PARAMETERS: {
  //   q: encodeURIComponent(address),
  //   fields: 'cd',
  //   api_key: process.env.GEOCODIO_API_KEY
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      input: {
        address_components: {
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          country: 'US',
        },
        formatted_address: '1 Dr Carlton B Goodlett Pl, San Francisco, CA 94102',
      },
      results: [
        {
          address_components: {
            number: '1',
            street: 'Dr Carlton B Goodlett',
            suffix: 'Pl',
            formatted_street: 'Dr Carlton B Goodlett Pl',
            city: 'San Francisco',
            state: 'CA',
            zip: '94102',
            country: 'US',
          },
          formatted_address: '1 Dr Carlton B Goodlett Pl, San Francisco, CA 94102',
          location: {
            lat: 37.7793,
            lng: -122.4193,
          },
          accuracy: 1,
          accuracy_type: 'rooftop',
          source: 'TIGER/Line® dataset from the US Census Bureau',
        },
      ],
    },
  };
}

/**
 * Reverse geocode coordinates to Congressional district
 *
 * @param latitude - Latitude coordinate
 * @param longitude - Longitude coordinate
 * @returns Congressional district information
 *
 * API ENDPOINT: GET https://api.geocod.io/v1.7/reverse
 * QUERY PARAMETERS: {
 *   q: "lat,lng" (e.g., "37.7749,-122.4194"),
 *   fields: 'cd',
 *   api_key: string
 * }
 */
export async function reverseGeocode(
  latitude: number,
  longitude: number
): Promise<APIResponse<GeocodeResponse>> {
  // API ENDPOINT: GET https://api.geocod.io/v1.7/reverse
  // QUERY PARAMETERS: {
  //   q: `${latitude},${longitude}`,
  //   fields: 'cd',
  //   api_key: process.env.GEOCODIO_API_KEY
  // }

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      input: {
        address_components: {
          city: 'San Francisco',
          state: 'CA',
          zip: '94102',
          country: 'US',
        },
        formatted_address: 'San Francisco, CA 94102',
      },
      results: [],
    },
  };
}
