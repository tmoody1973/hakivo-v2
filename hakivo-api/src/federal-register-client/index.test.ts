import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Import after mocking
import FederalRegisterClient from './index';

describe('FederalRegisterClient', () => {
  let client: InstanceType<typeof FederalRegisterClient>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create client instance without Raindrop dependencies for testing
    client = new (FederalRegisterClient as any)();
  });

  describe('searchDocuments', () => {
    it('should search documents with default parameters', async () => {
      const mockResponse = {
        count: 100,
        total_pages: 5,
        results: [
          {
            document_number: '2024-12345',
            type: 'RULE',
            title: 'Test Rule',
            publication_date: '2024-01-15',
            agencies: [{ name: 'EPA', slug: 'environmental-protection-agency' }],
            agency_names: ['Environmental Protection Agency']
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const results = await client.searchDocuments();

      expect(mockFetch).toHaveBeenCalledTimes(1);
      expect(results.count).toBe(100);
      expect(results.results).toHaveLength(1);
      expect(results.results[0]?.document_number).toBe('2024-12345');
    });

    it('should apply search term filter', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 5, results: [] })
      });

      await client.searchDocuments({ term: 'climate change' });

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain('conditions%5Bterm%5D=climate%20change');
    });

    it('should handle rate limiting error', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 429,
        statusText: 'Too Many Requests'
      });

      await expect(client.searchDocuments()).rejects.toThrow('rate limit exceeded');
    });
  });

  describe('getExecutiveOrders', () => {
    it('should fetch executive orders', async () => {
      const mockResponse = {
        count: 10,
        total_pages: 1,
        results: [
          {
            document_number: '2024-00001',
            type: 'PRESDOCU',
            title: 'Executive Order on AI',
            executive_order_number: '14110',
            president: { name: 'Biden', identifier: 'joe-biden' },
            publication_date: '2024-01-15',
            agencies: [],
            agency_names: []
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const results = await client.getExecutiveOrders();

      expect(results.count).toBe(10);
      expect(results.results[0]?.executive_order_number).toBe('14110');
    });

    it('should filter by president', async () => {
      const mockResponse = {
        count: 2,
        total_pages: 1,
        results: [
          {
            document_number: '2024-00001',
            type: 'PRESDOCU',
            title: 'Biden Order',
            president: { name: 'Joseph R. Biden Jr.', identifier: 'joe-biden' }
          },
          {
            document_number: '2023-00001',
            type: 'PRESDOCU',
            title: 'Trump Order',
            president: { name: 'Donald J. Trump', identifier: 'donald-trump' }
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const results = await client.getExecutiveOrders({ president: 'biden' });

      expect(results.results).toHaveLength(1);
      expect(results.results[0]?.document_number).toBe('2024-00001');
    });
  });

  describe('getOpenForComment', () => {
    it('should fetch documents open for comment', async () => {
      const mockResponse = {
        count: 25,
        total_pages: 2,
        results: [
          {
            document_number: '2024-12345',
            type: 'PRORULE',
            title: 'Proposed Rule on Emissions',
            comments_close_on: '2024-02-15',
            comment_url: 'https://regulations.gov/comment/EPA-2024-0001'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const results = await client.getOpenForComment({ closingWithinDays: 30 });

      expect(results.results[0]?.comments_close_on).toBe('2024-02-15');
    });
  });

  describe('getDocument', () => {
    it('should fetch a single document', async () => {
      const mockDoc = {
        document_number: '2024-12345',
        type: 'RULE',
        title: 'Important Rule',
        abstract: 'This rule does important things',
        publication_date: '2024-01-15',
        agencies: [{ name: 'EPA', slug: 'environmental-protection-agency' }],
        agency_names: ['Environmental Protection Agency'],
        html_url: 'https://federalregister.gov/d/2024-12345',
        pdf_url: 'https://federalregister.gov/d/2024-12345.pdf'
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockDoc)
      });

      const doc = await client.getDocument('2024-12345');

      expect(doc.document_number).toBe('2024-12345');
      expect(doc.title).toBe('Important Rule');
    });
  });

  describe('getTodaysDocuments', () => {
    it('should fetch documents published today', async () => {
      const today = new Date().toISOString().split('T')[0];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 50, results: [] })
      });

      await client.getTodaysDocuments();

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain(`publication_date%5D%5Bgte%5D=${today}`);
      expect(callUrl).toContain(`publication_date%5D%5Blte%5D=${today}`);
    });
  });

  describe('searchByPolicyInterest', () => {
    it('should search by climate interest', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 15, results: [] })
      });

      await client.searchByPolicyInterest('climate');

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain('conditions%5Bterm%5D=');
      expect(callUrl).toContain('climate');
    });

    it('should handle unknown interests', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 0, results: [] })
      });

      await client.searchByPolicyInterest('obscure-topic');

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain('obscure-topic');
    });
  });

  describe('getAgencies', () => {
    it('should fetch all agencies', async () => {
      const mockAgencies = [
        { name: 'EPA', slug: 'environmental-protection-agency', id: 1 },
        { name: 'FDA', slug: 'food-and-drug-administration', id: 2 }
      ];

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockAgencies)
      });

      const agencies = await client.getAgencies();

      expect(agencies).toHaveLength(2);
      expect(agencies[0]?.slug).toBe('environmental-protection-agency');
    });
  });

  describe('getSignificantActions', () => {
    it('should fetch significant regulatory actions', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ count: 10, results: [] })
      });

      await client.getSignificantActions({ since: '2024-01-01' });

      const callUrl = mockFetch.mock.calls[0]?.[0] as string;
      expect(callUrl).toContain('conditions%5Bsignificant%5D=1');
    });
  });

  describe('getPublicInspectionDocuments', () => {
    it('should fetch public inspection documents', async () => {
      const mockResponse = {
        count: 5,
        results: [
          {
            document_number: '2024-99999',
            type: 'RULE',
            title: 'Upcoming Rule',
            filed_at: '2024-01-14T16:00:00Z'
          }
        ]
      };

      mockFetch.mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: () => Promise.resolve(mockResponse)
      });

      const results = await client.getPublicInspectionDocuments();

      expect(results.count).toBe(5);
    });
  });

  describe('error handling', () => {
    it('should handle network errors', async () => {
      mockFetch.mockRejectedValueOnce(new Error('Network error'));

      await expect(client.searchDocuments()).rejects.toThrow('Federal Register request failed');
    });

    it('should handle API errors', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      });

      await expect(client.searchDocuments()).rejects.toThrow('Federal Register API error: 500');
    });
  });
});
