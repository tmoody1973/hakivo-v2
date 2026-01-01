import type { Handler, HandlerEvent, HandlerContext } from "@netlify/functions";

/**
 * Federal Register Manual Sync Trigger
 *
 * Triggers a manual sync of Federal Register documents by directly
 * calling the sync observer's logic via the Federal Register API.
 *
 * POST /api/federal-register-sync-trigger
 * Body: { daysBack?: number }
 */

const RAINDROP_DB_URL = process.env.RAINDROP_DB_ADMIN_URL ||
  'https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

interface FederalRegisterDocument {
  document_number: string;
  type: string;
  subtype?: string;
  title: string;
  abstract?: string;
  action?: string;
  dates?: string;
  effective_on?: string;
  publication_date: string;
  agencies?: Array<{ name: string; slug: string; id: number }>;
  agency_names?: string[];
  topics?: string[];
  significant?: boolean;
  cfr_references?: any[];
  docket_ids?: string[];
  html_url: string;
  pdf_url?: string;
  full_text_xml_url?: string;
  raw_text_url?: string;
  page_length?: number;
  comments_close_on?: string;
  comment_url?: string;
  start_page?: number;
  end_page?: number;
}

// Policy interest to agency mapping
const POLICY_TO_AGENCIES: Record<string, string[]> = {
  'Health & Social Welfare': ['Health and Human Services Department', 'Centers for Medicare & Medicaid Services', 'Food and Drug Administration', 'Centers for Disease Control and Prevention', 'National Institutes of Health'],
  'Economy & Finance': ['Treasury Department', 'Federal Reserve System', 'Securities and Exchange Commission', 'Commodity Futures Trading Commission', 'Consumer Financial Protection Bureau'],
  'Commerce & Labor': ['Commerce Department', 'Labor Department', 'Small Business Administration', 'Federal Trade Commission', 'International Trade Commission'],
  'Housing & Urban Development': ['Housing and Urban Development Department', 'Federal Housing Finance Agency', 'Federal Housing Administration'],
  'Foreign Policy & Defense': ['Defense Department', 'State Department', 'Homeland Security Department', 'Veterans Affairs Department'],
  'Environment & Energy': ['Environmental Protection Agency', 'Energy Department', 'Interior Department', 'Nuclear Regulatory Commission'],
  'Education & Science': ['Education Department', 'National Science Foundation', 'National Aeronautics and Space Administration'],
  'Agriculture & Food': ['Agriculture Department', 'Food and Drug Administration'],
  'Civil Rights & Law': ['Justice Department', 'Equal Employment Opportunity Commission', 'Civil Rights Commission'],
  'Government & Politics': ['Executive Office of the President', 'Office of Management and Budget', 'Office of Personnel Management'],
  'Immigration & Indigenous Issues': ['Homeland Security Department', 'Citizenship and Immigration Services', 'Interior Department'],
  'Sports, Arts & Culture': ['National Endowment for the Arts', 'National Endowment for the Humanities', 'Smithsonian Institution']
};

async function queryDatabase(query: string): Promise<any> {
  const response = await fetch(`${RAINDROP_DB_URL}/db-admin/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query })
  });
  return response.json();
}

async function fetchFederalRegisterDocuments(daysBack: number): Promise<FederalRegisterDocument[]> {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - daysBack);

  const startDateStr = startDate.toISOString().split('T')[0];
  const endDateStr = endDate.toISOString().split('T')[0];

  const types = ['RULE', 'PRORULE', 'NOTICE', 'PRESDOCU'];
  const allDocs: FederalRegisterDocument[] = [];

  for (const type of types) {
    try {
      const url = `https://www.federalregister.gov/api/v1/documents.json?per_page=100&conditions[type][]=${type}&conditions[publication_date][gte]=${startDateStr}&conditions[publication_date][lte]=${endDateStr}`;
      console.log(`Fetching ${type} documents from ${startDateStr} to ${endDateStr}...`);

      const response = await fetch(url);
      const data = await response.json();

      if (data.results) {
        console.log(`Found ${data.results.length} ${type} documents`);
        allDocs.push(...data.results);
      }
    } catch (error) {
      console.error(`Error fetching ${type} documents:`, error);
    }
  }

  return allDocs;
}

