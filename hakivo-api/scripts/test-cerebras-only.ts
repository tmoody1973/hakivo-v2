#!/usr/bin/env tsx

/**
 * Test Cerebras Only
 */

import Cerebras from '@cerebras/cerebras_cloud_sdk';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testCerebras() {
  console.log('🧪 Testing Cerebras\n');

  const cerebrasKey = process.env.CEREBRAS_API_KEY;
  if (!cerebrasKey) {
    console.error('❌ CEREBRAS_API_KEY not found');
    process.exit(1);
  }

  console.log(`✓ API key loaded: ${cerebrasKey.substring(0, 10)}...\n`);

  const cerebras = new Cerebras({ apiKey: cerebrasKey });

  const prompt = `Summarize this news article in 2-3 sentences.

Article: Congress passed a $1 trillion infrastructure bill to fund roads, bridges, and broadband.

Summary:`;

  console.log('Sending request to Cerebras...\n');

  try {
    const completion = await cerebras.chat.completions.create({
      messages: [{ role: 'user', content: prompt }],
      model: 'gpt-oss-120b',
      max_completion_tokens: 150,
      temperature: 0.3
    });

    const summary = (completion.choices as any)?.[0]?.message?.content || '';

    console.log('✅ Cerebras responded successfully\n');
    console.log('Response:');
    console.log('─'.repeat(60));
    console.log(summary);
    console.log('─'.repeat(60));
    console.log('\n✅ Cerebras test passed!\n');

  } catch (error: any) {
    console.error('❌ Cerebras test failed:', error.message);
    console.error('\nError details:', error);

    if (error.message.includes('401')) {
      console.error('\n⚠️  API Key Issue:');
      console.error('   - Key appears invalid or not activated');
      console.error('   - Please verify at: https://cloud.cerebras.ai/');
      console.error('   - Check if billing is set up');
      console.error('   - Try regenerating the API key\n');
    }

    process.exit(1);
  }
}

testCerebras();
