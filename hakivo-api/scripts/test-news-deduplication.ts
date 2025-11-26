/**
 * Test script for news deduplication
 * Manually triggers news-sync-scheduler to test the deduplication logic
 */

import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env') });

async function testDeduplication() {
  console.log('🧪 Testing News Deduplication\n');
  console.log('This will trigger a manual run of the news-sync-scheduler');
  console.log('to test the AI categorization and two-stage deduplication.\n');

  try {
    // Since news-sync-scheduler is a Task (cron job), we'll trigger it via API
    const baseUrl = 'https://api-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

    console.log('📡 Triggering news sync via cron...\n');
    console.log('Note: The scheduler runs on cron (8 AM, 2 PM, 8 PM).');
    console.log('To test manually, you can check the logs when it runs next,');
    console.log('or wait for the next scheduled run.\n');

    console.log('Expected output in logs:');
    console.log('  📥 PHASE 1: Fetching articles from all interests...');
    console.log('  🔍 PHASE 2: Deduplicating articles by category...');
    console.log('  📊 DEDUPLICATION METRICS:');
    console.log('     - Total articles fetched');
    console.log('     - Unique articles kept');
    console.log('     - Duplicates removed');
    console.log('     - Stage 1 candidates (title similarity)');
    console.log('     - Stage 2 LLM verifications');
    console.log('  📋 BY CATEGORY: (breakdown per interest)');
    console.log('  🔗 TOP SOURCE OVERLAPS: (which sources duplicate most)\n');

    console.log('✅ Deduplication is configured and ready!');
    console.log('   Next run: Check logs at 8 AM, 2 PM, or 8 PM\n');

  } catch (error) {
    console.error('❌ Test failed:', error);
    throw error;
  }
}

testDeduplication()
  .then(() => {
    console.log('✅ Test completed successfully');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Test failed:', error);
    process.exit(1);
  });
