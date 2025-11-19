/**
 * Direct test of Exa.ai API
 * Tests the Exa API directly to verify it's working
 *
 * Usage: npx tsx scripts/test-exa-direct.ts
 */

import Exa from 'exa-js';
import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load environment variables from root .env.local
const envPath = resolve(__dirname, '../../.env.local');
console.log(`Loading .env from: ${envPath}`);
const result = dotenv.config({ path: envPath });
if (result.error) {
  console.error('Failed to load .env:', result.error);
}

async function testExaDirect() {
  console.log('🔍 Testing Exa.ai API directly...\n');

  const apiKey = process.env.EXA_API_KEY;

  if (!apiKey) {
    console.error('❌ EXA_API_KEY not found in environment');
    process.exit(1);
  }

  console.log('✓ API key found');
  console.log(`  Key length: ${apiKey.length}`);
  console.log(`  Key (first 20 chars): ${apiKey.substring(0, 20)}...`);
  console.log(`  Key (last 10 chars): ...${apiKey.substring(apiKey.length - 10)}`);
  console.log(`  Full key: ${apiKey}\n`);

  const exa = new Exa(apiKey);

  // Test 1: Simple news search
  console.log('📰 Test 1: Searching for congressional news...');

  const endDate = new Date();
  const startDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // Last 24 hours

  try {
    const response = await exa.searchAndContents(
      'environment climate legislation Congress',
      {
        numResults: 3,
        startPublishedDate: startDate.toISOString(),
        endPublishedDate: endDate.toISOString(),
        type: 'neural',
        text: {
          maxCharacters: 300
        },
        highlights: {
          highlightsPerUrl: 1,
          numSentences: 2
        },
        category: 'news'
      }
    );

    console.log(`✓ Found ${response.results.length} articles\n`);

    response.results.forEach((article, idx) => {
      console.log(`Article ${idx + 1}:`);
      console.log(`  Title: ${article.title}`);
      console.log(`  URL: ${article.url}`);
      console.log(`  Published: ${article.publishedDate || 'Unknown'}`);
      console.log(`  Author: ${article.author || 'Unknown'}`);
      console.log(`  Score: ${article.score}`);
      console.log(`  Summary: ${article.text?.substring(0, 150) || 'No summary'}...`);
      console.log();
    });

    console.log('✅ Exa.ai API is working correctly!');

  } catch (error) {
    console.error('❌ Exa API error:', error);
    if (error instanceof Error) {
      console.error('   Error message:', error.message);
      console.error('   Error stack:', error.stack);
    }
    process.exit(1);
  }
}

// Run test
testExaDirect()
  .then(() => {
    console.log('\n✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Test failed:', error);
    process.exit(1);
  });
