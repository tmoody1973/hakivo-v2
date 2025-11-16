/**
 * Claude (Anthropic) API Client
 *
 * Generates podcast scripts for daily (7-9 min) and weekly (15-20 min)
 * audio briefings using Claude 4.5 Sonnet.
 *
 * API Base URL: https://api.anthropic.com/v1
 * Documentation: https://docs.anthropic.com/claude/reference
 *
 * Rate Limits: Varies by tier (standard: 50 requests/minute)
 */

import {
  DailyBriefingRequest,
  WeeklyBriefingRequest,
  BriefingScript,
  BriefingType,
  Speaker,
  DialogueLine,
  ClaudeMessageRequest,
  ClaudeResponse,
} from '../api-specs/claude.types';
import { APIResponse } from '../api-specs/common.types';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_DAILY_SCRIPT: BriefingScript = {
  type: BriefingType.DAILY,
  title: 'Daily Legislative Briefing - January 16, 2025',
  date: '2025-01-16',
  estimatedDuration: 480, // 8 minutes
  wordCount: 1600,
  dialogue: [
    { speaker: Speaker.SARAH, text: "Good morning! I'm Sarah." },
    { speaker: Speaker.JAMES, text: "And I'm James. Welcome to your Hakivo daily briefing for January 16th, 2025." },
    {
      speaker: Speaker.SARAH,
      text: "Today we'll cover the latest news on climate policy and updates on the bills you're tracking.",
    },
  ],
  sections: [
    {
      type: 'intro',
      dialogue: [
        { speaker: Speaker.SARAH, text: "Good morning! I'm Sarah." },
        { speaker: Speaker.JAMES, text: "And I'm James. Welcome to your Hakivo daily briefing for January 16th, 2025." },
      ],
      wordCount: 50,
    },
  ],
};

// ============================================================================
// Script Generation Functions
// ============================================================================

/**
 * Generate daily briefing script (7-9 minutes)
 *
 * Creates a conversational podcast script with personalized news and
 * tracked bill updates.
 *
 * @param request - Daily briefing parameters
 * @returns Generated script with dialogue
 *
 * API ENDPOINT: POST https://api.anthropic.com/v1/messages
 * HEADERS: {
 *   'x-api-key': process.env.ANTHROPIC_API_KEY,
 *   'anthropic-version': '2023-06-01',
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   model: 'claude-sonnet-4-5-20250929',
 *   max_tokens: 8192,
 *   temperature: 0.7,
 *   system: "You are a podcast script writer...",
 *   messages: [{
 *     role: 'user',
 *     content: "Generate a 7-9 minute podcast script..."
 *   }]
 * }
 * SUCCESS RESPONSE (200): {
 *   id: string,
 *   type: 'message',
 *   role: 'assistant',
 *   content: [{
 *     type: 'text',
 *     text: string (JSON formatted script)
 *   }],
 *   model: string,
 *   stop_reason: 'end_turn' | 'max_tokens',
 *   usage: {
 *     input_tokens: number,
 *     output_tokens: number
 *   }
 * }
 * ERROR RESPONSES:
 *   400: { type: 'invalid_request_error', message: 'Invalid request format' }
 *   401: { type: 'authentication_error', message: 'Invalid API key' }
 *   429: { type: 'rate_limit_error', message: 'Rate limit exceeded' }
 *   500: { type: 'api_error', message: 'Internal server error' }
 *   529: { type: 'overloaded_error', message: 'API is temporarily overloaded' }
 */
