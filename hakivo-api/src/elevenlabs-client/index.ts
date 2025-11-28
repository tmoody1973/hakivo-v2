import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';

/**
 * Voice settings for ElevenLabs text-to-dialogue
 */
export interface VoiceSettings {
  stability?: number;        // 0-1, default 0.5
  similarity_boost?: number; // 0-1, default 0.75
  style?: number;            // 0-1, default 0
  use_speaker_boost?: boolean;
}

/**
 * Dialogue turn for text-to-dialogue API
 */
interface DialogueTurn {
  speaker: 'A' | 'B';
  text: string;
}

/**
 * Input for text-to-dialogue API
 */
interface DialogueInput {
  text: string;
  voice_id: string;
}

/**
 * ElevenLabs Client Service (REST API)
 *
 * Uses direct REST API calls instead of the SDK to avoid Node.js dependencies
 * that aren't compatible with edge runtime (child_process, stream, events).
 *
 * Features:
 * - Uses eleven_v3 model for high-quality dialogue synthesis
 * - Automatic chunking for long dialogues (4500 char limit per chunk)
 * - Emotional cues support via bracketed tags [cheerfully], [thoughtfully], etc.
 */
export default class extends Service<Env> {
  private readonly BASE_URL = 'https://api.elevenlabs.io';
  private readonly CHARACTER_LIMIT = 4500; // Safety buffer below 5000 API limit
  private readonly MODEL_ID = 'eleven_v3';
  private readonly FETCH_TIMEOUT_MS = 4 * 60 * 1000; // 4 minutes per chunk

  /**
   * Get API key from environment
   */
  private getApiKey(): string {
    const apiKey = this.env.ELEVENLABS_API_KEY;

    if (!apiKey) {
      throw new Error('ELEVENLABS_API_KEY environment variable is not set');
    }

    return apiKey;
  }

