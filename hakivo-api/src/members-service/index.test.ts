import { describe, it, expect } from 'vitest';

describe('members-service', () => {
  it('should export a Service', async () => {
    const moduleUnderTest = await import('./index');
    expect(moduleUnderTest.default).toBeDefined();
  });
});
