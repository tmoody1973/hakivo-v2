/**
 * Tests for HTTP Service Handler
 *
 * FOCUSED TESTING APPROACH:
 * - Simple, essential tests for production safety
 * - Tests actual endpoints, not just instantiation
 * - Covers basic error scenarios
 * - Easy to extend with additional tests
 */

import { expect, test, describe, beforeEach, vi } from 'vitest';

// Simple mock environment with only what this template uses
function createMockEnv() {
  return {
    _raindrop: {
      app: {
        organizationId: 'test-org',
        applicationName: 'test-app',
      },
    },
    logger: {
      info: vi.fn(),
      error: vi.fn(),
      warn: vi.fn(),
    },
    // Add additional bindings here as you add features to your service
  };
}

import handler from './index.js';

describe('gamma-service HTTP Service', () => {
  let service: any;
  let env: any;
  let ctx: any;

  beforeEach(() => {
    env = createMockEnv();
    ctx = { waitUntil: vi.fn() };
    service = new handler(ctx, env);
  });

  test('service instantiates correctly', () => {
    expect(service).toBeDefined();
    expect(typeof service.fetch).toBe('function');
  });

  test('has access to environment bindings', () => {
    expect(env.logger).toBeDefined();
    expect(env._raindrop).toBeDefined();
    expect(env._raindrop.app.organizationId).toBe('test-org');
  });

  // === Essential API Tests ===

  test('health check endpoint works', async () => {
    const request = new Request('https://example.com/health', {
      method: 'GET',
    });

    const response = await service.fetch(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.status).toBe('ok');
    expect(data.timestamp).toBeDefined();
  });

  test('hello endpoint returns correct response', async () => {
    const request = new Request('https://example.com/api/hello', {
      method: 'GET',
    });

    const response = await service.fetch(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('Hello from gamma-service!');
  });

  test('hello endpoint with name parameter', async () => {
    const request = new Request('https://example.com/api/hello/world', {
      method: 'GET',
    });

    const response = await service.fetch(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.message).toBe('Hello, world!');
  });

  test('echo endpoint processes valid JSON', async () => {
    const testData = { message: 'test', value: 123 };
    const request = new Request('https://example.com/api/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testData),
    });

    const response = await service.fetch(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.received).toEqual(testData);
  });

  test('echo endpoint handles invalid JSON gracefully', async () => {
    const request = new Request('https://example.com/api/echo', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'invalid-json{',
    });

    const response = await service.fetch(request);

    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Invalid JSON format');
  });

  test('returns 404 for unknown routes', async () => {
    const request = new Request('https://example.com/api/nonexistent', {
      method: 'GET',
    });

    const response = await service.fetch(request);

    expect(response.status).toBe(404);
  });

  test('handles OPTIONS requests for CORS', async () => {
    const request = new Request('https://example.com/api/test', {
      method: 'OPTIONS',
    });

    const response = await service.fetch(request);

    // Should handle CORS preflight
    expect([200, 204, 404]).toContain(response.status);
  });

  // === Production Safety Tests ===

  test('handles malformed URLs safely', async () => {
    const request = new Request('https://example.com/api/<script>alert(1)</script>', {
      method: 'GET',
    });

    const response = await service.fetch(request);

    // Should handle gracefully, not crash
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

// === Add Your Custom Tests Here ===
//
// Need help testing specific patterns? See examples:
// • File uploads → https://docs.liquidmetal.ai/reference/smartbucket
// • Database queries → https://docs.liquidmetal.ai/reference/smartsql
// • Memory management → https://docs.liquidmetal.ai/reference/smartmemory
// • Queue processing → https://docs.liquidmetal.ai/reference/queue
});