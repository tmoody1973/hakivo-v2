/**
 * Tests for Task Handler
 *
 * FOCUSED TESTING APPROACH:
 * - Simple, essential tests for scheduled tasks
 * - Tests actual task execution
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
    // Add additional bindings here as you add features to your task
  };
}

import handler from './index.js';

describe('SpreakerSyncScheduler Task', () => {
  let task: any;
  let env: any;
  let ctx: any;

  beforeEach(() => {
    env = createMockEnv();
    ctx = { waitUntil: vi.fn() };
    task = new handler(ctx, env);
  });

  test('task instantiates correctly', () => {
    expect(task).toBeDefined();
    expect(typeof task.handle).toBe('function');
  });

  test('has access to environment bindings', () => {
    expect(env.logger).toBeDefined();
    expect(env._raindrop).toBeDefined();
    expect(env._raindrop.app.organizationId).toBe('test-org');
  });

  // === Essential Task Tests ===

  test('handles scheduled events', async () => {
    const event: any = {
      type: 'scheduled',
      scheduledTime: Date.now(),
      cron: '0 8 * * *',
    };

    await task.handle(event);

    expect(env.logger.info).toHaveBeenCalledWith(
      'Scheduled task executed',
      expect.objectContaining({ cron: '0 8 * * *' })
    );
  });

  test('handles errors gracefully', async () => {
    const event: any = {
      type: 'scheduled',
      scheduledTime: Date.now(),
      cron: '*/5 * * * *',
    };

    // Should not throw even if task logic errors
    await expect(task.handle(event)).resolves.toBeUndefined();
  });

  test('processes multiple consecutive runs', async () => {
    const event: any = {
      type: 'scheduled',
      scheduledTime: Date.now(),
      cron: '0 * * * *',
    };

    await task.handle(event);
    await task.handle(event);
    await task.handle(event);

    expect(env.logger.info).toHaveBeenCalledTimes(6); // 3 executions * 2 logs each
  });

  // === Add Your Custom Tests Here ===
});
