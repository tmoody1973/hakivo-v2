import { describe, it, expect } from 'vitest';
import {
  scoreDocument,
  scoreAndRankDocuments,
  extractTopKeywords,
  calculateQuickRelevance,
  getSuggestedAgencies,
  POLICY_KEYWORD_MAPPINGS,
  type UserRelevanceProfile
} from './scoring';
import type { FederalRegisterDocument } from './index';

// Mock document factory
function createMockDocument(overrides: Partial<FederalRegisterDocument> = {}): FederalRegisterDocument {
  return {
    document_number: '2025-00001',
    type: 'RULE',
    title: 'Test Document Title',
    publication_date: new Date().toISOString().split('T')[0]!,
    agencies: [{
      raw_name: 'Environmental Protection Agency',
      name: 'Environmental Protection Agency',
      id: 145,
      url: 'https://www.federalregister.gov/agencies/environmental-protection-agency',
      json_url: 'https://www.federalregister.gov/api/v1/agencies/145',
      slug: 'environmental-protection-agency'
    }],
    agency_names: ['Environmental Protection Agency'],
    html_url: 'https://www.federalregister.gov/documents/2025/01/01/2025-00001/test',
    pdf_url: 'https://www.federalregister.gov/documents/2025/01/01/2025-00001/test.pdf',
    json_url: 'https://www.federalregister.gov/api/v1/documents/2025-00001',
    page_length: 5,
    ...overrides
  };
}

// Test user profile
const testProfile: UserRelevanceProfile = {
  policyInterests: ['climate', 'healthcare'],
  followedAgencyIds: [145], // EPA
  followedAgencySlugs: ['environmental-protection-agency'],
  state: 'CA'
};

describe('scoreDocument', () => {
  it('should score a document with keyword matches', () => {
    const doc = createMockDocument({
      title: 'Climate Change Mitigation Standards',
      abstract: 'New emissions standards for reducing greenhouse gas emissions'
    });

    const score = scoreDocument(doc, testProfile);

    expect(score.total).toBeGreaterThan(0);
    expect(score.keywordScore).toBeGreaterThan(0);
    expect(score.matchedKeywords.length).toBeGreaterThan(0);
    expect(score.matchedKeywords).toContain('climate');
  });

  it('should score a document from followed agency', () => {
    const doc = createMockDocument({
      title: 'Administrative Rule Update'
    });

    const score = scoreDocument(doc, testProfile);

    expect(score.agencyScore).toBe(100);
    expect(score.matchedAgencies).toContain('Environmental Protection Agency');
  });

  it('should give higher scores to significant documents', () => {
    const regularDoc = createMockDocument({
      title: 'Climate Change Rule',
      significant: false
    });

    const significantDoc = createMockDocument({
      title: 'Climate Change Rule',
      significant: true
    });

    const regularScore = scoreDocument(regularDoc, testProfile);
    const significantScore = scoreDocument(significantDoc, testProfile);

    expect(significantScore.typeScore).toBeGreaterThan(regularScore.typeScore);
  });

  it('should score urgency for documents with comment deadlines', () => {
    // Document with comment period closing in 5 days
    const fiveDaysFromNow = new Date();
    fiveDaysFromNow.setDate(fiveDaysFromNow.getDate() + 5);

    const urgentDoc = createMockDocument({
      title: 'Proposed Rule',
      type: 'PRORULE',
      comments_close_on: fiveDaysFromNow.toISOString().split('T')[0]
    });

    const score = scoreDocument(urgentDoc, testProfile);

    expect(score.urgencyScore).toBe(100);
    expect(score.reason).toContain('Comment period closes in');
  });

  it('should handle documents with no matches', () => {
    const noMatchProfile: UserRelevanceProfile = {
      policyInterests: ['defense'],
      followedAgencyIds: [999],
      followedAgencySlugs: ['defense-department']
    };

    const doc = createMockDocument({
      title: 'Environmental Standards Update'
    });

    const score = scoreDocument(doc, noMatchProfile);

    expect(score.keywordScore).toBe(0);
    expect(score.agencyScore).toBe(0);
    expect(score.matchedKeywords).toHaveLength(0);
    expect(score.matchedAgencies).toHaveLength(0);
  });

  it('should cap keyword score at 100', () => {
    const doc = createMockDocument({
      title: 'Climate Climate Climate',
      abstract: 'Climate change, emissions, greenhouse gas, carbon, global warming, clean air, environmental protection'
    });

    const score = scoreDocument(doc, testProfile);

    expect(score.keywordScore).toBeLessThanOrEqual(100);
  });

  it('should score presidential documents higher', () => {
    const ruleDoc = createMockDocument({
      type: 'RULE',
      title: 'Climate Rule'
    });

    const presDoc = createMockDocument({
      type: 'PRESDOCU',
      title: 'Climate Executive Order'
    });

    const ruleScore = scoreDocument(ruleDoc, testProfile);
    const presScore = scoreDocument(presDoc, testProfile);

    expect(presScore.typeScore).toBeGreaterThan(ruleScore.typeScore);
  });
});

