import { NextResponse } from 'next/server';

const RSS_URL = 'https://docs.house.gov/BillsThisWeek-RSS.xml';
const BILLS_API_URL = process.env.NEXT_PUBLIC_BILLS_API_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzh.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

interface FloorBill {
  id: string;
  billType: string;
  billNumber: number;
  title: string;
  congress: number;
  pdfUrl?: string;
  xmlUrl?: string;
  inDatabase: boolean;
  dbBillId?: string | null;
  weekOf?: string;
}

interface FloorBillsResponse {
  bills: FloorBill[];
  count: number;
  lastUpdated: number;
  weekOf?: string;
  error?: string;
  message?: string;
}

/**
 * Parse bill identifier from HTML format like "H.R. 6703", "H. Con. Res. 61", etc.
 */
function parseBillIdentifier(identifier: string): { type: string; number: number } | null {
  // Normalize spaces and periods
  const normalized = identifier.trim().toUpperCase();

  // Map display format to database format
  const patterns: Array<{ regex: RegExp; type: string }> = [
    { regex: /^H\.?\s*R\.?\s*(\d+)$/i, type: 'hr' },
    { regex: /^S\.?\s*(\d+)$/i, type: 's' },
    { regex: /^H\.?\s*CON\.?\s*RES\.?\s*(\d+)$/i, type: 'hconres' },
    { regex: /^S\.?\s*CON\.?\s*RES\.?\s*(\d+)$/i, type: 'sconres' },
    { regex: /^H\.?\s*J\.?\s*RES\.?\s*(\d+)$/i, type: 'hjres' },
    { regex: /^S\.?\s*J\.?\s*RES\.?\s*(\d+)$/i, type: 'sjres' },
    { regex: /^H\.?\s*RES\.?\s*(\d+)$/i, type: 'hres' },
    { regex: /^S\.?\s*RES\.?\s*(\d+)$/i, type: 'sres' },
  ];

  for (const { regex, type } of patterns) {
    const match = normalized.match(regex);
    if (match) {
      return { type, number: parseInt(match[1], 10) };
    }
  }

  return null;
}

/**
 * Extract bills from RSS feed HTML content
 */
function extractBillsFromHtml(htmlContent: string, weekOf?: string): FloorBill[] {
  const bills: FloorBill[] = [];
  const seen = new Set<string>();

  // Match table rows with legisNum and floorText
  // Pattern: <td class="legisNum"...>BILL_NUMBER</td>...<td class="floorText"...>TITLE</td>
  const rowPattern = /<td[^>]*class="legisNum"[^>]*>([^<]+)<\/td>[\s\S]*?<td[^>]*class="floorText"[^>]*>([^<]+)<\/td>/gi;

  let match;
  while ((match = rowPattern.exec(htmlContent)) !== null) {
    const billIdentifier = match[1].trim();
    const title = match[2].trim();

    const parsed = parseBillIdentifier(billIdentifier);
    if (!parsed) {
      console.log('[floor-bills] Could not parse bill identifier:', billIdentifier);
      continue;
    }

    const id = `119-${parsed.type}-${parsed.number}`;

    // Skip duplicates
    if (seen.has(id)) continue;
    seen.add(id);

    bills.push({
      id,
      billType: parsed.type,
      billNumber: parsed.number,
      title,
      congress: 119,
      inDatabase: false,
      dbBillId: null,
      weekOf,
    });
  }

  return bills;
}

/**
 * Check if bills exist in our database
 */
async function checkBillsInDatabase(bills: FloorBill[]): Promise<FloorBill[]> {
  // Check each bill against our backend
  const checkedBills = await Promise.all(
    bills.map(async (bill) => {
      try {
        const response = await fetch(
          `${BILLS_API_URL}/bills/${bill.congress}/${bill.billType}/${bill.billNumber}`,
          {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
          }
        );

        if (response.ok) {
          const data = await response.json();
          if (data.success && data.bill) {
            return {
              ...bill,
              inDatabase: true,
              dbBillId: data.bill.id,
              // Use database title if available (usually more complete)
              title: data.bill.title || bill.title,
            };
          }
        }
      } catch (error) {
        console.log(`[floor-bills] Error checking bill ${bill.id}:`, error);
      }

      return bill;
    })
  );

  return checkedBills;
}

export async function GET() {
  try {
    // Fetch RSS feed
    const response = await fetch(RSS_URL, {
      headers: {
        'Accept': 'application/xml, application/atom+xml, text/xml',
        'User-Agent': 'Hakivo/1.0 (Legislative Tracking)',
      },
      next: { revalidate: 3600 } // Cache for 1 hour
    });

    if (!response.ok) {
      throw new Error(`RSS feed fetch failed: ${response.status} ${response.statusText}`);
    }

    const xmlText = await response.text();

    // Extract all bills from all entries in the feed
    const allBills: FloorBill[] = [];

    // Parse entries from the Atom feed
    // Pattern: <entry>...<content...>HTML_CONTENT</content>...</entry>
    const entryPattern = /<entry>([\s\S]*?)<\/entry>/gi;
    const titlePattern = /<title[^>]*>([^<]+)<\/title>/i;
    const contentPattern = /<content[^>]*>([\s\S]*?)<\/content>/i;

    let entryMatch;
    while ((entryMatch = entryPattern.exec(xmlText)) !== null) {
      const entryContent = entryMatch[1];

      // Get the week title from entry title
      const titleMatch = entryContent.match(titlePattern);
      const weekOf = titleMatch ? titleMatch[1].trim() : undefined;

      // Get the HTML content
      const contentMatch = entryContent.match(contentPattern);
      if (contentMatch) {
        // Decode HTML entities
        const htmlContent = contentMatch[1]
          .replace(/&lt;/g, '<')
          .replace(/&gt;/g, '>')
          .replace(/&amp;/g, '&')
          .replace(/&quot;/g, '"');

        const bills = extractBillsFromHtml(htmlContent, weekOf);
        allBills.push(...bills);
      }
    }

    // Deduplicate bills (same bill might appear in multiple week entries)
    const uniqueBills = Array.from(
      new Map(allBills.map(b => [b.id, b])).values()
    );

    console.log(`[floor-bills] Extracted ${uniqueBills.length} unique bills from RSS feed`);

    // Check which bills exist in our database
    const checkedBills = await checkBillsInDatabase(uniqueBills);

    const inDbCount = checkedBills.filter(b => b.inDatabase).length;
    console.log(`[floor-bills] ${inDbCount}/${checkedBills.length} bills found in database`);

    const responseData: FloorBillsResponse = {
      bills: checkedBills,
      count: checkedBills.length,
      lastUpdated: Date.now(),
    };

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('[floor-bills] Error:', error);
    return NextResponse.json(
      {
        bills: [],
        count: 0,
        lastUpdated: Date.now(),
        error: 'Failed to fetch floor bills',
        message: error instanceof Error ? error.message : 'Unknown error',
      } as FloorBillsResponse,
      { status: 500 }
    );
  }
}
