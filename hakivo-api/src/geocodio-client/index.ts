import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

export default class extends Service<Env> {
  private readonly BASE_URL = 'https://api.geocod.io/v1.7';

  /**
   * Get Geocodio API key from environment
   */
  private getApiKey(): string {
    const apiKey = this.env.GEOCODIO_API_KEY;

    if (!apiKey) {
      throw new Error('GEOCODIO_API_KEY environment variable is not set');
    }

    return apiKey;
  }

  /**
   * Lookup Congressional district from zip code
   * Used by user-service for profile setup
   *
   * @param zipCode - 5-digit US zip code
   * @returns Congressional district information with coordinates
   */
  async lookupDistrict(zipCode: string): Promise<{
    state: string;
    district: string;
    congressionalDistrict: string; // Format: "CA-12"
    city: string;
    county: string;
    lat: number;
    lng: number;
  }> {
    const apiKey = this.getApiKey();

    // Validate zip code format
    if (!/^\d{5}$/.test(zipCode)) {
      throw new Error('Invalid zip code format. Must be 5 digits.');
    }

    const url = `${this.BASE_URL}/geocode?q=${zipCode}&fields=cd&api_key=${apiKey}`;

    try {
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Geocodio API error: ${response.status} ${response.statusText}`);
      }

      const data: any = await response.json();

      if (!data.results || data.results.length === 0) {
        throw new Error(`No results found for zip code: ${zipCode}`);
      }

      // Get the first (most accurate) result
      const result = data.results[0];
      const addressComponents = result.address_components;
      const fields = result.fields;

      // Extract Congressional district
      const congressionalDistricts = fields?.congressional_districts;
      if (!congressionalDistricts || congressionalDistricts.length === 0) {
        throw new Error(`No Congressional district found for zip code: ${zipCode}`);
      }

      const cd = congressionalDistricts[0];
      const state = addressComponents.state;
      const district = cd.district_number.toString();
      const congressionalDistrict = `${state}-${district}`;

      // Extract coordinates from the result location
      const location = result.location;
      const lat = location?.lat || 0;
      const lng = location?.lng || 0;

      console.log(`✓ Geocodio lookup: ${zipCode} → ${congressionalDistrict} (${lat}, ${lng})`);

      return {
        state,
        district,
        congressionalDistrict,
        city: addressComponents.city || '',
        county: addressComponents.county || '',
        lat,
        lng
      };
    } catch (error) {
      console.error('Geocodio lookup error:', error);
      throw new Error(`Geocodio lookup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Batch lookup multiple zip codes
   * Useful for bulk operations
   *
   * @param zipCodes - Array of zip codes
   * @returns Map of zip codes to district info
   */
  async batchLookup(zipCodes: string[]): Promise<Map<string, {
    state: string;
    district: string;
    congressionalDistrict: string;
    city: string;
    county: string;
  }>> {
    const results = new Map();

    // Process in parallel batches of 10
    const batchSize = 10;
    for (let i = 0; i < zipCodes.length; i += batchSize) {
      const batch = zipCodes.slice(i, i + batchSize);
      const promises = batch.map(async zipCode => {
        try {
          const result = await this.lookupDistrict(zipCode);
          return { zipCode, result };
        } catch (error) {
          console.error(`Failed to lookup ${zipCode}:`, error);
          return { zipCode, result: null };
        }
      });

      const batchResults = await Promise.all(promises);
      for (const { zipCode, result } of batchResults) {
        if (result) {
          results.set(zipCode, result);
        }
      }
    }

    console.log(`✓ Geocodio batch lookup: ${results.size}/${zipCodes.length} successful`);

    return results;
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
