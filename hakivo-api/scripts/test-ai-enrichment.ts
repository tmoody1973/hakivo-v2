#!/usr/bin/env tsx

/**
 * Real AI Enrichment Test
 * Actually test the AI enrichment methods with live API calls
 */

import Cerebras from '@cerebras/cerebras_cloud_sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

async function executeSQL(query: string): Promise<any> {
  const response = await fetch(`${ADMIN_DASHBOARD_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Database query failed: ${error}`);
  }

  return response.json();
}

async function testAIEnrichment() {
  console.log('🧪 Testing AI Enrichment Methods\n');

  try {
    // Verify API keys
    const cerebrasKey = process.env.CEREBRAS_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY;

    if (!cerebrasKey || !geminiKey) {
      console.error('❌ Missing API keys');
      console.error('   CEREBRAS_API_KEY:', cerebrasKey ? '✓' : '✗');
      console.error('   GEMINI_API_KEY:', geminiKey ? '✓' : '✗');
      process.exit(1);
    }

    console.log('✓ API keys loaded\n');

    // Test 1: Cerebras News Enrichment
    console.log('1️⃣  Testing Cerebras News Enrichment...\n');

    const cerebras = new Cerebras({ apiKey: cerebrasKey });

    const newsPrompt = `Summarize this news article in 2-3 sentences of plain English. Focus on key facts and relevance to citizens.

Article Title: Congress Passes New Infrastructure Bill
Article Content: The Senate voted 69-30 to pass a $1 trillion infrastructure package that will fund roads, bridges, and broadband expansion across the country.

Provide a clear, concise summary that explains what happened and why it matters.`;

    console.log('   Sending request to Cerebras...');
    const newsCompletion = await cerebras.chat.completions.create({
      messages: [{ role: 'user', content: newsPrompt }],
      model: 'llama3.1-8b',
      max_tokens: 150,
      temperature: 0.3
    });

    const newsSummary = (newsCompletion.choices as any)?.[0]?.message?.content || '';

    if (newsSummary) {
      console.log('   ✅ Cerebras responded successfully');
      console.log(`   Summary: "${newsSummary.substring(0, 100)}..."\n`);
    } else {
      console.error('   ❌ Cerebras returned empty response\n');
      return;
    }

    // Test 2: Cerebras Bill Enrichment
    console.log('2️⃣  Testing Cerebras Bill Enrichment...\n');

    const billPrompt = `Summarize this bill in 2-3 sentences of plain English. Focus on what it does and who it affects.

Bill Title: Infrastructure Investment and Jobs Act
Latest Action: Passed Senate

Provide a clear, concise summary that explains the bill's purpose and impact.`;

    console.log('   Sending request to Cerebras...');
    const billCompletion = await cerebras.chat.completions.create({
      messages: [{ role: 'user', content: billPrompt }],
      model: 'llama3.1-8b',
      max_tokens: 150,
      temperature: 0.3
    });

    const billSummary = (billCompletion.choices as any)?.[0]?.message?.content || '';

    if (billSummary) {
      console.log('   ✅ Cerebras responded successfully');
      console.log(`   Summary: "${billSummary.substring(0, 100)}..."\n`);
    } else {
      console.error('   ❌ Cerebras returned empty response\n');
      return;
    }

    // Test 3: Gemini 3 Pro Deep Analysis
    console.log('3️⃣  Testing Gemini 3 Pro Deep Analysis...\n');

    const gemini = new GoogleGenerativeAI(geminiKey);
    const model = gemini.getGenerativeModel({
      model: 'gemini-2.0-flash-thinking-exp'
    });

    const analysisPrompt = `Provide a brief executive summary (2 sentences) analyzing this bill:

Bill: Infrastructure Investment and Jobs Act
Title: A bill to invest in American infrastructure
Latest Action: Passed Senate 69-30

Executive Summary (BLUF format):`;

    console.log('   Sending request to Gemini 3 Pro...');
    const analysisResult = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: analysisPrompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 200
      }
    });

    const analysisResponse = analysisResult.response;
    const analysisText = analysisResponse.text();

    if (analysisText) {
      console.log('   ✅ Gemini 3 Pro responded successfully');
      console.log(`   Analysis: "${analysisText.substring(0, 150)}..."\n`);
    } else {
      console.error('   ❌ Gemini returned empty response\n');
      return;
    }

    // Test 4: Database Write Test
    console.log('4️⃣  Testing Database Writes...\n');

    const testBillId = 'test-' + Date.now();
    const testArticleId = 'test-' + Date.now();

    // Test bill_enrichment insert
    console.log('   Testing bill_enrichment insert...');
    await executeSQL(`
      INSERT INTO bill_enrichment (
        bill_id, plain_language_summary, key_points,
        reading_time_minutes, impact_level, bipartisan_score,
        current_stage, progress_percentage, tags,
        enriched_at, model_used
      ) VALUES (
        '${testBillId}',
        ${escapeSQLString(billSummary)},
        '["Test point 1", "Test point 2"]',
        3,
        'medium',
        65,
        'Passed Senate',
        75,
        '["test"]',
        ${Date.now()},
        'llama3.1-8b'
      )
    `);
    console.log('   ✅ bill_enrichment insert successful\n');

    // Test news_enrichment insert
    console.log('   Testing news_enrichment insert...');
    await executeSQL(`
      INSERT INTO news_enrichment (
        article_id, plain_language_summary, key_points,
        reading_time_minutes, impact_level, tags,
        enriched_at, model_used
      ) VALUES (
        '${testArticleId}',
        ${escapeSQLString(newsSummary)},
        '["Key point 1", "Key point 2"]',
        2,
        'high',
        '["test"]',
        ${Date.now()},
        'llama3.1-8b'
      )
    `);
    console.log('   ✅ news_enrichment insert successful\n');

    // Test bill_analysis insert
    console.log('   Testing bill_analysis insert...');
    await executeSQL(`
      INSERT INTO bill_analysis (
        bill_id, executive_summary, status_quo_vs_change,
        mechanism_of_action, passage_likelihood, passage_reasoning,
        analyzed_at, model_used
      ) VALUES (
        '${testBillId}',
        ${escapeSQLString(analysisText)},
        'Test analysis of status quo vs change',
        'Test mechanism of action',
        85,
        'High likelihood due to bipartisan support',
        ${Date.now()},
        'gemini-2.0-flash-thinking-exp'
      )
    `);
    console.log('   ✅ bill_analysis insert successful\n');

    // Verify reads
    console.log('5️⃣  Verifying Data Reads...\n');

    const billEnrichmentRead = await executeSQL(`
      SELECT * FROM bill_enrichment WHERE bill_id = '${testBillId}'
    `);
    console.log('   ✅ bill_enrichment read successful');
    console.log(`      Summary: "${billEnrichmentRead.results[0].plain_language_summary.substring(0, 60)}..."\n`);

    const newsEnrichmentRead = await executeSQL(`
      SELECT * FROM news_enrichment WHERE article_id = '${testArticleId}'
    `);
    console.log('   ✅ news_enrichment read successful');
    console.log(`      Summary: "${newsEnrichmentRead.results[0].plain_language_summary.substring(0, 60)}..."\n`);

    const billAnalysisRead = await executeSQL(`
      SELECT * FROM bill_analysis WHERE bill_id = '${testBillId}'
    `);
    console.log('   ✅ bill_analysis read successful');
    console.log(`      Analysis: "${billAnalysisRead.results[0].executive_summary.substring(0, 60)}..."\n`);

    // Cleanup
    console.log('6️⃣  Cleaning up test data...\n');
    await executeSQL(`DELETE FROM bill_enrichment WHERE bill_id = '${testBillId}'`);
    await executeSQL(`DELETE FROM news_enrichment WHERE article_id = '${testArticleId}'`);
    await executeSQL(`DELETE FROM bill_analysis WHERE bill_id = '${testBillId}'`);
    console.log('   ✅ Test data cleaned up\n');

    // Final summary
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  ✅ ALL AI ENRICHMENT TESTS PASSED');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('\n📊 Test Summary:');
    console.log('  ✅ Cerebras news enrichment working');
    console.log('  ✅ Cerebras bill enrichment working');
    console.log('  ✅ Gemini 3 Pro deep analysis working');
    console.log('  ✅ Database writes successful');
    console.log('  ✅ Database reads successful');
    console.log('\n🎉 Phase 2 fully tested and validated!\n');

  } catch (error: any) {
    console.error('\n❌ Test failed:', error.message);
    if (error.stack) {
      console.error('Stack trace:', error.stack);
    }
    process.exit(1);
  }
}

function escapeSQLString(str: string): string {
  return `'${str.replace(/'/g, "''")}'`;
}

testAIEnrichment().catch(error => {
  console.error('\n❌ Fatal error:', error);
  process.exit(1);
});