export async function generateDailyBriefScript(
  request: DailyBriefingRequest
): Promise<APIResponse<BriefingScript>> {
  const systemPrompt = `You are an expert podcast script writer for Hakivo, creating conversational daily legislative briefings.

Requirements:
- Duration: 7-9 minutes (1400-1800 words at 200 words/minute)
- Hosts: Sarah (enthusiastic, explains complex topics) and James (analytical, asks clarifying questions)
- Format: Natural dialogue between two hosts
- Sections:
  1. Intro (30 sec)
  2. Personalized News (3-4 min) - News articles related to user interests
  3. Tracked Bills Updates (3-4 min) - Status updates on bills user is following
  4. Outro (30 sec)

Style:
- Conversational and engaging, like NPR or The Daily
- Explain legislative jargon in plain language
- Sarah and James alternate speaking, creating natural flow
- Include moments of clarification, like "Can you explain what that means?"

Output Format:
Return a JSON object with this structure:
{
  "title": "Daily Legislative Briefing - [Date]",
  "dialogue": [
    { "speaker": "sarah", "text": "..." },
    { "speaker": "james", "text": "..." }
  ],
  "sections": [
    {
      "type": "intro",
      "dialogue": [...]
    },
    {
      "type": "news",
      "title": "Climate Policy News",
      "dialogue": [...]
    },
    {
      "type": "bills",
      "title": "Your Tracked Bills",
      "dialogue": [...]
    },
    {
      "type": "outro",
      "dialogue": [...]
    }
  ]
}`;

  const userPrompt = `Generate a daily briefing script for ${request.date}.

User Interests: ${request.userInterests.join(', ')}

Recent News:
${request.newsArticles
  .map(
    (article, i) =>
      `${i + 1}. ${article.title}
   Source: ${article.source}
   Summary: ${article.summary}
   URL: ${article.url}`
  )
  .join('\n\n')}

Tracked Bills Updates:
${request.trackedBills.length > 0 ? request.billUpdates.map((bill, i) => `${i + 1}. ${bill.title}
   Latest Action: ${bill.latestAction} (${bill.actionDate})
   ${bill.summary ? `Summary: ${bill.summary}` : ''}`).join('\n\n') : 'No bill updates today.'}

Create an engaging, informative 7-9 minute script.`;

  // API ENDPOINT: POST https://api.anthropic.com/v1/messages
  // HEADERS: {
  //   'x-api-key': process.env.ANTHROPIC_API_KEY,
  //   'anthropic-version': '2023-06-01',
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: {
  //   model: 'claude-sonnet-4-5-20250929',
  //   max_tokens: 8192,
  //   temperature: 0.7,
  //   system: systemPrompt,
  //   messages: [{
  //     role: 'user',
  //     content: userPrompt
  //   }]
  // }

  // Parse the Claude response JSON from content[0].text
  // Calculate wordCount and estimatedDuration from dialogue

  // TODO: Replace with actual API call
  return {
    success: true,
    data: MOCK_DAILY_SCRIPT,
  };
}

/**
 * Generate weekly briefing script (15-20 minutes)
 *
 * Creates a comprehensive weekly roundup of enacted laws and
 * presidential actions.
 *
 * @param request - Weekly briefing parameters
 * @returns Generated script with dialogue
 *
 * API ENDPOINT: POST https://api.anthropic.com/v1/messages
 * Same endpoint as daily briefing, different prompt and target duration.
 * HEADERS: Same as daily briefing
 * REQUEST BODY: {
 *   model: 'claude-sonnet-4-5-20250929',
 *   max_tokens: 16384, // More tokens for longer script
 *   temperature: 0.7,
 *   system: "You are a podcast script writer...",
 *   messages: [{
 *     role: 'user',
 *     content: "Generate a 15-20 minute weekly podcast script..."
 *   }]
 * }
 * SUCCESS RESPONSE: Same structure as daily briefing
 * ERROR RESPONSES: Same as daily briefing
 */
export async function generateWeeklyBriefScript(
  request: WeeklyBriefingRequest
): Promise<APIResponse<BriefingScript>> {
  const systemPrompt = `You are an expert podcast script writer for Hakivo, creating weekly legislative roundup briefings.

Requirements:
- Duration: 15-20 minutes (3000-4000 words at 200 words/minute)
- Hosts: Sarah and James (same personalities as daily briefing)
- Format: Natural dialogue
- Sections:
  1. Intro (1 min)
  2. Laws Enacted This Week (5-7 min)
  3. Presidential Actions (3-5 min)
  4. Major Votes & Highlights (5-7 min)
  5. Week Ahead Preview (1-2 min)
  6. Outro (1 min)

Style: Same conversational style as daily briefing but more analytical.

Output Format: Same JSON structure as daily briefing.`;

  const userPrompt = `Generate a weekly roundup for the week of ${request.weekOf}.

Laws Enacted:
${request.enactedLaws
  .map(
    (law, i) =>
      `${i + 1}. ${law.publicLawNumber}: ${law.title}
   Enacted: ${law.enactedDate}
   Summary: ${law.summary}`
  )
  .join('\n\n')}

Presidential Actions:
${request.presidentialActions
  .map(
    (action, i) =>
      `${i + 1}. ${action.type}: ${action.title}
   Date: ${action.date}
   Summary: ${action.summary}`
  )
  .join('\n\n')}

Major Votes:
${request.majorVotes
  .map(
    (vote, i) =>
      `${i + 1}. ${vote.billTitle} (${vote.chamber})
   Result: ${vote.result}
   Date: ${vote.date}
   Significance: ${vote.significance}`
  )
  .join('\n\n')}

Create an engaging, informative 15-20 minute weekly roundup.`;

  // API ENDPOINT: Same as daily, but max_tokens: 16384 for longer output
  // TODO: Replace with actual API call

  return {
    success: true,
    data: {
      type: BriefingType.WEEKLY,
      title: `Weekly Legislative Roundup - Week of ${request.weekOf}`,
      date: request.weekOf,
      estimatedDuration: 1020, // 17 minutes
      wordCount: 3400,
      dialogue: [
        { speaker: Speaker.SARAH, text: "Hi everyone! Welcome to your Hakivo weekly roundup." },
        { speaker: Speaker.JAMES, text: "This week in Congress was eventful. Let's dive in." },
      ],
      sections: [],
    },
  };
}

/**
 * Helper: Calculate estimated duration from word count
 * Average speaking rate: 200 words per minute
 */
export function calculateDuration(wordCount: number): number {
  return Math.round((wordCount / 200) * 60); // seconds
}

/**
 * Helper: Count words in script
 */
export function countWords(dialogue: DialogueLine[]): number {
  return dialogue.reduce((sum, line) => sum + line.text.split(/\s+/).length, 0);
}
