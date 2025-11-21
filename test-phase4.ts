/**
 * Phase 4 Testing Script
 * Tests TypeScript types, component interfaces, and data structure compatibility
 */

// Test 1: NewsArticle interface compatibility
interface NewsEnrichment {
  plainLanguageSummary: string
  keyPoints: string[]
  readingTimeMinutes: number
  impactLevel: string
  tags: string[]
  enrichedAt: string
  modelUsed: string
}

interface NewsArticle {
  id: string
  interest: string
  title: string
  url: string
  author: string | null
  summary: string
  imageUrl: string | null
  publishedDate: string
  fetchedAt: number
  score: number
  sourceDomain: string
  enrichment: NewsEnrichment | null
}

// Test 2: Bill interface compatibility
interface BillEnrichment {
  plainLanguageSummary: string
  keyPoints: string[]
  readingTimeMinutes: number
  impactLevel: string
  bipartisanScore: number
  currentStage: string
  progressPercentage: number
  tags: string[]
  enrichedAt: string
  modelUsed: string
}

interface BillSponsor {
  firstName: string
  lastName: string
  party: string
  state: string
}

interface Bill {
  id: string
  congress: number
  billType: string
  billNumber: number
  title: string
  policyArea: string | null
  introducedDate: string | null
  latestActionDate: string | null
  latestActionText: string | null
  originChamber: string | null
  updateDate: string | null
  sponsor: BillSponsor | null
  enrichment: BillEnrichment | null
}

// Test 3: Mock data for NewsArticle
const mockNewsArticle: NewsArticle = {
  id: 'test-news-1',
  interest: 'Environment & Energy',
  title: 'Test News Article',
  url: 'https://example.com/article',
  author: 'Test Author',
  summary: 'This is a test summary',
  imageUrl: 'https://example.com/image.jpg',
  publishedDate: new Date().toISOString(),
  fetchedAt: Date.now(),
  score: 0.95,
  sourceDomain: 'example.com',
  enrichment: {
    plainLanguageSummary: 'This is a plain language summary',
    keyPoints: ['Point 1', 'Point 2', 'Point 3'],
    readingTimeMinutes: 5,
    impactLevel: 'high',
    tags: ['climate', 'energy', 'policy'],
    enrichedAt: new Date().toISOString(),
    modelUsed: 'claude-sonnet-4-5'
  }
}

// Test 4: Mock data for Bill
const mockBill: Bill = {
  id: 'hr-1234-119',
  congress: 119,
  billType: 'hr',
  billNumber: 1234,
  title: 'Test Bill for Climate Action',
  policyArea: 'Environmental Protection',
  introducedDate: '2025-01-15',
  latestActionDate: '2025-01-20',
  latestActionText: 'Referred to Committee on Energy and Commerce',
  originChamber: 'House',
  updateDate: '2025-01-20',
  sponsor: {
    firstName: 'John',
    lastName: 'Doe',
    party: 'D',
    state: 'CA'
  },
  enrichment: {
    plainLanguageSummary: 'This bill aims to reduce carbon emissions',
    keyPoints: [
      'Establishes emissions targets',
      'Creates green energy incentives',
      'Funds climate research'
    ],
    readingTimeMinutes: 8,
    impactLevel: 'high',
    bipartisanScore: 65,
    currentStage: 'in-committee',
    progressPercentage: 20,
    tags: ['climate', 'energy', 'environment'],
    enrichedAt: new Date().toISOString(),
    modelUsed: 'claude-sonnet-4-5'
  }
}

// Test 5: Null safety tests
const mockBillWithNulls: Bill = {
  id: 'hr-5678-119',
  congress: 119,
  billType: 'hr',
  billNumber: 5678,
  title: 'Test Bill Without Enrichment',
  policyArea: null,
  introducedDate: null,
  latestActionDate: null,
  latestActionText: null,
  originChamber: null,
  updateDate: null,
  sponsor: null,
  enrichment: null
}

const mockNewsWithNulls: NewsArticle = {
  id: 'test-news-2',
  interest: 'Health & Social Welfare',
  title: 'Test News Without Enrichment',
  url: 'https://example.com/article2',
  author: null,
  summary: 'Test summary without enrichment',
  imageUrl: null,
  publishedDate: new Date().toISOString(),
  fetchedAt: Date.now(),
  score: 0.85,
  sourceDomain: 'example.com',
  enrichment: null
}

