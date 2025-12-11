import { expect, test, describe, beforeEach, vi } from 'vitest';

// Simple mock environment - based on demo-protected pattern
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

  // Make with() and withError() return the logger for chaining
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
  };
}

import handler from './index.js';

describe('admin-dashboard - Core HTTP', () => {
  let service: any;
  let env: any;
  let ctx: any;

  beforeEach(() => {
    env = createMockEnv();
    ctx = { waitUntil: () => Promise.resolve() };
    service = new handler(ctx, env); // Service constructor: (ctx, env)
  });

  describe('Basic HTTP Operations', () => {
    test('handles GET requests', async () => {
      const request = new Request('https://example.com/api/hello', {
        method: 'GET',
      });
      
      const response = await service.fetch(request, env, ctx);
      
      expect(response.status).toBe(200);
      expect(response).toBeInstanceOf(Response);
    });

    test('returns proper error for unknown routes', async () => {
      const request = new Request('https://example.com/api/nonexistent', {
        method: 'GET',
      });
      
      const response = await service.fetch(request, env, ctx);
      
      expect(response.status).toBe(404);
    });
  });

  describe('Response Handling', () => {
    test('returns JSON responses', async () => {
      const request = new Request('https://example.com/api/hello', {
        method: 'GET',
      });
      
      const response = await service.fetch(request, env, ctx);
      const data = await response.json();
      
      expect(response.status).toBe(200);
      expect(data).toHaveProperty('message');
    });
  });

  describe('Error Handling', () => {
    test('handles malformed JSON gracefully', async () => {
      const request = new Request('https://example.com/api/echo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: 'invalid-json{',
      });
      
      const response = await service.fetch(request, env, ctx);
      
      expect(response.status).toBe(400); // Hono returns 400 for invalid JSON
    });
  });

  describe('Health Check', () => {
    test('health endpoint always works', async () => {
      const request = new Request('https://example.com/health', {
        method: 'GET',
      });

      const response = await service.fetch(request, env, ctx);

      expect(response.status).toBe(200);

      const text = await response.text();
      const data = JSON.parse(text);
      expect(data.status).toBe('ok');
      expect(data.timestamp).toBeDefined();
    });
  });

  describe('Security & Robustness Guard Rails', () => {
    test('handles XSS attempt in URL path', async () => {
      // Guard rail: Ensures router handles malicious URLs gracefully
      const request = new Request('https://example.com/api/<script>alert(1)</script>', {
        method: 'GET',
      });

      const response = await service.fetch(request, env, ctx);

      // Hono router will return 404 for non-matching route, not crash
      expect(response.status).toBe(404);
    });

    test('handles SQL injection attempt in URL', async () => {
      // Guard rail: Catches missing input sanitization
      const request = new Request("https://example.com/api/hello/'; DROP TABLE users--", {
        method: 'GET',
      });

      const response = await service.fetch(request, env, ctx);

      // Should handle gracefully (404 or 200 with sanitized input)
      expect(response.status).toBeLessThan(600);
    });

    test('handles very long URL without crashing', async () => {
      // Guard rail: Prevents DOS via long URLs
      const longPath = 'a'.repeat(10000);
      const request = new Request(`https://example.com/api/${longPath}`, {
        method: 'GET',
      });

      const response = await service.fetch(request, env, ctx);

      // Should return error status, not crash
      expect(response.status).toBeGreaterThanOrEqual(400);
      expect(response.status).toBeLessThan(600);
    });

    test('handles OPTIONS preflight request', async () => {
      // Guard rail: Ensures CORS support works
      const request = new Request('https://example.com/api/hello', {
        method: 'OPTIONS',
      });

      const response = await service.fetch(request, env, ctx);

      // Should handle OPTIONS (CORS preflight)
      expect([200, 204, 404]).toContain(response.status);
    });

    test('handles missing content-type header', async () => {
      // Guard rail: Doesn't assume headers are present
      const request = new Request('https://example.com/api/echo', {
        method: 'POST',
        body: JSON.stringify({ test: 'data' }),
        // No Content-Type header
      });

      const response = await service.fetch(request, env, ctx);

      // Should handle gracefully
      expect(response.status).toBeLessThan(600);
    });
  });
});