describe('scoreAndRankDocuments', () => {
  it('should rank documents by relevance score', () => {
    const docs = [
      createMockDocument({
        document_number: '2025-00001',
        title: 'Administrative Update',
        agencies: [{ raw_name: 'Commerce', name: 'Commerce', id: 1, url: '', json_url: '', slug: 'commerce-department' }],
        agency_names: ['Commerce']
      }),
      createMockDocument({
        document_number: '2025-00002',
        title: 'Climate Change Emergency Action',
        abstract: 'Major emissions reduction'
      }),
      createMockDocument({
        document_number: '2025-00003',
        title: 'EPA Clean Air Standards',
        abstract: 'Environmental protection measures'
      })
    ];

    const ranked = scoreAndRankDocuments(docs, testProfile);

    // Documents with climate/EPA should rank higher
    expect(ranked.length).toBeGreaterThanOrEqual(2);
    expect(ranked[0]!.document.document_number).not.toBe('2025-00001');
    expect(ranked[0]!.score.total).toBeGreaterThan(ranked[1]!.score.total);
  });

  it('should filter by minimum score', () => {
    const docs = [
      createMockDocument({
        title: 'Unrelated Commerce Update',
        agencies: [{ raw_name: 'Commerce', name: 'Commerce', id: 1, url: '', json_url: '', slug: 'commerce-department' }],
        agency_names: ['Commerce']
      }),
      createMockDocument({
        title: 'Climate Change Rule'
      })
    ];

    const ranked = scoreAndRankDocuments(docs, testProfile, { minScore: 30 });

    // Only climate doc should pass the filter
    expect(ranked.length).toBeGreaterThanOrEqual(1);
    expect(ranked.every(r => r.score.total >= 30)).toBe(true);
  });

  it('should respect limit parameter', () => {
    const docs = Array.from({ length: 10 }, (_, i) =>
      createMockDocument({
        document_number: `2025-${String(i).padStart(5, '0')}`,
        title: `Climate Document ${i}`
      })
    );

    const ranked = scoreAndRankDocuments(docs, testProfile, { limit: 5 });

    expect(ranked.length).toBe(5);
  });
});

describe('extractTopKeywords', () => {
  it('should extract keywords from documents', () => {
    const docs = [
      createMockDocument({ title: 'Climate Change Mitigation', abstract: 'Reduce emissions' }),
      createMockDocument({ title: 'Environmental Protection', abstract: 'Clean air standards' }),
      createMockDocument({ title: 'Climate Policy Update', abstract: 'Carbon reduction' }),
      createMockDocument({ title: 'Healthcare Reform', abstract: 'Medicare expansion' })
    ];

    const keywords = extractTopKeywords(docs);

    expect(keywords.length).toBeGreaterThan(0);
    // Climate should appear twice, so it should be first or near the top
    const climateKeyword = keywords.find(k => k.keyword === 'climate');
    expect(climateKeyword).toBeDefined();
    if (climateKeyword) {
      expect(climateKeyword.count).toBeGreaterThanOrEqual(2);
    }
  });

  it('should respect limit parameter', () => {
    const docs = [
      createMockDocument({ title: 'Climate Healthcare Defense Trade Education' })
    ];

    const keywords = extractTopKeywords(docs, 3);

    expect(keywords.length).toBeLessThanOrEqual(3);
  });
});

describe('calculateQuickRelevance', () => {
  it('should return 0 for empty interests', () => {
    const doc = createMockDocument({ title: 'Climate Change' });
    const relevance = calculateQuickRelevance(doc, []);
    expect(relevance).toBe(0);
  });

  it('should return high score for matching document', () => {
    const doc = createMockDocument({
      title: 'Climate Change Action',
      abstract: 'Environmental emissions reduction'
    });

    const relevance = calculateQuickRelevance(doc, ['climate', 'environment']);

    expect(relevance).toBeGreaterThan(0.5);
  });

  it('should return 0 for non-matching document', () => {
    const doc = createMockDocument({
      title: 'Defense Budget Allocation',
      abstract: 'Military spending report'
    });

    const relevance = calculateQuickRelevance(doc, ['healthcare', 'education']);

    expect(relevance).toBe(0);
  });
});

describe('getSuggestedAgencies', () => {
  it('should return agencies for climate interest', () => {
    const agencies = getSuggestedAgencies(['climate']);

    expect(agencies).toContain('environmental-protection-agency');
    expect(agencies).toContain('energy-department');
  });

  it('should return agencies for healthcare interest', () => {
    const agencies = getSuggestedAgencies(['healthcare']);

    expect(agencies).toContain('health-and-human-services-department');
    expect(agencies).toContain('food-and-drug-administration');
  });

  it('should combine agencies for multiple interests', () => {
    const agencies = getSuggestedAgencies(['climate', 'healthcare']);

    expect(agencies).toContain('environmental-protection-agency');
    expect(agencies).toContain('health-and-human-services-department');
  });

  it('should deduplicate agencies', () => {
    const agencies = getSuggestedAgencies(['climate', 'environment', 'energy']);

    // EPA appears in both climate and environment
    const epaCount = agencies.filter(a => a === 'environmental-protection-agency').length;
    expect(epaCount).toBe(1);
  });

  it('should return empty for unknown interest', () => {
    const agencies = getSuggestedAgencies(['unknown-topic-xyz']);
    expect(agencies).toHaveLength(0);
  });
});

describe('POLICY_KEYWORD_MAPPINGS', () => {
  it('should have mappings for common interests', () => {
    expect(POLICY_KEYWORD_MAPPINGS).toHaveProperty('climate');
    expect(POLICY_KEYWORD_MAPPINGS).toHaveProperty('healthcare');
    expect(POLICY_KEYWORD_MAPPINGS).toHaveProperty('economy');
    expect(POLICY_KEYWORD_MAPPINGS).toHaveProperty('immigration');
    expect(POLICY_KEYWORD_MAPPINGS).toHaveProperty('education');
  });

  it('should have multiple keywords per interest', () => {
    for (const [_interest, keywords] of Object.entries(POLICY_KEYWORD_MAPPINGS)) {
      expect(keywords.length).toBeGreaterThan(1);
    }
  });
});
