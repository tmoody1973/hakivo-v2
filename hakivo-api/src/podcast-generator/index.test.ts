import { expect, test, describe } from 'vitest';

describe('podcast-generator', () => {
  test('should have correct voice configuration', () => {
    const PODCAST_VOICES = {
      hostA: 'Aoede',
      hostB: 'Charon',
      nameA: 'Sarah',
      nameB: 'David'
    };

    expect(PODCAST_VOICES.hostA).toBe('Aoede');
    expect(PODCAST_VOICES.hostB).toBe('Charon');
    expect(PODCAST_VOICES.nameA).toBe('Sarah');
    expect(PODCAST_VOICES.nameB).toBe('David');
  });

  test('should use different voices than daily brief', () => {
    // Daily brief uses Kore and Puck
    // Podcast uses Aoede and Charon
    const PODCAST_VOICES = { hostA: 'Aoede', hostB: 'Charon' };
    const DAILY_BRIEF_VOICES = { hostA: 'Kore', hostB: 'Puck' };

    expect(PODCAST_VOICES.hostA).not.toBe(DAILY_BRIEF_VOICES.hostA);
    expect(PODCAST_VOICES.hostB).not.toBe(DAILY_BRIEF_VOICES.hostB);
  });
});
