import type { Context } from "@netlify/functions";

/**
 * Netlify Background Function for Gemini TTS Audio Generation
 *
 * This function runs asynchronously with a 15-minute timeout,
 * perfect for generating audio from brief scripts using Google Gemini TTS.
 *
 * Triggered by POST request with briefId and script in body.
 * Immediately returns 202 and processes audio in background.
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
    console.error(`[AUDIO-BG] Failed to update brief status: ${response.status}`);
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

export default async (req: Request, context: Context) => {
  console.log('[AUDIO-BG] Background function started');
  console.log('[AUDIO-BG] Request method:', req.method);
  console.log('[AUDIO-BG] Content-Type:', req.headers.get('content-type'));

  try {
    // Read the body as text first for debugging
    const bodyText = await req.text();
    console.log('[AUDIO-BG] Body length:', bodyText.length);
    console.log('[AUDIO-BG] Body preview:', bodyText.substring(0, 200));

    if (!bodyText || bodyText.length === 0) {
      console.error('[AUDIO-BG] Empty request body received');
      return;
    }

    const body = JSON.parse(bodyText) as { briefId: string; script: string };
    const { briefId, script } = body;

    if (!briefId || !script) {
      console.error('[AUDIO-BG] Missing briefId or script');
      return; // Background functions don't return responses
    }

    console.log(`[AUDIO-BG] Processing brief: ${briefId}`);
    console.log(`[AUDIO-BG] Script length: ${script.length} characters`);

    // Get Gemini API key from environment
    const geminiApiKey = Netlify.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('[AUDIO-BG] GEMINI_API_KEY not configured');
      await updateBriefStatus(briefId, 'audio_failed', null);
      return;
    }

    // Update status to generating
    await updateBriefStatus(briefId, 'generating', null);

    // Select voice pair
    const voicePair = selectVoicePair(briefId);
    console.log(`[AUDIO-BG] Using voices: ${voicePair.names}`);

    // Convert script to dialogue format
    const dialoguePrompt = convertToDialoguePrompt(script, voicePair.hostA, voicePair.hostB);

    // Call Gemini TTS API
    console.log('[AUDIO-BG] Calling Gemini TTS API...');
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
      console.error(`[AUDIO-BG] Gemini TTS error ${ttsResponse.status}: ${errorText}`);
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
      console.error('[AUDIO-BG] No audio data in Gemini response');
      await updateBriefStatus(briefId, 'audio_failed', null);
      return;
    }

    console.log(`[AUDIO-BG] Gemini TTS returned ${audioData.mimeType} audio`);

    // Convert base64 to buffer
    const audioBuffer = Uint8Array.from(atob(audioData.data), c => c.charCodeAt(0));
    console.log(`[AUDIO-BG] Audio size: ${audioBuffer.length} bytes`);

    // Upload to Vultr storage
    console.log('[AUDIO-BG] Uploading to Vultr storage...');
    const audioUrl = await uploadAudio(briefId, audioBuffer, audioData.mimeType || 'audio/wav');
    console.log(`[AUDIO-BG] Uploaded to: ${audioUrl}`);

    // Update brief with completed status and audio URL
    await updateBriefStatus(briefId, 'completed', audioUrl);

    console.log(`[AUDIO-BG] Successfully processed brief ${briefId}`);

  } catch (error) {
    console.error('[AUDIO-BG] Background function error:', error);
    // Try to update status if we have the briefId
    try {
      const body = await req.clone().json() as { briefId?: string };
      if (body.briefId) {
        await updateBriefStatus(body.briefId, 'audio_failed', null);
      }
    } catch {
      // Ignore parse errors
    }
  }
};

export const config = {
  path: "/api/generate-audio-background"
};
