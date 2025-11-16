/**
 * Geocodio API Types
 *
 * Type definitions for Geocodio geocoding API, specifically for
 * zip code to Congressional district lookup.
 *
 * API Documentation: https://www.geocod.io/docs/
 */

import { APIResponse } from './common.types';

// ============================================================================
// Geocoding Types
// ============================================================================

/**
 * Geocoding result
 */
export interface GeocodeResult {
  address_components: AddressComponents;
  formatted_address: string;
  location: Location;
  accuracy: number;
  accuracy_type: string;
  source: string;
}

/**
 * Address components
 */
export interface AddressComponents {
  number?: string;
  predirectional?: string;
  street?: string;
  suffix?: string;
  formatted_street?: string;
  city: string;
  county?: string;
  state: string;
  zip: string;
  country: string;
}

/**
 * Geographic location
 */
export interface Location {
  lat: number;
  lng: number;
}

// ============================================================================
// Congressional District Types
// ============================================================================

/**
 * Congressional district information
 */
export interface CongressionalDistrict {
  name: string;
  district_number: number;
  congress_number: string;
  congress_years: string;
  proportion: number;
  current_legislators?: Legislator[];
}

/**
 * Legislator information from Geocodio
 */
export interface Legislator {
  type: 'senator' | 'representative';
  bio: {
    last_name: string;
    first_name: string;
    birthday: string;
    gender: string;
    party: string;
  };
  contact: {
    url?: string;
    address?: string;
    phone?: string;
    contact_form?: string;
  };
  social?: {
    twitter?: string;
    facebook?: string;
    youtube?: string;
  };
  references: {
    bioguide_id: string;
    thomas_id?: string;
    opensecrets_id?: string;
    lis_id?: string;
    cspan_id?: string;
    govtrack_id?: string;
    votesmart_id?: string;
    ballotpedia_id?: string;
    washington_post_id?: string;
    icpsr_id?: string;
    wikipedia_id?: string;
  };
  source: string;
}

// ============================================================================
// Geocodio Fields
// ============================================================================

/**
 * Available Geocodio data fields
 */
export interface GeocodioFields {
  congressional_districts?: CongressionalDistrict[];
  state_legislative_districts?: any[];
  school_districts?: any[];
  census?: any;
  timezone?: any;
}

// ============================================================================
// Request/Response Types
// ============================================================================

/**
 * Geocode request parameters
 */
export interface GeocodeRequest {
  query: string; // Address or zip code
  fields?: string[]; // e.g., ['cd', 'stateleg', 'school', 'census', 'timezone']
  limit?: number;
}

/**
 * Geocode response
 */
export interface GeocodeResponse {
  input: {
    address_components: AddressComponents;
    formatted_address: string;
  };
  results: Array<GeocodeResult & { fields?: GeocodioFields }>;
}

/**
 * Reverse geocode request
 */
export interface ReverseGeocodeRequest {
  latitude: number;
  longitude: number;
  fields?: string[];
}

// ============================================================================
// Helper Types
// ============================================================================

/**
 * Simplified district lookup result
 */
export interface DistrictLookupResult {
  state: string;
  district: number;
  representatives: {
    senators: Legislator[];
    representative: Legislator | null;
  };
}

/**
 * Representative summary
 */
export interface RepresentativeSummary {
  type: 'senator' | 'representative';
  name: string;
  party: string;
  bioguideId: string;
  phone?: string;
  website?: string;
}
