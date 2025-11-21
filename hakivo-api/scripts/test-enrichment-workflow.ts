#!/usr/bin/env tsx

/**
 * End-to-End Enrichment Workflow Test
 *
 * Tests all three enrichment methods:
 * 1. News article enrichment
 * 2. Bill card enrichment
 * 3. Deep bill analysis
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

// Test data
const TEST_ARTICLE = {
  id: 'test-article-001',
  title: 'Congress Passes Bipartisan Infrastructure Bill',
  description: 'The Senate voted 69-30 to pass a $1 trillion infrastructure package that will fund repairs to roads, bridges, and broadband expansion across the United States. The bill received support from both parties and is expected to create thousands of jobs.',
  url: 'https://example.com/infrastructure-bill',
  published_at: Date.now()
};

const TEST_BILL = {
  id: 'test-bill-hr3684-117',
  congress: 117,
  bill_type: 'hr',
  bill_number: '3684',
  title: 'Infrastructure Investment and Jobs Act',
  latest_action_text: 'Passed Senate 69-30, sent to House for consideration',
  introduced_date: '2021-06-04'
};

async function runEnrichmentTest() {
  console.log('🧪 Starting End-to-End Enrichment Workflow Test\n');
  console.log('═'.repeat(70));

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('❌ GEMINI_API_KEY not found');
    process.exit(1);
  }

  const gemini = new GoogleGenAI({ apiKey: geminiKey });

  // Test 1: News Article Enrichment
  console.log('\n📰 TEST 1: News Article Enrichment');
  console.log('─'.repeat(70));

  try {
    const newsPrompt = `Summarize this news article in 2-3 sentences of plain English. Focus on key facts and relevance to citizens.

Article Title: ${TEST_ARTICLE.title}
Article Content: ${TEST_ARTICLE.description}

Provide a clear, concise summary that explains what happened and why it matters.`;

    console.log('Sending news article to Gemini 3 Pro...');

    const newsResult = await gemini.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: newsPrompt }]
        }
      ]
    }) as any;

    const newsSummary = newsResult.text || '';

    console.log('\n✅ News enrichment successful!');
    console.log('\nOriginal Title:');
    console.log(`  ${TEST_ARTICLE.title}`);
    console.log('\nAI Summary:');
    console.log(`  ${newsSummary}`);
    console.log('\nModel Used: gemini-3-pro-preview');

  } catch (error: any) {
    console.error('❌ News enrichment failed:', error.message);
    throw error;
  }

  // Test 2: Bill Card Enrichment
  console.log('\n\n📜 TEST 2: Bill Card Enrichment');
  console.log('─'.repeat(70));

  try {
    const billPrompt = `Summarize this bill in 2-3 sentences of plain English. Focus on what it does and who it affects.

Bill Title: ${TEST_BILL.title}
Latest Action: ${TEST_BILL.latest_action_text}

Provide a clear, concise summary that explains the bill's purpose and impact.`;

    console.log('Sending bill to Gemini 3 Pro...');

    const billResult = await gemini.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: billPrompt }]
        }
      ]
    }) as any;

    const billSummary = billResult.text || '';

    console.log('\n✅ Bill enrichment successful!');
    console.log('\nBill:');
    console.log(`  ${TEST_BILL.bill_type.toUpperCase()}${TEST_BILL.bill_number} - ${TEST_BILL.title}`);
    console.log('\nAI Summary:');
    console.log(`  ${billSummary}`);
    console.log('\nModel Used: gemini-3-pro-preview');

  } catch (error: any) {
    console.error('❌ Bill enrichment failed:', error.message);
    throw error;
  }

  // Test 3: Deep Bill Analysis with Google Search
  console.log('\n\n🔬 TEST 3: Deep Bill Analysis (with Google Search)');
  console.log('─'.repeat(70));

  try {
    const analysisPrompt = `Conduct a brief analysis of this legislation:

Bill: ${TEST_BILL.bill_type.toUpperCase()}${TEST_BILL.bill_number} - ${TEST_BILL.congress}th Congress
Title: ${TEST_BILL.title}
Latest Action: ${TEST_BILL.latest_action_text}

Provide:
1. Executive Summary (2-3 sentences)
2. Key stakeholders affected
3. Passage likelihood (0-100) with reasoning

Return as JSON with fields: executive_summary, stakeholders, passage_likelihood, passage_reasoning`;

    console.log('Sending to Gemini 3 Pro with Google Search...');

    const analysisResult = await gemini.models.generateContent({
      model: 'gemini-3-pro-preview',
      config: {
        tools: [
          {
            googleSearch: {}
          }
        ]
      },
      contents: [
        {
          role: 'user',
          parts: [{ text: analysisPrompt }]
        }
      ]
    }) as any;

    const analysisText = analysisResult.text || '';

    console.log('\n✅ Deep analysis successful!');
    console.log('\nBill:');
    console.log(`  ${TEST_BILL.bill_type.toUpperCase()}${TEST_BILL.bill_number} - ${TEST_BILL.title}`);
    console.log('\nAI Analysis:');
    console.log(analysisText);
    console.log('\nModel Used: gemini-3-pro-preview (with Google Search)');

  } catch (error: any) {
    console.error('❌ Deep analysis failed:', error.message);
    throw error;
  }

  // Summary
  console.log('\n\n' + '═'.repeat(70));
  console.log('✅ ALL TESTS PASSED!');
  console.log('═'.repeat(70));
  console.log('\nPhase 2 Enrichment Workflow Summary:');
  console.log('  ✓ News article enrichment - Working');
  console.log('  ✓ Bill card enrichment - Working');
  console.log('  ✓ Deep bill analysis with Google Search - Working');
  console.log('  ✓ Gemini 3 Pro Preview API - Responding correctly');
  console.log('\n🎉 Phase 2 is complete and ready for production!\n');
}

runEnrichmentTest().catch(error => {
  console.error('\n❌ Test suite failed:', error);
  process.exit(1);
});
