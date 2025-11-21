/**
 * Directly enrich a bill using Gemini API
 * Bypasses queue/observer to test AI analysis
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BILL_ID = '119-s-1092';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment');
  process.exit(1);
}

const POLICY_ANALYST_PROMPT = `You are a neutral policy analyst conducting forensic legislative analysis. Your role is to translate complex legislation into plain English while maintaining strict objectivity.

Core Principles:
- Strict neutrality: Present facts without bias
- Plain English: Avoid jargon, use accessible language
- Forensic depth: Analyze mechanisms, not just outcomes
- Steelman both sides: Present strongest arguments for and against
- Implementation focus: Identify practical challenges

Analysis Framework:
1. Executive Summary (BLUF - Bottom Line Up Front)
   - 2-3 sentences capturing core purpose and impact

2. Status Quo vs. Change
   - What exists now
   - What changes if this passes
   - Key differences

3. Mechanism of Action
   - How the bill actually works
   - What powers it grants/removes
   - Implementation pathway

4. Stakeholder Impact
   - Winners (who benefits and how)
   - Losers (who is disadvantaged)
   - Affected groups and magnitude

5. Arguments FOR (Steelmanned)
   - Strongest case for passage
   - Supporting evidence
   - Policy rationale

6. Arguments AGAINST (Steelmanned)
   - Strongest case against passage
   - Concerns and evidence
   - Alternative approaches

7. Implementation Challenges
   - Logistical hurdles
   - Resource requirements
   - Potential bottlenecks`;

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

async function enrichBillWithGemini() {
  console.log(`🤖 Enriching bill ${BILL_ID} with Gemini API...\n`);

  try {
    // 1. Get bill from database
    console.log('1️⃣  Fetching bill from database...');
    const billResult = await executeSQL(`
      SELECT id, congress, bill_type, bill_number, title,
             latest_action_text, text
      FROM bills
      WHERE id = '${BILL_ID}'
    `);

    if (!billResult.results || billResult.results.length === 0) {
      throw new Error('Bill not found');
    }

    const bill = billResult.results[0];
    console.log(`   ✓ Found: ${bill.title}`);
    console.log(`   Text length: ${bill.text?.length || 0} characters`);

    if (!bill.text || bill.text.length === 0) {
      throw new Error('Bill has no text for enrichment');
    }

    // 2. Mark as processing
    console.log('\n2️⃣  Creating enrichment record (status: processing)...');
    const now = new Date().toISOString();
    await executeSQL(`
      INSERT OR REPLACE INTO bill_enrichment (
        bill_id,
        plain_language_summary,
        status,
        started_at,
        enriched_at
      ) VALUES (
        '${BILL_ID}',
        'AI analysis in progress...',
        'processing',
        '${now}',
        '${now}'
      )
    `);
    console.log('   ✓ Status: processing');

    // 3. Call Gemini API
    console.log('\n3️⃣  Calling Gemini 3 Pro Preview API...');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

    const prompt = `${POLICY_ANALYST_PROMPT}

Analyze this legislation and provide a structured summary for bill cards:

Bill: ${bill.bill_type}${bill.bill_number} - ${bill.congress}th Congress
Title: ${bill.title}
Latest Action: ${bill.latest_action_text || 'None'}

Full Text:
${bill.text.substring(0, 30000)}

Return a JSON object with these fields:
{
  "what_it_does": "2-3 sentence plain language summary of the bill's purpose and impact",
  "who_it_affects": ["group1", "group2", "group3"],
  "key_provisions": ["provision 1", "provision 2", "provision 3"],
  "potential_benefits": ["benefit 1", "benefit 2"],
  "potential_concerns": ["concern 1", "concern 2"]
}

Focus on:
- Clear, accessible language
- Specific stakeholder groups affected
- Concrete provisions and mechanisms
- Balanced benefits and concerns`;

    console.log('   Sending request to Gemini...');
    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log(`   ✓ Received ${responseText.length} characters`);

    // 4. Parse response
    console.log('\n4️⃣  Parsing AI response...');
    let analysis: any;
    try {
      // Extract JSON from response (might have markdown code blocks)
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(responseText);
      }
      console.log('   ✓ Successfully parsed JSON');
    } catch (error) {
      console.warn('   ⚠️  Failed to parse JSON, using fallback');
      analysis = {
        what_it_does: responseText.substring(0, 300),
        who_it_affects: [],
        key_provisions: [],
        potential_benefits: [],
        potential_concerns: []
      };
    }

    const summary = analysis.what_it_does || '';
    const keyPoints = JSON.stringify(analysis.key_provisions || []);
    const tags = JSON.stringify(analysis.who_it_affects || []);

    console.log('\n   Summary:', summary.substring(0, 150) + '...');
    console.log('   Affected groups:', analysis.who_it_affects?.slice(0, 3).join(', ') || 'None');

    // 5. Save to database
    console.log('\n5️⃣  Saving enrichment to database...');
    await executeSQL(`
      UPDATE bill_enrichment
      SET plain_language_summary = '${summary.replace(/'/g, "''")}',
          key_points = '${keyPoints.replace(/'/g, "''")}',
          tags = '${tags.replace(/'/g, "''")}',
          status = 'complete',
          completed_at = '${new Date().toISOString()}',
          enriched_at = '${new Date().toISOString()}',
          model_used = 'gemini-3-pro-preview'
      WHERE bill_id = '${BILL_ID}'
    `);
    console.log('   ✓ Saved to database');

    // 6. Verify
    console.log('\n6️⃣  Verifying enrichment...');
    const verification = await executeSQL(`
      SELECT status, model_used, LENGTH(plain_language_summary) as summary_length
      FROM bill_enrichment
      WHERE bill_id = '${BILL_ID}'
    `);

    if (verification.results && verification.results.length > 0) {
      const v = verification.results[0];
      console.log('   ✓ Enrichment verified:');
      console.log(`     Status: ${v.status}`);
      console.log(`     Model: ${v.model_used}`);
      console.log(`     Summary length: ${v.summary_length} chars`);
    }

    console.log('\n🎉 Success! Refresh http://localhost:3000/bills/119-s-1092 to see the AI analysis');

  } catch (error) {
    console.error('❌ Error:', error);

    // Mark as failed
    try {
      await executeSQL(`
        UPDATE bill_enrichment
        SET status = 'failed',
            completed_at = '${new Date().toISOString()}'
        WHERE bill_id = '${BILL_ID}'
      `);
    } catch (e) {
      console.error('Failed to update status:', e);
    }

    process.exit(1);
  }
}

enrichBillWithGemini().then(() => {
  console.log('\n✅ Enrichment complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
