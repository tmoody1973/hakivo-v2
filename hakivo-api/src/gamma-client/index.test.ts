import { expect, test, describe, beforeEach, vi, afterEach } from 'vitest';

// Simple mock environment
function createMockEnv() {
  const mockLogger = {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
    log: vi.fn(),
    logAtLevel: vi.fn(),
    message: vi.fn(),
    messageAtLevel: vi.fn(),
    with: vi.fn(),
    withError: vi.fn(),
  };

  mockLogger.with.mockReturnValue(mockLogger);
  mockLogger.withError.mockReturnValue(mockLogger);

  return {
    _raindrop: {
      app: {
        organizationId: 'test-org',
        applicationName: 'test-app',
        versionId: 'test-version',
        scriptName: 'test-script',
        visibility: 'public',
      },
    },
    logger: mockLogger,
    GAMMA_API_KEY: 'test-gamma-api-key',
  };
}

import handler from './index.js';

describe('gamma-client', () => {
  let service: any;
  let env: any;
  let ctx: any;

  beforeEach(() => {
    env = createMockEnv();
    ctx = { waitUntil: () => Promise.resolve() };
    service = new handler(ctx, env);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Service Initialization', () => {
    test('creates service instance', () => {
      expect(service).toBeDefined();
    });

    test('throws error when API key is missing', async () => {
      const envWithoutKey = { ...env, GAMMA_API_KEY: '' };
      const serviceWithoutKey = new handler(ctx, envWithoutKey);

      await expect(
        serviceWithoutKey.generate({
          inputText: 'Test content',
          textMode: 'generate',
        })
      ).rejects.toThrow('GAMMA_API_KEY environment variable is not set');
    });
  });

  describe('fetch() - Private Service', () => {
    test('returns 501 Not Implemented', async () => {
      const request = new Request('https://example.com/test', {
        method: 'GET',
      });

      const response = await service.fetch(request, env, ctx);

      expect(response.status).toBe(501);
      const text = await response.text();
      expect(text).toBe('Not Implemented - Private Service');
    });
  });

  describe('generate()', () => {
    test('sends correct request to Gamma API', async () => {
      const mockResponse = {
        id: 'gen-123',
        status: 'pending',
        createdAt: '2024-01-01T00:00:00Z',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.generate({
        inputText: '# Test Content\n\nSome text here.',
        textMode: 'generate',
        format: 'presentation',
        textOptions: {
          amount: 'medium',
          audience: 'Students',
        },
      });

      expect(result.id).toBe('gen-123');
      expect(result.status).toBe('pending');

      expect(global.fetch).toHaveBeenCalledWith(
        'https://public-api.gamma.app/v1.0/generations',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Authorization': 'Bearer test-gamma-api-key',
            'Content-Type': 'application/json',
          }),
        })
      );
    });

    test('handles API errors gracefully', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: false,
        status: 429,
        text: () => Promise.resolve('Rate limited'),
      });

      await expect(
        service.generate({
          inputText: 'Test',
          textMode: 'generate',
        })
      ).rejects.toThrow('Gamma API error: 429');
    });
  });

  describe('getStatus()', () => {
    test('fetches generation status', async () => {
      const mockResponse = {
        id: 'gen-123',
        status: 'completed',
        url: 'https://gamma.app/docs/test',
        thumbnailUrl: 'https://gamma.app/thumb/test',
        cardCount: 10,
        createdAt: '2024-01-01T00:00:00Z',
        completedAt: '2024-01-01T00:01:00Z',
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.getStatus('gen-123');

      expect(result.status).toBe('completed');
      expect(result.url).toBe('https://gamma.app/docs/test');
      expect(result.cardCount).toBe(10);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://public-api.gamma.app/v1.0/generations/gen-123',
        expect.objectContaining({
          method: 'GET',
        })
      );
    });
  });

  describe('listThemes()', () => {
    test('fetches available themes', async () => {
      const mockResponse = {
        themes: [
          { id: 'theme-1', name: 'Professional', category: 'Business' },
          { id: 'theme-2', name: 'Creative', category: 'Design' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.listThemes();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('Professional');
      expect(result[1].category).toBe('Design');
    });
  });

  describe('listFolders()', () => {
    test('fetches available folders', async () => {
      const mockResponse = {
        folders: [
          { id: 'folder-1', name: 'My Presentations' },
          { id: 'folder-2', name: 'Client Work' },
        ],
      };

      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });

      const result = await service.listFolders();

      expect(result).toHaveLength(2);
      expect(result[0].name).toBe('My Presentations');
    });
  });

  describe('waitForCompletion()', () => {
    test('polls until completion', async () => {
      const pendingResponse = { id: 'gen-123', status: 'processing' };
      const completedResponse = {
        id: 'gen-123',
        status: 'completed',
        url: 'https://gamma.app/docs/test',
      };

      let callCount = 0;
      global.fetch = vi.fn().mockImplementation(() => {
        callCount++;
        return Promise.resolve({
          ok: true,
          json: () =>
            Promise.resolve(callCount < 3 ? pendingResponse : completedResponse),
        });
      });

      const result = await service.waitForCompletion('gen-123', {
        interval: 10, // Fast polling for tests
        timeout: 1000,
      });

      expect(result.status).toBe('completed');
      expect(callCount).toBe(3);
    });

    test('throws on failure status', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'gen-123',
            status: 'failed',
            error: 'Generation failed due to content policy',
          }),
      });

      await expect(
        service.waitForCompletion('gen-123', { interval: 10, timeout: 1000 })
      ).rejects.toThrow('Generation failed due to content policy');
    });

    test('throws on timeout', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: 'gen-123', status: 'processing' }),
      });

      await expect(
        service.waitForCompletion('gen-123', { interval: 10, timeout: 50 })
      ).rejects.toThrow('timed out');
    });
  });

  describe('getExportUrl()', () => {
    test('returns PDF export URL', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'gen-123',
            status: 'completed',
            exports: {
              pdf: 'https://gamma.app/export/gen-123.pdf',
              pptx: 'https://gamma.app/export/gen-123.pptx',
            },
          }),
      });

      const url = await service.getExportUrl('gen-123', 'pdf');

      expect(url).toBe('https://gamma.app/export/gen-123.pdf');
    });

    test('throws if generation not completed', async () => {
      global.fetch = vi.fn().mockResolvedValueOnce({
        ok: true,
        json: () =>
          Promise.resolve({
            id: 'gen-123',
            status: 'processing',
          }),
      });

      await expect(service.getExportUrl('gen-123', 'pdf')).rejects.toThrow(
        'Cannot get export URL: generation is processing'
      );
    });
  });
});