// Test 6: Type validation functions
function validateNewsArticle(article: NewsArticle): boolean {
  // Required fields
  if (!article.id || typeof article.id !== 'string') return false
  if (!article.interest || typeof article.interest !== 'string') return false
  if (!article.title || typeof article.title !== 'string') return false
  if (!article.url || typeof article.url !== 'string') return false
  if (!article.summary || typeof article.summary !== 'string') return false
  if (!article.publishedDate || typeof article.publishedDate !== 'string') return false
  if (typeof article.fetchedAt !== 'number') return false
  if (typeof article.score !== 'number') return false
  if (!article.sourceDomain || typeof article.sourceDomain !== 'string') return false

  // Nullable fields
  if (article.author !== null && typeof article.author !== 'string') return false
  if (article.imageUrl !== null && typeof article.imageUrl !== 'string') return false

  // Enrichment validation
  if (article.enrichment !== null) {
    if (!article.enrichment.plainLanguageSummary) return false
    if (!Array.isArray(article.enrichment.keyPoints)) return false
    if (typeof article.enrichment.readingTimeMinutes !== 'number') return false
    if (!article.enrichment.impactLevel) return false
    if (!Array.isArray(article.enrichment.tags)) return false
  }

  return true
}

function validateBill(bill: Bill): boolean {
  // Required fields
  if (!bill.id || typeof bill.id !== 'string') return false
  if (typeof bill.congress !== 'number') return false
  if (!bill.billType || typeof bill.billType !== 'string') return false
  if (typeof bill.billNumber !== 'number') return false
  if (!bill.title || typeof bill.title !== 'string') return false

  // Nullable fields - just check types if not null
  if (bill.policyArea !== null && typeof bill.policyArea !== 'string') return false
  if (bill.introducedDate !== null && typeof bill.introducedDate !== 'string') return false
  if (bill.latestActionDate !== null && typeof bill.latestActionDate !== 'string') return false
  if (bill.latestActionText !== null && typeof bill.latestActionText !== 'string') return false

  // Sponsor validation
  if (bill.sponsor !== null) {
    if (!bill.sponsor.firstName || !bill.sponsor.lastName) return false
    if (!bill.sponsor.party || !bill.sponsor.state) return false
  }

  // Enrichment validation
  if (bill.enrichment !== null) {
    if (!bill.enrichment.plainLanguageSummary) return false
    if (!Array.isArray(bill.enrichment.keyPoints)) return false
    if (typeof bill.enrichment.readingTimeMinutes !== 'number') return false
    if (typeof bill.enrichment.bipartisanScore !== 'number') return false
    if (typeof bill.enrichment.progressPercentage !== 'number') return false
    if (!Array.isArray(bill.enrichment.tags)) return false
  }

  return true
}

// Run tests
console.log('=== Phase 4 Type Safety Tests ===\n')

console.log('Test 1: NewsArticle with enrichment')
console.log('Valid:', validateNewsArticle(mockNewsArticle) ? '✅ PASS' : '❌ FAIL')

console.log('\nTest 2: NewsArticle without enrichment (null fields)')
console.log('Valid:', validateNewsArticle(mockNewsWithNulls) ? '✅ PASS' : '❌ FAIL')

console.log('\nTest 3: Bill with enrichment')
console.log('Valid:', validateBill(mockBill) ? '✅ PASS' : '❌ FAIL')

console.log('\nTest 4: Bill without enrichment (null fields)')
console.log('Valid:', validateBill(mockBillWithNulls) ? '✅ PASS' : '❌ FAIL')

console.log('\n=== Data Structure Examples ===\n')

console.log('News Article with Enrichment:')
console.log(JSON.stringify(mockNewsArticle, null, 2))

console.log('\n\nBill with Enrichment:')
console.log(JSON.stringify(mockBill, null, 2))

console.log('\n\n=== Component Integration Tests ===\n')

// Test 5: Date formatting safety
function testDateFormatting(dateString: string | null): string {
  if (!dateString) return 'N/A'
  try {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    })
  } catch {
    return 'Invalid Date'
  }
}

console.log('Date Formatting Test:')
console.log('  Valid date:', testDateFormatting('2025-01-15'))
console.log('  Null date:', testDateFormatting(null))
console.log('  Invalid date:', testDateFormatting('invalid'))

console.log('\n✅ All Phase 4 type safety tests completed!')
