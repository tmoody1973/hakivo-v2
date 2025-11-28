/**
 * Netlify Background Function for Audio Processing
 *
 * Polls database for briefs with status='script_ready' and processes
 * audio generation using Gemini TTS.
 *
 * Background functions get 15-minute timeout (vs 10s for regular functions).
 * This function polls the database instead of using POST body since
 * background functions have a known issue where POST bodies are empty.
 */
import type { Context } from "@netlify/functions";

// Gemini TTS voice pairs for brief audio generation
const VOICE_PAIRS = [
  { hostA: 'Kore', hostB: 'Puck', names: 'Arabella & Mark' },
  { hostA: 'Aoede', hostB: 'Charon', names: 'Susan & Jon' },
  { hostA: 'Kore', hostB: 'Fenrir', names: 'Arabella & Chris' },
  { hostA: 'Aoede', hostB: 'Puck', names: 'Susan & Mark' },
  { hostA: 'Kore', hostB: 'Charon', names: 'Arabella & Jon' },
  { hostA: 'Aoede', hostB: 'Fenrir', names: 'Susan & Chris' },
];

const GEMINI_TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

// Raindrop db-admin URL for database queries
const DB_ADMIN_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Vultr storage service URL
const VULTR_SERVICE_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1e.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

interface Brief {
  id: string;
  script: string;
  status: string;
}

/**
 * Select a voice pair based on brief ID for consistent rotation
 */
function selectVoicePair(briefId: string): typeof VOICE_PAIRS[0] {
  let hash = 0;
  for (let i = 0; i < briefId.length; i++) {
    hash = ((hash << 5) - hash) + briefId.charCodeAt(i);
    hash = hash & hash;
  }
  const index = Math.abs(hash) % VOICE_PAIRS.length;
  return VOICE_PAIRS[index]!;
}

/**
 * Convert HOST A/HOST B script format to Gemini's named speaker format
 */
function convertToDialoguePrompt(script: string, voiceA: string, voiceB: string): string {
  const lines = script.split('\n');
  const convertedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (trimmed.startsWith('HOST A:')) {
      convertedLines.push(`${voiceA}: ${trimmed.substring(7).trim()}`);
    } else if (trimmed.startsWith('HOST B:')) {
      convertedLines.push(`${voiceB}: ${trimmed.substring(7).trim()}`);
    } else {
      convertedLines.push(trimmed);
    }
  }

  return convertedLines.join('\n');
}

/**
 * Query database for briefs ready for audio processing
 */
async function getBriefsReadyForAudio(): Promise<Brief[]> {
  const query = `SELECT id, script, status FROM briefs WHERE status = 'script_ready' ORDER BY created_at ASC LIMIT 1`;

  const response = await fetch(`${DB_ADMIN_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[AUDIO] Failed to query briefs: ${response.status}`);
    return [];
  }

  const result = await response.json() as { results?: Brief[] };
  return result.results || [];
}

/**
 * Update brief status in database
 */
async function updateBriefStatus(
  briefId: string,
  status: string,
  audioUrl: string | null
): Promise<void> {
  const timestamp = Date.now();
  const query = audioUrl
    ? `UPDATE briefs SET status = '${status}', audio_url = '${audioUrl}', updated_at = ${timestamp} WHERE id = '${briefId}'`
    : `UPDATE briefs SET status = '${status}', updated_at = ${timestamp} WHERE id = '${briefId}'`;

  const response = await fetch(`${DB_ADMIN_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[AUDIO] Failed to update brief status: ${response.status}`);
  }
}

/**
 * Upload audio to Vultr S3-compatible storage
 */
async function uploadAudio(
  briefId: string,
  audioBuffer: Uint8Array,
  mimeType: string
): Promise<string> {
  // Convert Uint8Array to base64 for JSON transport
  const base64Audio = Buffer.from(audioBuffer).toString('base64');

  const response = await fetch(`${VULTR_SERVICE_URL}/upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      briefId,
      audioBase64: base64Audio,
      mimeType,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vultr upload failed: ${response.status} - ${errorText}`);
  }

  const result = await response.json() as { url: string };
  return result.url;
}