function getAgencyNames(doc: FederalRegisterDocument): string[] {
  if (doc.agency_names && doc.agency_names.length > 0) {
    return doc.agency_names;
  }
  if (doc.agencies && doc.agencies.length > 0) {
    return doc.agencies.map(a => a.name);
  }
  return [];
}

function scoreDocumentForUser(doc: FederalRegisterDocument, policyInterests: string[]): number {
  const agencyNames = getAgencyNames(doc);
  let score = 0;

  // Check if any document agencies match user's policy interests
  for (const interest of policyInterests) {
    const relevantAgencies = POLICY_TO_AGENCIES[interest] || [];
    for (const agency of agencyNames) {
      if (relevantAgencies.some(ra => agency.toLowerCase().includes(ra.toLowerCase()) || ra.toLowerCase().includes(agency.toLowerCase()))) {
        score += 30;
        break;
      }
    }
  }

  // Bonus for significant documents
  if (doc.significant) score += 20;

  // Bonus for rules (more impactful than notices)
  if (doc.type === 'RULE' || doc.type === 'PRESDOCU') score += 15;
  if (doc.type === 'PRORULE') score += 10;

  // Bonus for documents open for comment
  if (doc.comments_close_on) score += 10;

  return Math.min(score, 100);
}

export const handler: Handler = async (event: HandlerEvent, context: HandlerContext) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const body = event.body ? JSON.parse(event.body) : {};
    const daysBack = body.daysBack || 2;

    console.log(`Starting manual Federal Register sync (${daysBack} days back)...`);

    // Fetch documents from Federal Register API
    const documents = await fetchFederalRegisterDocuments(daysBack);
    console.log(`Fetched ${documents.length} total documents`);

    // Get users with policy interests
    const usersResult = await queryDatabase(`
      SELECT u.id, u.email, up.policy_interests
      FROM users u
      LEFT JOIN user_preferences up ON u.id = up.user_id
      WHERE up.policy_interests IS NOT NULL
    `);

    const users = usersResult.results || [];
    console.log(`Found ${users.length} users with policy interests`);

    let documentsStored = 0;
    let notificationsCreated = 0;
    const errors: string[] = [];

    for (const doc of documents) {
      try {
        // Check if document already exists
        const existingResult = await queryDatabase(
          `SELECT id FROM federal_documents WHERE document_number = '${doc.document_number}'`
        );

        if (existingResult.results && existingResult.results.length > 0) {
          console.log(`Skipping existing document: ${doc.document_number}`);
          continue;
        }

        // Generate UUID for document
        const docId = crypto.randomUUID();
        const agencyNames = getAgencyNames(doc);

        // Insert document (escaping single quotes)
        const title = doc.title.replace(/'/g, "''");
        const abstract = (doc.abstract || '').replace(/'/g, "''");
        const action = (doc.action || '').replace(/'/g, "''");
        const dates = (doc.dates || '').replace(/'/g, "''");

        const insertQuery = `
          INSERT INTO federal_documents (
            id, document_number, type, subtype, title, abstract, action, dates,
            effective_on, publication_date, agencies, agency_names, topics,
            significant, cfr_references, docket_ids, html_url, pdf_url,
            full_text_xml_url, raw_text_url, page_length, comments_close_on,
            comment_url, start_page, end_page, synced_at, created_at, updated_at
          ) VALUES (
            '${docId}', '${doc.document_number}', '${doc.type}', ${doc.subtype ? `'${doc.subtype}'` : 'NULL'},
            '${title}', '${abstract}', '${action}', '${dates}',
            ${doc.effective_on ? `'${doc.effective_on}'` : 'NULL'}, '${doc.publication_date}',
            '${JSON.stringify(doc.agencies || []).replace(/'/g, "''")}',
            '${JSON.stringify(agencyNames).replace(/'/g, "''")}',
            '${JSON.stringify(doc.topics || []).replace(/'/g, "''")}',
            ${doc.significant ? 1 : 0},
            '${JSON.stringify(doc.cfr_references || []).replace(/'/g, "''")}',
            '${JSON.stringify(doc.docket_ids || []).replace(/'/g, "''")}',
            '${doc.html_url}', ${doc.pdf_url ? `'${doc.pdf_url}'` : 'NULL'},
            ${doc.full_text_xml_url ? `'${doc.full_text_xml_url}'` : 'NULL'},
            ${doc.raw_text_url ? `'${doc.raw_text_url}'` : 'NULL'},
            ${doc.page_length || 0}, ${doc.comments_close_on ? `'${doc.comments_close_on}'` : 'NULL'},
            ${doc.comment_url ? `'${doc.comment_url}'` : 'NULL'},
            ${doc.start_page || 'NULL'}, ${doc.end_page || 'NULL'},
            ${Date.now()}, ${Date.now()}, ${Date.now()}
          )
        `;

        await queryDatabase(insertQuery);
        documentsStored++;
        console.log(`Stored: ${doc.document_number} - ${doc.title.substring(0, 50)}...`);

        // Create notifications for matching users
        for (const user of users) {
          try {
            const policyInterests = typeof user.policy_interests === 'string'
              ? JSON.parse(user.policy_interests)
              : user.policy_interests;

            const score = scoreDocumentForUser(doc, policyInterests);

            if (score >= 25) {
              const notificationId = crypto.randomUUID();
              const notificationType = score >= 50 ? 'interest_match' : 'agency_update';
              const priority = score >= 70 ? 'high' : 'normal';
              const message = doc.title.length > 150 ? doc.title.substring(0, 147) + '...' : doc.title;
              const notifTitle = `New ${doc.type}: ${agencyNames[0] || 'Federal Agency'}`;

              const notifQuery = `
                INSERT INTO federal_notifications (
                  id, user_id, notification_type, document_id, title, message,
                  priority, federal_data, action_url, created_at
                ) VALUES (
                  '${notificationId}', '${user.id}', '${notificationType}', '${docId}',
                  '${notifTitle.replace(/'/g, "''")}', '${message.replace(/'/g, "''")}',
                  '${priority}',
                  '${JSON.stringify({
                    document_number: doc.document_number,
                    type: doc.type,
                    agencies: agencyNames,
                    relevance_score: score
                  }).replace(/'/g, "''")}',
                  '${doc.html_url}', ${Date.now()}
                )
              `;

              await queryDatabase(notifQuery);
              notificationsCreated++;
              console.log(`Created notification for ${user.email} (score: ${score})`);
            }
          } catch (userError) {
            console.warn(`Failed to process user ${user.id}:`, userError);
          }
        }

      } catch (docError) {
        const errorMsg = `Failed to process ${doc.document_number}: ${docError}`;
        console.error(errorMsg);
        errors.push(errorMsg);
      }
    }

    // Log sync completion
    const syncId = crypto.randomUUID();
    await queryDatabase(`
      INSERT INTO federal_sync_log (id, sync_type, status, documents_fetched, documents_stored, notifications_created, started_at, completed_at)
      VALUES ('${syncId}', 'manual_sync', 'completed', ${documents.length}, ${documentsStored}, ${notificationsCreated}, ${Date.now()}, ${Date.now()})
    `);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: 'Manual sync completed',
        stats: {
          documentsFetched: documents.length,
          documentsStored,
          notificationsCreated,
          errors: errors.length
        },
        timestamp: new Date().toISOString()
      })
    };

  } catch (error) {
    console.error('Manual sync failed:', error);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      })
    };
  }
};
