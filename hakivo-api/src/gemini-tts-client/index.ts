import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Voice configurations for Gemini TTS multi-speaker
 * These are Gemini's prebuilt voices with distinct characteristics
 */
const VOICE_CONFIGS = {
  // Female voices
  kore: 'Kore',       // Warm, professional female
  aoede: 'Aoede',     // Expressive female
  leda: 'Leda',       // Calm female
  zephyr: 'Zephyr',   // Energetic female

  // Male voices
  puck: 'Puck',       // Engaging male
  charon: 'Charon',   // Deep male
  fenrir: 'Fenrir',   // Strong male
  orus: 'Orus',       // Warm male
};

/**
 * Default voice pairs for briefs (matching existing ElevenLabs pairs)
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
 * Gemini TTS API endpoint - Using Pro model for better emotional expression
 */
const GEMINI_TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-preview-tts:generateContent';

interface SynthesizeRequest {
  script: string;
  voiceA?: string;  // Gemini voice name (default: Kore)
  voiceB?: string;  // Gemini voice name (default: Puck)
}

interface SynthesizeResponse {
  success: boolean;
  audioBuffer?: string;  // Base64 encoded PCM audio
  mimeType?: string;
  characterCount?: number;
  error?: string;
}

/**
 * Gemini TTS Client Service
 *
 * Provides text-to-speech synthesis using Google's Gemini TTS API
 * with native multi-speaker dialogue support.
 *
 * Features:
 * - Multi-speaker dialogue (no chunking needed)
 * - 32k token context window
 * - ~$0.00125 per 1k tokens (much cheaper than ElevenLabs)
 * - PCM audio output (24kHz, mono, 16-bit)
 */
export default class extends Service<Env> {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (request.method === 'POST' && path === '/synthesize') {
      return this.handleSynthesize(request);
    }

    if (request.method === 'GET' && path === '/voices') {
      return this.handleGetVoices();
    }

    if (request.method === 'GET' && path === '/health') {
      return new Response(JSON.stringify({ status: 'ok', service: 'gemini-tts-client' }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response('Not Found', { status: 404 });
  }

  /**
   * Synthesize dialogue script to audio
   */
  async synthesize(script: string, voiceA: string = 'Kore', voiceB: string = 'Puck'): Promise<SynthesizeResponse> {
    if (!script) {
      return { success: false, error: 'Script is required' };
    }

    console.log(`[GEMINI-TTS] Synthesizing dialogue with voices: ${voiceA} & ${voiceB}`);

    // Convert HOST A/HOST B format to named speakers for Gemini
    const dialoguePrompt = this.convertToDialoguePrompt(script, voiceA, voiceB);
    const characterCount = script.length;

    console.log(`[GEMINI-TTS] Script length: ${characterCount} characters`);

    try {
      // Call Gemini TTS API
      const response = await fetch(`${GEMINI_TTS_ENDPOINT}?key=${this.env.GEMINI_API_KEY}`, {
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
                    speaker: voiceA,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voiceA }
                    }
                  },
                  {
                    speaker: voiceB,
                    voiceConfig: {
                      prebuiltVoiceConfig: { voiceName: voiceB }
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
        console.error(`[GEMINI-TTS] API error ${response.status}:`, errorText);
        return {
          success: false,
          error: `Gemini API error ${response.status}: ${errorText}`
        };
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

      // Extract audio data from response
      const audioData = result.candidates?.[0]?.content?.parts?.[0]?.inlineData;

      if (!audioData) {
        console.error('[GEMINI-TTS] No audio data in response:', JSON.stringify(result));
        return {
          success: false,
          error: 'No audio data in Gemini response'
        };
      }

      console.log(`[GEMINI-TTS] Successfully generated audio, mime: ${audioData.mimeType}`);

      return {
        success: true,
        audioBuffer: audioData.data,
        mimeType: audioData.mimeType,
        characterCount
      };

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[GEMINI-TTS] Synthesis failed:', errorMessage);
      return {
        success: false,
        error: errorMessage
      };
    }
  }

  /**
   * Handle HTTP synthesis request
   */
  private async handleSynthesize(request: Request): Promise<Response> {
    try {
      const body = await request.json() as SynthesizeRequest;
      const result = await this.synthesize(body.script, body.voiceA, body.voiceB);

      return new Response(JSON.stringify(result), {
        status: result.success ? 200 : 500,
        headers: { 'Content-Type': 'application/json' }
      });

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      return new Response(JSON.stringify({
        success: false,
        error: errorMessage
      }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      });
    }
  }

  /**
   * Get available voice configurations
   */
  private handleGetVoices(): Response {
    return new Response(JSON.stringify({
      voices: VOICE_CONFIGS,
      pairs: VOICE_PAIRS
    }), {
      headers: { 'Content-Type': 'application/json' }
    });
  }

  /**
   * Convert HOST A/HOST B script format to Gemini's named speaker format
   * with emotional cues converted to natural language prompts
   *
   * Input:
   *   HOST A: [warmly] Welcome to today's brief!
   *   HOST B: [excitedly] Thanks for joining us.
   *
   * Output:
   *   Kore (speaking warmly): Welcome to today's brief!
   *   Puck (speaking excitedly): Thanks for joining us.
   *
   * Gemini TTS uses natural language descriptions for emotional delivery,
   * not special markup. This enhances voice expressiveness.
   */
  private convertToDialoguePrompt(script: string, voiceA: string, voiceB: string): string {
    const lines = script.split('\n');
    const convertedLines: string[] = [];

    // Regex to extract emotional cue from [brackets]
    const emotionRegex = /^\[([^\]]+)\]\s*/;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('HOST A:')) {
        const dialogue = trimmed.substring(7).trim();
        const emotionMatch = dialogue.match(emotionRegex);

        if (emotionMatch) {
          const emotion = emotionMatch[1];
          const text = dialogue.replace(emotionRegex, '');
          // Use natural language emotional instruction for Gemini
          convertedLines.push(`${voiceA} (speaking ${emotion}): ${text}`);
        } else {
          convertedLines.push(`${voiceA}: ${dialogue}`);
        }
      } else if (trimmed.startsWith('HOST B:')) {
        const dialogue = trimmed.substring(7).trim();
        const emotionMatch = dialogue.match(emotionRegex);

        if (emotionMatch) {
          const emotion = emotionMatch[1];
          const text = dialogue.replace(emotionRegex, '');
          // Use natural language emotional instruction for Gemini
          convertedLines.push(`${voiceB} (speaking ${emotion}): ${text}`);
        } else {
          convertedLines.push(`${voiceB}: ${dialogue}`);
        }
      } else {
        // Skip stage directions and other non-dialogue lines
        // (They shouldn't be spoken)
        continue;
      }
    }

    return convertedLines.join('\n');
  }

  /**
   * Select a voice pair based on brief ID for consistent rotation
   */
  static selectVoicePair(briefId: string): typeof VOICE_PAIRS[0] {
    let hash = 0;
    for (let i = 0; i < briefId.length; i++) {
      hash = ((hash << 5) - hash) + briefId.charCodeAt(i);
      hash = hash & hash;
    }
    const index = Math.abs(hash) % VOICE_PAIRS.length;
    return VOICE_PAIRS[index]!;
  }
}

// Export types and constants for use by other services
export { VOICE_CONFIGS, VOICE_PAIRS };
export type { SynthesizeRequest, SynthesizeResponse };