/**
 * Process a single brief's audio generation
 */
async function processBrief(brief: Brief, geminiApiKey: string): Promise<void> {
  console.log(`[AUDIO] Processing brief: ${brief.id}`);
  console.log(`[AUDIO] Script length: ${brief.script.length} characters`);

  // Mark as processing to prevent duplicate processing
  await updateBriefStatus(brief.id, 'audio_processing', null);

  try {
    // Select voice pair
    const voicePair = selectVoicePair(brief.id);
    console.log(`[AUDIO] Using voices: ${voicePair.names}`);

    // Convert script to dialogue format
    const dialoguePrompt = convertToDialoguePrompt(brief.script, voicePair.hostA, voicePair.hostB);

    // Call Gemini TTS API
    console.log('[AUDIO] Calling Gemini TTS API...');
    const ttsResponse = await fetch(`${GEMINI_TTS_ENDPOINT}?key=${geminiApiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: dialoguePrompt }]
        }],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            multiSpeakerVoiceConfig: {
              speakerVoiceConfigs: [
                {
                  speaker: voicePair.hostA,
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voicePair.hostA }
                  }
                },
                {
                  speaker: voicePair.hostB,
                  voiceConfig: {
                    prebuiltVoiceConfig: { voiceName: voicePair.hostB }
                  }
                }
              ]
            }
          }
        }
      })
    });

    if (!ttsResponse.ok) {
      const errorText = await ttsResponse.text();
      console.error(`[AUDIO] Gemini TTS error ${ttsResponse.status}: ${errorText}`);
      await updateBriefStatus(brief.id, 'audio_failed', null);
      return;
    }

    const ttsResult = await ttsResponse.json() as {
      candidates?: Array<{
        content?: {
          parts?: Array<{
            inlineData?: {
              mimeType: string;
              data: string;
            }
          }>
        }
      }>
    };

    // Extract audio data
    const audioData = ttsResult.candidates?.[0]?.content?.parts?.[0]?.inlineData;
    if (!audioData) {
      console.error('[AUDIO] No audio data in Gemini response');
      await updateBriefStatus(brief.id, 'audio_failed', null);
      return;
    }

    console.log(`[AUDIO] Gemini TTS returned ${audioData.mimeType} audio`);

    // Convert base64 to buffer
    const audioBuffer = Uint8Array.from(atob(audioData.data), c => c.charCodeAt(0));
    console.log(`[AUDIO] Audio size: ${audioBuffer.length} bytes`);

    // Upload to Vultr storage
    console.log('[AUDIO] Uploading to Vultr storage...');
    const audioUrl = await uploadAudio(brief.id, audioBuffer, audioData.mimeType || 'audio/wav');
    console.log(`[AUDIO] Uploaded to: ${audioUrl}`);

    // Update brief with completed status and audio URL
    await updateBriefStatus(brief.id, 'completed', audioUrl);

    console.log(`[AUDIO] Successfully processed brief ${brief.id}`);

  } catch (error) {
    console.error('[AUDIO] Audio generation error:', error);
    await updateBriefStatus(brief.id, 'audio_failed', null);
  }
}

/**
 * Background function handler - polls database for briefs to process
 *
 * This is a BACKGROUND FUNCTION (15 min timeout) that polls for briefs.
 * It must be triggered via HTTP call, but ignores the request body
 * (since background functions have empty POST bodies).
 */
export default async (_req: Request, _context: Context) => {
  console.log('[AUDIO] Background function triggered');

  // Get Gemini API key
  const geminiApiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('[AUDIO] GEMINI_API_KEY not configured');
    return; // Background functions return empty 202
  }

  // Query for briefs ready for audio
  const briefs = await getBriefsReadyForAudio();

  if (briefs.length === 0) {
    console.log('[AUDIO] No briefs ready for audio processing');
    return;
  }

  console.log(`[AUDIO] Found ${briefs.length} brief(s) ready for audio`);

  // Process one brief at a time
  for (const brief of briefs) {
    await processBrief(brief, geminiApiKey);
  }

  console.log('[AUDIO] Background function complete');
};

// No config needed - background functions use the -background filename suffix
