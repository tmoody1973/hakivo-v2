#!/usr/bin/env tsx

/**
 * Test Gemini 3 Pro Preview
 */

import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testGemini3Pro() {
  console.log('🧪 Testing Gemini 3 Pro Preview\n');

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('❌ GEMINI_API_KEY not found');
    process.exit(1);
  }

  console.log('✓ API key loaded\n');

  const gemini = new GoogleGenAI({
    apiKey: geminiKey
  });

  const prompt = `Summarize this bill in 2-3 sentences of plain English:

Bill: Infrastructure Investment and Jobs Act
Latest Action: Passed Senate 69-30

Summary:`;

  console.log('Sending request to Gemini 3 Pro Preview...\n');

  try {
    const result = await gemini.models.generateContent({
      model: 'gemini-3-pro-preview',
      contents: [
        {
          role: 'user',
          parts: [{ text: prompt }]
        }
      ]
    }) as any;

    const summary = result.text || '';

    console.log('✅ Gemini 3 Pro Preview responded successfully\n');
    console.log('Response:');
    console.log('─'.repeat(60));
    console.log(summary);
    console.log('─'.repeat(60));
    console.log('\n✅ Gemini 3 Pro test passed!\n');

  } catch (error: any) {
    console.error('❌ Gemini test failed:', error.message);
    console.error('\nError details:', error);
    process.exit(1);
  }
}

testGemini3Pro();