  /**
   * Convert podcast script to audio using text-to-dialogue with eleven_v3 model
   * Automatically chunks long dialogues and concatenates audio buffers
   *
   * Used by brief-generator observer
   *
   * @param script - Podcast script in dialogue format (HOST A: / HOST B:)
   * @param voiceIdA - Voice ID for Host A (default: Nicole - warm female)
   * @param voiceIdB - Voice ID for Host B (default: Adam - deep male)
   * @param voiceSettings - Optional voice settings for stability, similarity, style
   * @returns Audio buffer as Uint8Array and character count
   */
  async synthesizeDialogue(
    script: string,
    voiceIdA: string = 'Z3R5wn05IrDiVCyEkUrK', // Arabella - warm female host
    voiceIdB: string = '1SM7GgM6IMuvQlz2BwM3', // Mark - engaging male co-host
    voiceSettings?: VoiceSettings
  ): Promise<{
    audioBuffer: Uint8Array;
    characterCount: number;
    durationSeconds: number | null;
    chunksProcessed: number;
  }> {
    const apiKey = this.getApiKey();

    // Parse dialogue script into turns for text-to-dialogue API
    const turns = this.parseDialogueScript(script);

    if (turns.length === 0) {
      throw new Error('No dialogue turns found in script');
    }

    console.log(`✓ Parsed ${turns.length} dialogue turns`);

    // Calculate total character count
    const totalCharacters = turns.reduce((sum, turn) => sum + turn.text.length, 0);
    console.log(`✓ Total dialogue characters: ${totalCharacters}`);

    // Chunk dialogue if needed
    const chunks = this.chunkDialogue(turns, voiceIdA, voiceIdB);
    console.log(`✓ Split into ${chunks.length} chunk(s) for processing`);

    try {
      // Process each chunk and collect audio buffers
      const audioBuffers: Uint8Array[] = [];

      for (const [i, chunk] of chunks.entries()) {
        console.log(`  Processing chunk ${i + 1}/${chunks.length}...`);
        const chunkAudio = await this.synthesizeChunk(apiKey, chunk, voiceSettings);
        audioBuffers.push(chunkAudio);

        // Rate limiting: wait 1 second between chunks to avoid hitting API limits
        if (i < chunks.length - 1) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }

      // Concatenate all audio buffers
      const audioBuffer = this.concatenateAudioBuffers(audioBuffers);
      const characterCount = script.length;

      console.log(`✓ ElevenLabs audio synthesis complete: ${characterCount} characters, ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB, ${chunks.length} chunk(s)`);

      return {
        audioBuffer,
        characterCount,
        durationSeconds: null, // ElevenLabs doesn't provide duration in response
        chunksProcessed: chunks.length
      };
    } catch (error) {
      console.error('ElevenLabs synthesis error:', error);
      throw new Error(`ElevenLabs synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Synthesize a single chunk of dialogue
   * Uses AbortController with 4-minute timeout to handle long audio generation
   */
  private async synthesizeChunk(
    apiKey: string,
    inputs: DialogueInput[],
    voiceSettings?: VoiceSettings
  ): Promise<Uint8Array> {
    const requestBody: any = {
      inputs,
      model_id: this.MODEL_ID
    };

    // Add voice settings if provided
    if (voiceSettings) {
      requestBody.settings = {
        stability: voiceSettings.stability ?? 0.5,
        similarity_boost: voiceSettings.similarity_boost ?? 0.75,
        style: voiceSettings.style ?? 0,
        use_speaker_boost: voiceSettings.use_speaker_boost ?? true
      };
    }

    // Set up timeout with AbortController
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.FETCH_TIMEOUT_MS);

    try {
      const response = await fetch(`${this.BASE_URL}/v1/text-to-dialogue`, {
        method: 'POST',
        headers: {
          'xi-api-key': apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} ${errorText}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      return new Uint8Array(arrayBuffer);
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`ElevenLabs API timeout after ${this.FETCH_TIMEOUT_MS / 1000}s - audio generation took too long`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }

  /**
   * Chunk dialogue into smaller pieces that fit within API character limit
   * Preserves dialogue turn boundaries (never splits a turn)
   */
  private chunkDialogue(
    turns: DialogueTurn[],
    voiceIdA: string,
    voiceIdB: string
  ): DialogueInput[][] {
    const chunks: DialogueInput[][] = [];
    let currentChunk: DialogueInput[] = [];
    let currentLength = 0;

    for (const turn of turns) {
      const input: DialogueInput = {
        text: turn.text,
        voice_id: turn.speaker === 'A' ? voiceIdA : voiceIdB
      };

      // If adding this turn would exceed limit, start new chunk
      if (currentLength + turn.text.length > this.CHARACTER_LIMIT && currentChunk.length > 0) {
        chunks.push(currentChunk);
        currentChunk = [];
        currentLength = 0;
      }

      currentChunk.push(input);
      currentLength += turn.text.length;
    }

    // Don't forget the last chunk
    if (currentChunk.length > 0) {
      chunks.push(currentChunk);
    }

    return chunks;
  }

  /**
   * Concatenate multiple audio buffers into a single buffer
   * Note: This performs simple concatenation which works for MP3 format
   */
  private concatenateAudioBuffers(buffers: Uint8Array[]): Uint8Array {
    if (buffers.length === 0) {
      return new Uint8Array(0);
    }

    if (buffers.length === 1) {
      return buffers[0]!;
    }

    const totalLength = buffers.reduce((sum, buf) => sum + buf.length, 0);
    const result = new Uint8Array(totalLength);
    let offset = 0;

    for (const buffer of buffers) {
      result.set(buffer, offset);
      offset += buffer.length;
    }

    return result;
  }

  /**
   * Parse dialogue script into speaker turns
   * Format: "HOST A: text\nHOST B: text"
   * Supports emotional cues: "HOST A: [cheerfully] Hello everyone!"
   */
  private parseDialogueScript(script: string): DialogueTurn[] {
    const turns: DialogueTurn[] = [];
    const lines = script.split('\n');

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed.startsWith('HOST A:')) {
        turns.push({
          speaker: 'A',
          text: trimmed.substring(7).trim()
        });
      } else if (trimmed.startsWith('HOST B:')) {
        turns.push({
          speaker: 'B',
          text: trimmed.substring(7).trim()
        });
      }
    }

    return turns;
  }

  /**
   * Get current quota usage and limits
   * Useful for monitoring character consumption
   *
   * @returns Quota information
   */
  async getQuota(): Promise<{
    characterCount: number;
    characterLimit: number;
    remainingCharacters: number;
    canResetVoiceAdd: boolean;
  }> {
    const apiKey = this.getApiKey();

    try {
      const response = await fetch(`${this.BASE_URL}/v1/user/subscription`, {
        headers: {
          'xi-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const subscription: any = await response.json();

      const characterCount = subscription.character_count || 0;
      const characterLimit = subscription.character_limit || 0;
      const remainingCharacters = characterLimit - characterCount;

      return {
        characterCount,
        characterLimit,
        remainingCharacters,
        canResetVoiceAdd: subscription.can_use_instant_voice_cloning || false
      };
    } catch (error) {
      console.error('ElevenLabs quota check error:', error);
      throw new Error(`Failed to get quota: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * List available voices
   * Useful for discovering voice IDs
   *
   * @returns Array of voice objects
   */
  async listVoices(): Promise<Array<{
    voiceId: string;
    name: string;
    category: string;
    description: string | null;
  }>> {
    const apiKey = this.getApiKey();

    try {
      const response = await fetch(`${this.BASE_URL}/v1/voices`, {
        headers: {
          'xi-api-key': apiKey
        }
      });

      if (!response.ok) {
        throw new Error(`ElevenLabs API error: ${response.status}`);
      }

      const data: any = await response.json();

      return data.voices.map((voice: any) => ({
        voiceId: voice.voice_id,
        name: voice.name,
        category: voice.category || 'general',
        description: voice.description || null
      }));
    } catch (error) {
      console.error('ElevenLabs voices list error:', error);
      throw new Error(`Failed to list voices: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Required fetch method for Raindrop Service
   * This is a private service, so fetch returns 501 Not Implemented
   */
  async fetch(_request: Request): Promise<Response> {
    return new Response('Not Implemented - Private Service', { status: 501 });
  }
}
