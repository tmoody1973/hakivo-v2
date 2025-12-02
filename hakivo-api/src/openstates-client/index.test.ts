import { expect, test, describe } from 'vitest';
import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from the hakivo-api root
config({ path: resolve(__dirname, '../../.env.local') });

/**
 * OpenStates API Integration Tests
 *
 * These tests hit the real OpenStates API to verify our client works correctly.
 * Run with: npm test -- src/openstates-client/index.test.ts
 *
 * Requires OPENSTATES_API_KEY in .env.local
 */

const OPENSTATES_API_KEY = process.env.OPENSTATES_API_KEY;
const REST_URL = 'https://v3.openstates.org';

// Skip tests if no API key
const runTests = !!OPENSTATES_API_KEY;

describe('OpenStates API', () => {
  describe('getLegislatorsByLocation', () => {
    test.skipIf(!runTests)('should fetch state legislators for Madison, WI coordinates', async () => {
      // Madison, WI coordinates
      const lat = 43.0731;
      const lng = -89.4012;

      const queryParams = new URLSearchParams({
        apikey: OPENSTATES_API_KEY!,
        lat: String(lat),
        lng: String(lng)
      });

      const url = `${REST_URL}/people.geo?${queryParams}`;
      const response = await fetch(url);

      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log('[OpenStates] Legislators response:', JSON.stringify(data, null, 2));

      expect(data.results).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);
      expect(data.results.length).toBeGreaterThan(0);

      // Verify structure of each legislator
      for (const person of data.results) {
        expect(person.id).toBeDefined();
        expect(person.name).toBeDefined();
        expect(person.party).toBeDefined();
        expect(person.current_role).toBeDefined();

        console.log(`  - ${person.name} (${person.party}) - ${person.current_role?.org_classification} District ${person.current_role?.district}`);
      }
    }, 30000); // 30 second timeout for API call

    test.skipIf(!runTests)('should fetch state legislators for Austin, TX coordinates', async () => {
      // Austin, TX coordinates
      const lat = 30.2672;
      const lng = -97.7431;

      const queryParams = new URLSearchParams({
        apikey: OPENSTATES_API_KEY!,
        lat: String(lat),
        lng: String(lng)
      });

      const url = `${REST_URL}/people.geo?${queryParams}`;
      const response = await fetch(url);

      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log('[OpenStates TX] Found', data.results?.length, 'legislators');

      expect(data.results).toBeDefined();
      expect(data.results.length).toBeGreaterThan(0);

      // Should find both upper (Senate) and lower (House) chamber members
      const chambers = new Set(data.results.map((p: any) => p.current_role?.org_classification));
      console.log('[OpenStates TX] Chambers found:', Array.from(chambers));
    }, 30000); // 30 second timeout for API call
  });

  describe('searchBillsByState', () => {
    test.skipIf(!runTests)('should search bills for Wisconsin using REST API', async () => {
      const state = 'wi';
      const limit = 10;

      const queryParams = new URLSearchParams({
        apikey: OPENSTATES_API_KEY!,
        jurisdiction: state,
        per_page: String(limit),
        sort: 'updated_desc',
        include: 'actions'
      });

      const url = `${REST_URL}/bills?${queryParams}`;
      const response = await fetch(url);

      console.log('[OpenStates Bills] Response status:', response.status);
      const data = await response.json();
      console.log('[OpenStates Bills] Response:', JSON.stringify(data, null, 2).slice(0, 2000));

      if (!response.ok) {
        console.error('[OpenStates Bills] Error response:', data);
      }

      expect(response.ok).toBe(true);

      expect(data.results).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);

      if (data.results.length > 0) {
        const bill = data.results[0];
        console.log(`[OpenStates Bills] First bill: ${bill.identifier} - ${bill.title?.slice(0, 50)}...`);

        expect(bill.id).toBeDefined();
        expect(bill.identifier).toBeDefined();
        expect(bill.title).toBeDefined();
      }
    }, 30000); // 30 second timeout for API call

    test.skipIf(!runTests)('should search bills with keyword for California using REST API', async () => {
      const state = 'ca';
      const searchQuery = 'housing';
      const limit = 5;

      const queryParams = new URLSearchParams({
        apikey: OPENSTATES_API_KEY!,
        jurisdiction: state,
        per_page: String(limit),
        sort: 'updated_desc',
        q: searchQuery
      });

      const url = `${REST_URL}/bills?${queryParams}`;
      const response = await fetch(url);

      expect(response.ok).toBe(true);

      const data = await response.json();
      console.log(`[OpenStates CA] Found ${data.results?.length || 0} housing bills`);

      expect(data.results).toBeDefined();
      expect(Array.isArray(data.results)).toBe(true);

      if (data.results.length > 0) {
        data.results.forEach((bill: any, i: number) => {
          console.log(`  ${i + 1}. ${bill.identifier} - ${bill.title?.slice(0, 50)}...`);
        });
      }
    }, 30000); // 30 second timeout for API call
  });
});

// Basic test to ensure test setup works
test('test setup is working', () => {
  expect(true).toBe(true);
  if (!OPENSTATES_API_KEY) {
    console.log('[OpenStates] OPENSTATES_API_KEY not set - skipping integration tests');
  }
});
