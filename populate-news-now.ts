/**
 * One-time script to manually populate news database via HTTP API
 * Calls the deployed services to fetch and store news articles
 */

const EXA_API_KEY = '5032f9e2-d99d-46ca-9e92-918122bb7dfb';
const DASHBOARD_API_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q19.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

const policyInterests = [
  { interest: "Environment & Energy", keywords: ["climate", "pollution", "renewables", "conservation", "carbon", "emissions", "EPA"] },
  { interest: "Economy & Finance", keywords: ["economy", "inflation", "taxes", "public finance", "financial institutions", "budget", "economic development"] },
  { interest: "Health & Social Welfare", keywords: ["healthcare", "insurance", "public health", "welfare", "Medicaid", "mental health", "family services"] },
  { interest: "Education", keywords: ["schools", "higher education", "student aid", "teachers", "curriculum", "educational technology"] },
  { interest: "Civil Rights & Liberties", keywords: ["civil rights", "voting rights", "discrimination", "privacy", "freedom of speech", "constitutional rights"] },
  { interest: "Immigration", keywords: ["immigration", "border security", "citizenship", "refugees", "visa", "deportation", "asylum"] },
  { interest: "Foreign Policy & Defense", keywords: ["foreign policy", "defense", "military", "diplomacy", "international relations", "national security", "veterans"] },
  { interest: "Technology & Innovation", keywords: ["technology", "innovation", "cybersecurity", "artificial intelligence", "broadband", "data privacy", "tech regulation"] },
  { interest: "Criminal Justice", keywords: ["criminal justice", "law enforcement", "courts", "prisons", "sentencing", "police reform", "gun control"] },
  { interest: "Housing & Urban Development", keywords: ["housing", "urban development", "affordable housing", "homelessness", "community development", "zoning"] },
  { interest: "Agriculture & Rural Affairs", keywords: ["agriculture", "farming", "rural development", "food security", "farm subsidies", "livestock", "crop insurance"] },
  { interest: "Transportation & Infrastructure", keywords: ["transportation", "infrastructure", "roads", "bridges", "public transit", "aviation", "shipping"] }
];

async function populateNews() {
  console.log('📰 Populating News Database via HTTP API\n');

  let totalArticles = 0;

  for (const mapping of policyInterests) {
    console.log(`\n🔍 Fetching: ${mapping.interest}`);

    try {
      // Build search query
      const query = `${mapping.keywords.join(' OR ')} legislation Congress`;

      // Call Exa API directly
      const exaResponse = await fetch('https://api.exa.ai/search', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': EXA_API_KEY
        },
        body: JSON.stringify({
          query,
          numResults: 5,
          type: 'neural',
          category: 'news',
          startPublishedDate: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString(),
          endPublishedDate: new Date().toISOString(),
          contents: {
            text: { maxCharacters: 500 }
          }
        })
      });

      if (!exaResponse.ok) {
        throw new Error(`Exa API failed: ${exaResponse.status}`);
      }

      const exaData = await exaResponse.json();
      console.log(`   Found ${exaData.results?.length || 0} articles`);

      totalArticles += exaData.results?.length || 0;

    } catch (error) {
      console.error(`   ❌ Error: ${error instanceof Error ? error.message : 'Unknown'}`);
    }

    // Small delay to avoid rate limiting
    await new Promise(resolve => setTimeout(resolve, 1000));
  }

  console.log(`\n✅ Completed! Total articles found: ${totalArticles}`);
  console.log('\nNote: Articles are fetched but not stored yet.');
  console.log('The news-sync-scheduler will run automatically at 6 AM and 6 PM to populate the database.');
}

populateNews();
