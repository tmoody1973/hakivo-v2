/**
 * Comprehensive enrichment: Both basic summary AND deep analysis
 * Populates bill_enrichment + bill_analysis tables
 */

import { GoogleGenerativeAI } from '@google/generative-ai';

const ADMIN_DASHBOARD_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BILL_ID = '119-s-1092';
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || '';

if (!GEMINI_API_KEY) {
  console.error('❌ GEMINI_API_KEY not found in environment');
  process.exit(1);
}

const POLICY_ANALYST_PROMPT = `You are a neutral policy analyst conducting forensic legislative analysis. Analyze bills with strict objectivity, translating complex legislation into plain English while maintaining forensic depth.

Core Principles:
- Strict neutrality: Present facts without bias
- Plain English: Avoid jargon, use accessible language
- Forensic depth: Analyze mechanisms, not just outcomes
- Steelman both sides: Present strongest arguments for and against
- Implementation focus: Identify practical challenges`;

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

async function enrichBillComprehensive() {
  console.log(`🤖 Comprehensive enrichment for ${BILL_ID}...\n`);

  try {
    // 1. Get bill
    console.log('1️⃣  Fetching bill...');
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
    console.log(`   ✓ ${bill.title}`);
    console.log(`   ✓ ${bill.text?.length || 0} characters of bill text`);

    // 2. Generate deep analysis with Gemini
    console.log('\n2️⃣  Calling Gemini API for deep analysis...');
    const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
    const model = genAI.getGenerativeModel({ model: 'gemini-3-pro-preview' });

    const prompt = `${POLICY_ANALYST_PROMPT}

Analyze this legislation and provide comprehensive analysis in JSON format:

Bill: ${bill.bill_type}${bill.bill_number} - ${bill.congress}th Congress
Title: ${bill.title}
Latest Action: ${bill.latest_action_text || 'None'}

FULL BILL TEXT:
${bill.text.substring(0, 30000)}

Return ONLY a valid JSON object with these fields:

{
  "plain_language_summary": "2-3 sentences explaining what this bill does and who it affects in plain English",

  "key_provisions": [
    "Detailed provision 1 with specific details from bill text (be specific about numbers, percentages, requirements)",
    "Detailed provision 2 with mechanisms explained",
    "Detailed provision 3 with implementation details",
    "At least 5-7 detailed provisions"
  ],

  "who_it_affects": ["specific stakeholder group 1", "group 2", "group 3"],

  "arguments_for": [
    {"point": "Strong argument supporting the bill", "evidence": "Specific evidence or reasoning"},
    {"point": "Second benefit", "evidence": "Supporting details"},
    {"point": "Third benefit", "evidence": "Why this matters"}
  ],

  "arguments_against": [
    {"point": "Strong concern about the bill", "evidence": "Specific risks or issues"},
    {"point": "Second concern", "evidence": "Why this is problematic"},
    {"point": "Third concern", "evidence": "Potential negative impacts"}
  ],

  "stakeholder_impact": {
    "winners": ["Who benefits and how"],
    "losers": ["Who is disadvantaged"],
    "affected_groups": ["Neutral parties affected"]
  }
}

IMPORTANT:
- Be VERY SPECIFIC in key_provisions - include actual numbers, percentages, dates from the bill text
- Arguments for/against should be substantive policy analysis, not generic statements
- Use actual details from the bill text to support each point`;

    const result = await model.generateContent(prompt);
    const responseText = result.response.text();
    console.log(`   ✓ Received ${responseText.length} characters`);

    // 3. Parse response
    console.log('\n3️⃣  Parsing analysis...');
    let analysis: any;
    try {
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(responseText);
      }
      console.log('   ✓ Successfully parsed JSON');
    } catch (error) {
      console.error('   ❌ Failed to parse JSON:', error);
      console.log('   Response:', responseText.substring(0, 500));
      throw error;
    }

    const now = new Date().toISOString();

    // 4. Save basic enrichment
    console.log('\n4️⃣  Saving basic enrichment...');
    const summary = analysis.plain_language_summary || '';
    const keyPoints = JSON.stringify(analysis.key_provisions || []);
    const tags = JSON.stringify(analysis.who_it_affects || []);

    await executeSQL(`
      INSERT OR REPLACE INTO bill_enrichment (
        bill_id,
        plain_language_summary,
        key_points,
        tags,
        status,
        started_at,
        completed_at,
        enriched_at,
        model_used
      ) VALUES (
        '${BILL_ID}',
        '${summary.replace(/'/g, "''")}',
        '${keyPoints.replace(/'/g, "''")}',
        '${tags.replace(/'/g, "''")}',
        'complete',
        '${now}',
        '${now}',
        '${now}',
        'gemini-3-pro-preview'
      )
    `);
    console.log('   ✓ Basic enrichment saved');

    // 5. Save deep analysis
    console.log('\n5️⃣  Saving deep analysis...');

    const argumentsFor = JSON.stringify(analysis.arguments_for || []);
    const argumentsAgainst = JSON.stringify(analysis.arguments_against || []);
    const stakeholderImpact = JSON.stringify(analysis.stakeholder_impact || {});

    await executeSQL(`
      INSERT OR REPLACE INTO bill_analysis (
        bill_id,
        executive_summary,
        arguments_for,
        arguments_against,
        stakeholder_impact,
        status,
        started_at,
        completed_at,
        analyzed_at,
        model_used
      ) VALUES (
        '${BILL_ID}',
        '${summary.replace(/'/g, "''")}',
        '${argumentsFor.replace(/'/g, "''")}',
        '${argumentsAgainst.replace(/'/g, "''")}',
        '${stakeholderImpact.replace(/'/g, "''")}',
        'complete',
        '${now}',
        '${now}',
        CAST(strftime('%s', 'now') AS INTEGER),
        'gemini-3-pro-preview'
      )
    `);
    console.log('   ✓ Deep analysis saved');

    // 6. Display results
    console.log('\n📊 Analysis Summary:');
    console.log('\nSummary:', summary.substring(0, 200) + '...');
    console.log('\nKey Provisions:', analysis.key_provisions?.length || 0, 'detailed items');
    console.log('\nArguments FOR:', analysis.arguments_for?.length || 0, 'benefits');
    if (analysis.arguments_for) {
      analysis.arguments_for.forEach((arg: any, i: number) => {
        console.log(`  ${i + 1}. ${arg.point}`);
      });
    }
    console.log('\nArguments AGAINST:', analysis.arguments_against?.length || 0, 'concerns');
    if (analysis.arguments_against) {
      analysis.arguments_against.forEach((arg: any, i: number) => {
        console.log(`  ${i + 1}. ${arg.point}`);
      });
    }

    console.log('\n🎉 Refresh the bill page to see comprehensive analysis with:');
    console.log('   ✓ Detailed key provisions from actual bill text');
    console.log('   ✓ Potential Benefits (arguments_for)');
    console.log('   ✓ Potential Concerns (arguments_against)');
    console.log('   ✓ Stakeholder impact analysis');

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

enrichBillComprehensive().then(() => {
  console.log('\n✅ Comprehensive enrichment complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
