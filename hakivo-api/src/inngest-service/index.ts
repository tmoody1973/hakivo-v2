import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Inngest } from 'inngest';
import { serve } from 'inngest/cloudflare';
import { Env } from './raindrop.gen';

// Create Inngest client
const inngest = new Inngest({ id: 'hakivo' });

// Simple test function first
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

// Audio generation function - simplified for edge runtime
const generateBriefAudio = inngest.createFunction(
  {
    id: 'generate-brief-audio',
    retries: 3,
  },
  { event: 'brief/audio.generate' },
  async ({ event, step }) => {
    const { briefId, script, voicePair, elevenLabsApiKey } = event.data;

    console.log(`🎧 [INNGEST] Starting audio generation for brief ${briefId}`);

    // Step 1: Parse and chunk the script
    const chunks = await step.run('parse-script', async () => {
      return parseAndChunkScript(script, voicePair.hostA, voicePair.hostB);
    });

    console.log(`📦 [INNGEST] Split into ${chunks.length} chunks`);

    // Step 2-N: Generate each chunk separately (store sizes for tracking)
    const chunkSizes: number[] = [];

    for (let i = 0; i < chunks.length; i++) {
      const chunkSize = await step.run(`generate-chunk-${i}`, async () => {
        console.log(`🎤 Generating chunk ${i + 1}/${chunks.length}`);

        const response = await fetch('https://api.elevenlabs.io/v1/text-to-dialogue', {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            inputs: chunks[i],
            model_id: 'eleven_v3'
          })
        });

        if (!response.ok) {
          throw new Error(`ElevenLabs error: ${response.status}`);
        }

        const buffer = await response.arrayBuffer();
        // Return size for tracking (actual audio processing would happen differently)
        return buffer.byteLength;
      });

      chunkSizes.push(chunkSize);
    }

    // Step N+1: Return summary
    const result = await step.run('finalize', async () => {
      const totalSize = chunkSizes.reduce((sum, size) => sum + size, 0);
      return {
        briefId,
        chunks: chunks.length,
        totalSize,
        success: true
      };
    });

    return result;
  }
);

/**
 * Parse script into chunks for ElevenLabs API
 */
function parseAndChunkScript(
  script: string,
  voiceIdA: string,
  voiceIdB: string
): Array<Array<{ text: string; voice_id: string }>> {
  const CHARACTER_LIMIT = 4500;
  const chunks: Array<Array<{ text: string; voice_id: string }>> = [];
  let currentChunk: Array<{ text: string; voice_id: string }> = [];
  let currentLength = 0;

  const lines = script.split('\n');

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    let input: { text: string; voice_id: string } | null = null;

    if (trimmed.startsWith('HOST A:')) {
      input = { text: trimmed.substring(7).trim(), voice_id: voiceIdA };
    } else if (trimmed.startsWith('HOST B:')) {
      input = { text: trimmed.substring(7).trim(), voice_id: voiceIdB };
    }

    if (input) {
      if (currentLength + input.text.length > CHARACTER_LIMIT && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentLength = 0;
      }
      currentChunk.push(input);
      currentLength += input.text.length;
    }
  }

  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }

  return chunks;
}

// Create Hono app
const app = new Hono<{ Bindings: Env }>();

app.use('*', cors());

// Health check
app.get('/health', (c) => {
  return c.json({ status: 'ok', service: 'inngest-service' });
});

// Inngest webhook handler - adapted for Cloudflare Workers via Hono
app.on(['GET', 'PUT', 'POST'], '/api/inngest', async (c) => {
  const handler = serve({
    client: inngest,
    functions: [testFunction, generateBriefAudio],
  });
  // Use Workers format: (request, env) - cast through unknown due to complex Either<> union type
  const workerHandler = handler as unknown as (req: Request, env: Record<string, string | undefined>) => Promise<Response>;
  return workerHandler(c.req.raw, c.env as unknown as Record<string, string | undefined>);
});

export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    return app.fetch(request, this.env);
  }
}
