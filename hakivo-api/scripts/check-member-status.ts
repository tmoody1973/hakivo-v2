/**
 * Check if a member is marked as current and ready for cosponsor ingestion
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const BIOGUIDE_ID = 'J000293';

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

async function checkMemberStatus() {
  console.log(`🔍 Checking member status for: ${BIOGUIDE_ID}\n`);

  try {
    // Get member details
    const member = await executeSQL(`
      SELECT bioguide_id, first_name, last_name, party, state, current_member
      FROM members
      WHERE bioguide_id = '${BIOGUIDE_ID}'
    `);

    if (!member.results || member.results.length === 0) {
      console.log('❌ Member not found in database!');
      return;
    }

    const m = member.results[0];
    console.log('Member Details:');
    console.log(`  Name: ${m.first_name} ${m.last_name}`);
    console.log(`  Party: ${m.party}`);
    console.log(`  State: ${m.state}`);
    console.log(`  Current Member: ${m.current_member === 1 ? '✅ YES' : '❌ NO'}`);

    if (m.current_member !== 1) {
      console.log('\n⚠️  This member is NOT marked as current!');
      console.log('   The cosponsor ingestion script only processes current members.');
      console.log('   You can fix this by running:');
      console.log(`   UPDATE members SET current_member = 1 WHERE bioguide_id = '${BIOGUIDE_ID}';`);
    } else {
      console.log('\n✅ Member is marked as current and should be processed by ingestion script.');
    }

    // Check how many current members there are total
    const currentCount = await executeSQL(`SELECT COUNT(*) as count FROM members WHERE current_member = 1`);
    console.log(`\n📊 Total current members in database: ${currentCount.results?.[0]?.count || 0}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkMemberStatus().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
