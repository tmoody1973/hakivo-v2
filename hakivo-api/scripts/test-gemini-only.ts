#!/usr/bin/env tsx

/**
 * Test Gemini 3 Pro Only
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function testGemini() {
  console.log('🧪 Testing Gemini 3 Pro\n');

  const geminiKey = process.env.GEMINI_API_KEY;
  if (!geminiKey) {
    console.error('❌ GEMINI_API_KEY not found');
    process.exit(1);
  }

  console.log('✓ API key loaded\n');

  const gemini = new GoogleGenerativeAI(geminiKey);
  const model = gemini.getGenerativeModel({
    model: 'gemini-2.0-flash-thinking-exp'
  });

  const prompt = `Provide a brief executive summary (2 sentences) analyzing this bill:

Bill: Infrastructure Investment and Jobs Act
Title: A bill to invest in American infrastructure
Latest Action: Passed Senate 69-30

Executive Summary (BLUF format):`;

  console.log('Sending request to Gemini 3 Pro...\n');

  try {
    const result = await model.generateContent({
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 200
      }
    });

    const response = result.response;
    const text = response.text();

    console.log('✅ Gemini 3 Pro responded successfully\n');
    console.log('Response:');
    console.log('─'.repeat(60));
    console.log(text);
    console.log('─'.repeat(60));
    console.log('\n✅ Gemini test passed!\n');

  } catch (error: any) {
    console.error('❌ Gemini test failed:', error.message);
    process.exit(1);
  }
}

testGemini();
