import type { Context } from "@netlify/functions";

/**
 * Netlify Function for Gemini TTS Audio Generation
 *
 * Uses context.waitUntil() to process audio asynchronously while
 * immediately returning 202 to the caller.
 *
 * This approach allows access to the request body before returning,
 * unlike the -background suffix naming convention which has a known
 * issue where POST bodies are empty.
 */

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

// Raindrop db-admin URL for database updates
const DB_ADMIN_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

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
 * Update brief status in database via Raindrop db-admin
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
 * Upload audio to Vultr S3-compatible storage via Raindrop vultr-storage-client
 */
async function uploadAudio(
  briefId: string,
  audioBuffer: Uint8Array,
  mimeType: string
): Promise<string> {
  // Use the Raindrop vultr-storage-client service endpoint
  const VULTR_SERVICE_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1e.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

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
 * Process audio generation asynchronously
 */
async function processAudioGeneration(briefId: string, script: string): Promise<void> {
  console.log(`[AUDIO] Starting audio generation for brief: ${briefId}`);
  console.log(`[AUDIO] Script length: ${script.length} characters`);

  try {
    // Get Gemini API key from environment
    const geminiApiKey = Netlify.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('[AUDIO] GEMINI_API_KEY not configured');
      await updateBriefStatus(briefId, 'audio_failed', null);
      return;
    }

    // Select voice pair
    const voicePair = selectVoicePair(briefId);
    console.log(`[AUDIO] Using voices: ${voicePair.names}`);

    // Convert script to dialogue format
    const dialoguePrompt = convertToDialoguePrompt(script, voicePair.hostA, voicePair.hostB);

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
      await updateBriefStatus(briefId, 'audio_failed', null);
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
      await updateBriefStatus(briefId, 'audio_failed', null);
      return;
    }

    console.log(`[AUDIO] Gemini TTS returned ${audioData.mimeType} audio`);

    // Convert base64 to buffer
    const audioBuffer = Uint8Array.from(atob(audioData.data), c => c.charCodeAt(0));
    console.log(`[AUDIO] Audio size: ${audioBuffer.length} bytes`);

    // Upload to Vultr storage
    console.log('[AUDIO] Uploading to Vultr storage...');
    const audioUrl = await uploadAudio(briefId, audioBuffer, audioData.mimeType || 'audio/wav');
    console.log(`[AUDIO] Uploaded to: ${audioUrl}`);

    // Update brief with completed status and audio URL
    await updateBriefStatus(briefId, 'completed', audioUrl);

    console.log(`[AUDIO] Successfully processed brief ${briefId}`);

  } catch (error) {
    console.error('[AUDIO] Audio generation error:', error);
    await updateBriefStatus(briefId, 'audio_failed', null);
  }
}

export default async (req: Request, context: Context) => {
  console.log('[AUDIO] Function invoked');
  console.log('[AUDIO] Request method:', req.method);
  console.log('[AUDIO] Content-Type:', req.headers.get('content-type'));

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    // Parse body BEFORE returning - this is the key difference from -background naming
    const bodyText = await req.text();
    console.log('[AUDIO] Body length:', bodyText.length);

    if (!bodyText || bodyText.length === 0) {
      console.error('[AUDIO] Empty request body');
      return new Response(JSON.stringify({ error: 'Empty request body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    const body = JSON.parse(bodyText) as { briefId: string; script: string };
    const { briefId, script } = body;

    if (!briefId || !script) {
      console.error('[AUDIO] Missing briefId or script');
      return new Response(JSON.stringify({ error: 'Missing briefId or script' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    console.log(`[AUDIO] Accepted request for brief: ${briefId}`);
    console.log(`[AUDIO] Script preview: ${script.substring(0, 100)}...`);

    // Use context.waitUntil to process asynchronously
    // This allows the function to return immediately while processing continues
    context.waitUntil(processAudioGeneration(briefId, script));

    // Return 202 Accepted immediately
    return new Response(JSON.stringify({
      status: 'accepted',
      briefId,
      message: 'Audio generation started'
    }), {
      status: 202,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('[AUDIO] Request parsing error:', error);
    return new Response(JSON.stringify({
      error: 'Invalid request',
      details: error instanceof Error ? error.message : String(error)
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }
};

export const config = {
  path: "/api/generate-audio-background"
};
