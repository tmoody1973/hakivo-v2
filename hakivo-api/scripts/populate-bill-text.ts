/**
 * Manually populate bill text for a specific bill
 * Fetches from Congress.gov and saves stripped plain text to database
 */

const ADMIN_DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyz1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
const CONGRESS_API_URL = 'https://api.congress.gov/v3';
const API_KEY = process.env.CONGRESS_API_KEY || 'YOUR_API_KEY';

// Bill to populate
const BILL_ID = '119-s-1092';
const [congress, chamber, number] = BILL_ID.split('-');
const billType = chamber.toLowerCase();

/**
 * Strip HTML tags and extract plain text from bill content
 */
function stripHTML(html: string): string {
  // Remove HTML tags
  let text = html.replace(/<[^>]*>/g, '');

  // Decode HTML entities
  text = text
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, ' ');

  // Remove excessive whitespace
  text = text.replace(/\n{3,}/g, '\n\n');
  text = text.replace(/[ \t]+/g, ' ');

  return text.trim();
}

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

async function populateBillText() {
  console.log(`📄 Populating bill text for: ${BILL_ID}\n`);

  try {
    // Step 1: Fetch bill details from Congress API
    console.log('1️⃣  Fetching bill details from Congress API...');
    const billUrl = `${CONGRESS_API_URL}/bill/${congress}/${billType}/${number}?api_key=${API_KEY}`;
    const billResponse = await fetch(billUrl);

    if (!billResponse.ok) {
      throw new Error(`Failed to fetch bill: ${billResponse.status}`);
    }

    const billData = await billResponse.json();
    const bill = billData.bill;

    console.log(`   ✓ Found: ${bill.title}`);

    // Step 2: Fetch text versions from the URL
    console.log('\n2️⃣  Fetching text versions...');
    const baseTextVersionsUrl = bill.textVersions?.url || `${CONGRESS_API_URL}/bill/${congress}/${billType}/${number}/text`;
    const textVersionsUrl = `${baseTextVersionsUrl}${baseTextVersionsUrl.includes('?') ? '&' : '?'}api_key=${API_KEY}`;
    const textVersionsResponse = await fetch(textVersionsUrl);

    if (!textVersionsResponse.ok) {
      throw new Error(`Failed to fetch text versions: ${textVersionsResponse.status}`);
    }

    const textVersionsData: any = await textVersionsResponse.json();

    if (!textVersionsData.textVersions || textVersionsData.textVersions.length === 0) {
      console.log('   ⚠️  No text versions available for this bill');
      return;
    }

    console.log(`   ✓ Found ${textVersionsData.textVersions.length} text version(s)`);

    const latestText = textVersionsData.textVersions[0];
    if (!latestText.formats) {
      console.log('   ⚠️  No text formats available');
      return;
    }

    const textFormat = latestText.formats.find((f: any) => f.type === 'Formatted Text');
    if (!textFormat?.url) {
      console.log('   ⚠️  No formatted text URL available');
      return;
    }

    console.log(`   ✓ Found text URL: ${textFormat.url}`);

    // Step 3: Fetch bill text
    console.log('\n3️⃣  Fetching bill text...');
    const textResponse = await fetch(textFormat.url);
    const billText = await textResponse.text();

    console.log(`   ✓ Downloaded ${billText.length} characters (HTML)`);

    // Step 4: Strip HTML
    console.log('\n3️⃣  Stripping HTML...');
    const plainText = stripHTML(billText);

    console.log(`   ✓ Plain text: ${plainText.length} characters`);
    console.log(`   Preview: ${plainText.substring(0, 200)}...`);

    // Step 5: Update database
    console.log('\n4️⃣  Updating database...');
    await executeSQL(`UPDATE bills SET text = '${plainText.replace(/'/g, "''")}' WHERE id = '${BILL_ID}'`);

    console.log(`   ✓ Database updated`);

    // Step 6: Verify
    console.log('\n5️⃣  Verifying...');
    const result = await executeSQL(`
      SELECT id, title, LENGTH(text) as text_length, SUBSTR(text, 1, 200) as text_preview
      FROM bills
      WHERE id = '${BILL_ID}'
    `);

    if (result.results && result.results.length > 0) {
      const updated = result.results[0];
      console.log(`   ✓ Verified: ${updated.text_length} characters stored`);
      console.log(`   Preview: ${updated.text_preview}...`);
    }

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

populateBillText().then(() => {
  console.log('\n✅ Bill text populated successfully');
  process.exit(0);
}).catch(error => {
  console.error('❌ Failed:', error);
  process.exit(1);
});
