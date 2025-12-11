/**
 * Check cosponsor data for a specific representative
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

async function checkCosponsors() {
  console.log(`🔍 Checking cosponsor data for: ${BIOGUIDE_ID}\n`);

  try {
    // Check if member exists
    console.log('1. Checking if member exists in members table...');
    const member = await executeSQL(`SELECT bioguide_id, first_name, last_name, party, state FROM members WHERE bioguide_id = '${BIOGUIDE_ID}'`);
    if (member.results && member.results.length > 0) {
      const m = member.results[0];
      console.log(`   ✅ Found: ${m.first_name} ${m.last_name} (${m.party}-${m.state})`);
    } else {
      console.log('   ❌ Member not found in database!');
      return;
    }

    // Check bill_cosponsors table structure
    console.log('\n2. Checking bill_cosponsors table structure...');
    const tableInfo = await executeSQL(`PRAGMA table_info(bill_cosponsors)`);
    console.log('   Columns:', tableInfo.results?.map((r: any) => r.name).join(', '));

    // Count total cosponsors
    console.log('\n3. Checking total cosponsor records in database...');
    const totalCosponsors = await executeSQL(`SELECT COUNT(*) as count FROM bill_cosponsors`);
    console.log(`   Total cosponsor records: ${totalCosponsors.results?.[0]?.count || 0}`);

    // Check for this specific member
    console.log(`\n4. Checking cosponsors for ${BIOGUIDE_ID}...`);
    const memberCosponsors = await executeSQL(`SELECT COUNT(*) as count FROM bill_cosponsors WHERE member_bioguide_id = '${BIOGUIDE_ID}'`);
    const count = memberCosponsors.results?.[0]?.count || 0;
    console.log(`   Cosponsor records for ${BIOGUIDE_ID}: ${count}`);

    if (count > 0) {
      // Get sample bills they cosponsored
      console.log(`\n5. Sample bills cosponsored by ${BIOGUIDE_ID}:`);
      const sampleBills = await executeSQL(`
        SELECT
          bc.member_bioguide_id,
          bc.bill_id,
          bc.cosponsor_date,
          b.bill_type,
          b.bill_number,
          b.title
        FROM bill_cosponsors bc
        LEFT JOIN bills b ON bc.bill_id = b.id
        WHERE bc.member_bioguide_id = '${BIOGUIDE_ID}'
        ORDER BY bc.cosponsor_date DESC
        LIMIT 5
      `);

      sampleBills.results?.forEach((bill: any, i: number) => {
        console.log(`\n   ${i + 1}. ${bill.bill_type?.toUpperCase()} ${bill.bill_number}`);
        console.log(`      Bill ID: ${bill.bill_id}`);
        console.log(`      Cosponsor Date: ${bill.cosponsor_date}`);
        console.log(`      Title: ${bill.title?.substring(0, 80)}...`);
      });
    } else {
      // Check if there are any cosponsors at all
      console.log('\n5. Checking sample of ALL cosponsors in database...');
      const allSamples = await executeSQL(`
        SELECT member_bioguide_id, COUNT(*) as count
        FROM bill_cosponsors
        GROUP BY member_bioguide_id
        ORDER BY count DESC
        LIMIT 10
      `);
      console.log('   Top 10 members by cosponsor count:');
      allSamples.results?.forEach((r: any) => {
        console.log(`   - ${r.member_bioguide_id}: ${r.count} bills`);
      });
    }

    // Check if bills exist for this member's cosponsored bills
    console.log('\n6. Checking for orphaned cosponsor records (cosponsors without matching bills)...');
    const orphaned = await executeSQL(`
      SELECT COUNT(*) as count
      FROM bill_cosponsors bc
      LEFT JOIN bills b ON bc.bill_id = b.id
      WHERE bc.member_bioguide_id = '${BIOGUIDE_ID}' AND b.id IS NULL
    `);
    console.log(`   Orphaned records: ${orphaned.results?.[0]?.count || 0}`);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkCosponsors().then(() => {
  console.log('\n✅ Check complete');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
