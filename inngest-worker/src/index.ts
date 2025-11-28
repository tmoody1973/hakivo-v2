import { Inngest } from 'inngest';
import { serve } from 'inngest/cloudflare';

// Environment interface
interface Env {
  INNGEST_EVENT_KEY: string;
  INNGEST_SIGNING_KEY: string;
  GEMINI_API_KEY: string;
  VULTR_ENDPOINT: string;
  VULTR_ACCESS_KEY: string;
  VULTR_SECRET_KEY: string;
  VULTR_BUCKET_NAME: string;
  HAKIVO_DB_ADMIN_URL: string;
}

// Global env reference - set on each request for Inngest function access
let currentEnv: Env | null = null;

// Create Inngest client
const inngest = new Inngest({ id: 'hakivo' });

/**
 * Gemini TTS voice pairs for brief audio generation
 * Uses Gemini's prebuilt voices (30 voices available)
 */
const VOICE_PAIRS = [
  { hostA: 'Kore', hostB: 'Puck', names: 'Arabella & Mark' },
  { hostA: 'Aoede', hostB: 'Charon', names: 'Susan & Jon' },
  { hostA: 'Kore', hostB: 'Fenrir', names: 'Arabella & Chris' },
  { hostA: 'Aoede', hostB: 'Puck', names: 'Susan & Mark' },
  { hostA: 'Kore', hostB: 'Charon', names: 'Arabella & Jon' },
  { hostA: 'Aoede', hostB: 'Fenrir', names: 'Susan & Chris' },
];

/**
 * Gemini TTS API endpoint
 */
const GEMINI_TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent';

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
      // Keep other lines as-is
      convertedLines.push(trimmed);
    }
  }

  return convertedLines.join('\n');
}

/**
 * Upload audio to Vultr S3-compatible storage
 * Uses the Raindrop vultr-storage-client service for proper S3 signing
 */
async function uploadToVultr(
  audioBuffer: Uint8Array,
  briefId: string,
  env: Env
): Promise<string> {
  const key = `briefs/${briefId}/audio.wav`;
  const endpoint = env.VULTR_ENDPOINT;
  const bucket = env.VULTR_BUCKET_NAME;

  // Simple unsigned PUT (bucket should allow public writes for this path)
  // For production with private buckets, implement AWS Signature V4
  const url = `${endpoint}/${bucket}/${key}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'audio/wav',
      'x-amz-acl': 'public-read',
    },
    body: audioBuffer.buffer as ArrayBuffer,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Vultr upload failed: ${response.status} - ${errorText}`);
  }

  return `${endpoint}/${bucket}/${key}`;
}

/**
 * Update brief status in database via Raindrop db-admin
 */
async function updateBriefStatus(
  briefId: string,
  status: string,
  audioUrl: string | null,
  env: Env
): Promise<void> {
  const timestamp = Date.now();
  const query = audioUrl
    ? `UPDATE briefs SET status = '${status}', audio_url = '${audioUrl}', updated_at = ${timestamp} WHERE id = '${briefId}'`
    : `UPDATE briefs SET status = '${status}', updated_at = ${timestamp} WHERE id = '${briefId}'`;

  const response = await fetch(`${env.HAKIVO_DB_ADMIN_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[INNGEST] Failed to update brief status: ${response.status}`);
  }
}

/**
 * Main audio generation function with step-based durable execution
 * Uses Google Gemini TTS with native multi-speaker dialogue support
 * No chunking needed - Gemini has 32k token context window
 */
const generateBriefAudio = inngest.createFunction(
  {
    id: 'generate-brief-audio',
    retries: 3,
  },
  { event: 'brief/audio.generate' },
  async ({ event, step }) => {
    const { briefId, script } = event.data;

    // Get env from global reference (set by the worker on each request)
    const env = currentEnv;
    if (!env) {
      throw new Error('Environment not available - currentEnv is null');
    }

    console.log(`[INNGEST] Starting Gemini TTS audio generation for brief ${briefId}`);
    console.log(`[INNGEST] Script length: ${script.length} characters`);

    // Step 1: Update status to generating
    await step.run('update-status-generating', async () => {
      await updateBriefStatus(briefId, 'generating', null, env);
      return { status: 'generating' };
    });

    // Step 2: Select voice pair and convert script
    const voicePair = selectVoicePair(briefId);
    console.log(`[INNGEST] Using voices: ${voicePair.names} (${voicePair.hostA} & ${voicePair.hostB})`);

    // Step 3: Generate audio with Gemini TTS (single call - no chunking needed!)
    const audioBase64 = await step.run('generate-audio-gemini', async () => {
      const dialoguePrompt = convertToDialoguePrompt(script, voicePair.hostA, voicePair.hostB);

      console.log(`[INNGEST] Calling Gemini TTS API...`);
      const response = await fetch(`${GEMINI_TTS_ENDPOINT}?key=${env.GEMINI_API_KEY}`, {
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

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Gemini TTS error ${response.status}: ${errorText}`);
      }

      const result = await response.json() as {
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

      const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;
      if (!audioData) {
        throw new Error('No audio data in Gemini response');
      }

      console.log(`[INNGEST] Gemini TTS returned ${audioData.mimeType} audio`);
      return audioData.data; // Already base64 encoded
    });

    // Step 4: Upload to Vultr storage
    const audioUrl = await step.run('upload-to-vultr', async () => {
      // Convert base64 to Uint8Array using Buffer (Node.js compatible)
      const audioBuffer = new Uint8Array(Buffer.from(audioBase64, 'base64'));
      console.log(`[INNGEST] Audio size: ${audioBuffer.length} bytes`);
      return await uploadToVultr(audioBuffer, briefId, env);
    });

    // Step 5: Update database with completed status
    await step.run('update-status-complete', async () => {
      await updateBriefStatus(briefId, 'completed', audioUrl, env);
      return { status: 'completed', audioUrl };
    });

    console.log(`[INNGEST] Audio generation complete for brief ${briefId}`);

    return {
      briefId,
      audioUrl,
      voicePair: voicePair.names,
      success: true,
    };
  }
);

// Simple test function
const testFunction = inngest.createFunction(
  { id: 'test-function' },
  { event: 'test/hello' },
  async ({ event, step }) => {
    const result = await step.run('say-hello', async () => {
      return { message: `Hello ${event.data.name}!` };
    });
    return result;
  }
);

// Cloudflare Workers handler
const handler = serve({
  client: inngest,
  functions: [testFunction, generateBriefAudio],
});

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Set global env reference for Inngest functions
    currentEnv = env;

    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'hakivo-inngest' }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Inngest handler for /api/inngest
    if (url.pathname === '/api/inngest' || url.pathname.startsWith('/api/inngest')) {
      // Cast handler to accept Workers format (request, env) - Inngest cloudflare supports both formats
      const workerHandler = handler as unknown as (req: Request, env: Record<string, string | undefined>) => Promise<Response>;
      return workerHandler(request, env as unknown as Record<string, string | undefined>);
    }

    return new Response('Not Found', { status: 404 });
  },
};
