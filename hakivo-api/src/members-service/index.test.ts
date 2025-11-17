import { describe, it, expect } from 'vitest';

describe('members-service', () => {
  it('should export a Service', async () => {
    const module = await import('./index');
    expect(module.default).toBeDefined();
  });
});
