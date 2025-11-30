import Anthropic from '@anthropic-ai/sdk';
import { readFileSync } from 'fs';

// Load API key from .env.local (can be ANTHROPIC_API_KEY or CLAUDE_API_KEY)
let apiKey = process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY;
if (!apiKey) {
  try {
    const envContent = readFileSync('.env.local', 'utf8');
    let match = envContent.match(/ANTHROPIC_API_KEY=["']?([^"'\n]+)["']?/);
    if (!match) match = envContent.match(/CLAUDE_API_KEY=["']?([^"'\n]+)["']?/);
    if (match) apiKey = match[1];
  } catch (e) {
    // File not found, continue
  }
}

if (!apiKey) {
  console.error('API key not found. Please set CLAUDE_API_KEY or ANTHROPIC_API_KEY in .env.local');
  process.exit(1);
}

const client = new Anthropic({
  apiKey
});

// Sample news articles (similar to what Exa would return)
const newsArticles = [
  {
    title: "House Passes Affordable Housing Tax Credit Expansion",
    summary: "The House approved a bipartisan bill to expand the Low-Income Housing Tax Credit program by 50%, aiming to create 2 million new affordable units over the next decade.",
    url: "https://example.com/housing-bill"
  },
  {
    title: "Senate Committee Advances Immigration Reform Package",
    summary: "The Senate Judiciary Committee voted to advance a comprehensive immigration reform bill that includes pathway provisions and border security funding.",
    url: "https://example.com/immigration"
  }
];

// Sample bill updates
const billUpdates = [
  {
    title: "H.R. 1234 - Affordable Housing Investment Act",
    latestAction: "Passed House with 285-142 vote",
    summary: "Expands LIHTC program and creates new incentives for affordable housing development in underserved areas."
  },
  {
    title: "S. 567 - Healthcare Access Improvement Act",
    latestAction: "Referred to Senate HELP Committee",
    summary: "Addresses healthcare access in rural communities through telehealth expansion and provider incentives."
  }
];

const userInterests = ["affordable housing", "healthcare policy", "immigration"];
const briefType = "daily";

// Host names for a more personal feel
const hostA = "Arabella";
const hostB = "Mark";

const duration = '7-9 minutes';

const systemPrompt = `You are a professional podcast scriptwriter specializing in Congressional affairs.

Create a ${briefType} legislative briefing podcast script (${duration} audio length):

REQUIREMENTS:
- 2-host conversational format between ${hostA} (female host) and ${hostB} (male host)
- Natural, engaging dialogue suitable for text-to-speech
- Clear speaker labels: "${hostA.toUpperCase()}:" and "${hostB.toUpperCase()}:"
- Include emotional cues in brackets like [warmly], [thoughtfully], [with emphasis]
- Target ${duration} when read aloud (approximately 1400-1800 words)
- Make complex legislation accessible through natural conversation
- Hosts should occasionally use each other's names naturally in conversation
- Include smooth transitions between topics

User's policy interests: ${userInterests.join(', ')}

Output ONLY the podcast script, no JSON wrapper needed.`;

const newsSection = newsArticles.map((article, i) =>
  `${i + 1}. ${article.title}\n   Summary: ${article.summary}\n   Source: ${article.url}`
).join('\n\n');

const billsSection = billUpdates.map((bill, i) =>
  `${i + 1}. ${bill.title}\n   Latest Action: ${bill.latestAction}\n   Summary: ${bill.summary}`
).join('\n\n');

const userPrompt = `Create a ${briefType} legislative briefing podcast script covering:

NEWS (${newsArticles.length} articles):
${newsSection}

TRACKED BILL UPDATES (${billUpdates.length} bills):
${billsSection}

Generate the complete podcast script with Host A and Host B dialogue.`;

console.log('Testing Claude Sonnet 4.5 script generation...\n');
console.log('='.repeat(80));

const startTime = Date.now();

const response = await client.messages.create({
  model: 'claude-sonnet-4-5',
  max_tokens: 4096,
  temperature: 0.75,
  system: systemPrompt,
  messages: [
    {
      role: 'user',
      content: userPrompt
    }
  ],
  tools: [
    {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 3
    }
  ]
});

const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

// Extract text content
let scriptContent = '';
let searchesUsed = 0;

for (const block of response.content) {
  if (block.type === 'text') {
    scriptContent += block.text;
  } else if (block.type === 'tool_use') {
    searchesUsed++;
  }
}

console.log('\nGENERATED PODCAST SCRIPT:');
console.log('='.repeat(80));
console.log(scriptContent);
console.log('='.repeat(80));

console.log('\n--- STATS ---');
console.log(`Time: ${elapsed}s`);
console.log(`Input tokens: ${response.usage.input_tokens}`);
console.log(`Output tokens: ${response.usage.output_tokens}`);
console.log(`Web searches: ${searchesUsed}`);

const cost = (response.usage.input_tokens / 1_000_000 * 3) + (response.usage.output_tokens / 1_000_000 * 15);
console.log(`Estimated cost: $${cost.toFixed(4)}`);
