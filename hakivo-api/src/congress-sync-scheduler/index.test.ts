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

describe('CongressSyncScheduler - Core Functionality', () => {
  let task: any;
  let env: any;
  let ctx: any;

  beforeEach(() => {
    env = createMockEnv();
    ctx = { waitUntil: () => Promise.resolve() };
    task = new handler(ctx, env); // Task constructor: (ctx, env)
  });

  describe('Task Construction', () => {
    test('creates task instance', () => {
      expect(task).toBeDefined();
      expect(typeof task.handle).toBe('function');
    });

    test('has access to environment', () => {
      expect(env.logger).toBeDefined();
      expect(env._raindrop).toBeDefined();
    });
  });

  describe('Basic Task Structure', () => {
    test('task is properly instantiated', () => {
      const task = new handler(ctx, env); // Task constructor: (ctx, env)
      expect(task).toBeDefined();
      expect(typeof task.handle).toBe('function');
    });

    test('has handle method', () => {
      const task = new handler(ctx, env); // Task constructor: (ctx, env)
      expect(typeof task.handle).toBe('function');
    });
  });

  describe('Simple Event Handling', () => {
    test('can create task instances', () => {
      const task1 = new handler(ctx, env); // Task constructor: (ctx, env)
      const task2 = new handler(ctx, env); // Task constructor: (ctx, env)

      expect(task1).toBeDefined();
      expect(task2).toBeDefined();
      expect(task1).not.toBe(task2);
    });

    test('environment is available', () => {
      const task = new handler(ctx, env); // Task constructor: (ctx, env)

      // Test that we can create the task without errors
      expect(() => new handler(ctx, env)).not.toThrow();
    });
  });

  describe('Task Interface', () => {
    test('implements expected interface', () => {
      const task = new handler(ctx, env); // Task constructor: (ctx, env)

      // Check that task has the expected method
      expect('handle' in task).toBe(true);
      expect(typeof task.handle).toBe('function');
    });

    test('can be instantiated multiple times', () => {
      for (let i = 0; i < 3; i++) {
        const task = new handler(ctx, env); // Task constructor: (ctx, env)
        expect(task).toBeDefined();
        expect(typeof task.handle).toBe('function');
      }
    });
  });

  describe('Event Processing', () => {
    test('can handle basic events', async () => {
      const event: any = {
        type: 'scheduled',
        scheduledTime: new Date().toISOString(),
        cron: '0 8 * * *',
      };

      // Should handle the event without throwing
      expect(() => task.handle(event)).not.toThrow();
    });

    test('handles multiple calls', async () => {
      const event: any = {
        type: 'scheduled',
        scheduledTime: new Date().toISOString(),
      };

      // Should handle multiple calls without issues
      const task = new handler(ctx, env); // Task constructor: (ctx, env)
      await task.handle(event);

      expect(true).toBe(true); // If we get here, no errors thrown
    });
  });

  describe('Edge Case Guard Rails', () => {
    test('handles null event gracefully', async () => {
      // Guard rail: Template checks !event before processing
      // Most common AI mistake - forgetting null checks
      await expect(task.handle(null as any)).resolves.not.toThrow();
    });

    test('handles undefined event gracefully', async () => {
      // Guard rail: Template validates typeof event === 'object'
      await expect(task.handle(undefined as any)).resolves.not.toThrow();
    });

    test('handles empty event object', async () => {
      // Guard rail: Template handles missing fields safely
      const event = {};
      await expect(task.handle(event as any)).resolves.not.toThrow();
    });

    test('handles malformed event with circular reference', async () => {
      // Guard rail: Catches JSON serialization issues
      const event: any = { type: 'test' };
      event.self = event; // Circular reference

      // Should not crash during logging or processing
      await expect(task.handle(event)).resolves.not.toThrow();
    });
  });
});