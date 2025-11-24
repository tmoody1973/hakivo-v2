/**
 * Test Cerebras API directly
 */

import Cerebras from '@cerebras/cerebras_cloud_sdk';

async function testCerebrasAPI() {
  console.log('🧪 Testing Cerebras API\n');
  console.log('='.repeat(60));

  // Get API key from environment
  const apiKey = process.env.CEREBRAS_API_KEY;

  if (!apiKey) {
    console.error('❌ CEREBRAS_API_KEY not found in environment');
    console.log('\nAvailable env keys:', Object.keys(process.env).filter(k => k.includes('API')));
    return;
  }

  console.log(`✓ API Key found: ${apiKey.substring(0, 10)}...`);

  try {
    const cerebras = new Cerebras({
      apiKey: apiKey
    });

    console.log('\n📡 Making test API call...');
    const response = await cerebras.chat.completions.create({
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant.'
        },
        {
          role: 'user',
          content: 'Say "Hello, Cerebras!" and nothing else.'
        }
      ],
      model: 'gpt-oss-120b',
      stream: false,
      max_completion_tokens: 100,
      temperature: 0.3
    });

    const choice = (response.choices as any[])[0];
    const content = choice?.message?.content || '';
    const usage = response.usage as { total_tokens?: number } | undefined;

    console.log('\n✅ API call successful!');
    console.log('Response:', content);
    console.log('Tokens used:', usage?.total_tokens || 0);

  } catch (error) {
    console.error('\n❌ API call failed:', error);
    if (error instanceof Error) {
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);
    }
  }
}

testCerebrasAPI().catch(console.error);
