import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { ElevenLabsClient } from 'elevenlabs';

export default class extends Service<Env> {
  private elevenlabs: ElevenLabsClient | null = null;

  /**
   * Initialize ElevenLabs client
   */
  private getElevenLabsClient(): ElevenLabsClient {
    if (!this.elevenlabs) {
      const apiKey = process.env.ELEVENLABS_API_KEY;

      if (!apiKey) {
        throw new Error('ELEVENLABS_API_KEY environment variable is not set');
      }

      this.elevenlabs = new ElevenLabsClient({
        apiKey
      });
    }

    return this.elevenlabs;
  }

  /**
   * Convert podcast script to audio using text-to-dialogue
   * Used by brief-generator observer
   *
   * @param script - Podcast script in dialogue format (HOST A: / HOST B:)
   * @param voiceIdA - Voice ID for Host A (default: Nicole - warm female)
   * @param voiceIdB - Voice ID for Host B (default: Adam - deep male)
   * @returns Audio buffer as Uint8Array and character count
   */
  async synthesizeDialogue(
    script: string,
    voiceIdA: string = 'piTKgcLEGmPE4e6mEKli', // Nicole
    voiceIdB: string = 'pNInz6obpgDQGcFmaJgB'  // Adam
  ): Promise<{
    audioBuffer: Uint8Array;
    characterCount: number;
    durationSeconds: number | null;
  }> {
    const client = this.getElevenLabsClient();

    // Parse dialogue script into turns
    const turns = this.parseDialogueScript(script);

    if (turns.length === 0) {
      throw new Error('No dialogue turns found in script');
    }

    console.log(`✓ Parsed ${turns.length} dialogue turns`);

    try {
      // Use text-to-speech with streaming
      const audioStream = await client.textToSpeech.convert(voiceIdA, {
        text: script,
        model_id: 'eleven_multilingual_v2',
        voice_settings: {
          stability: 0.5,
          similarity_boost: 0.75,
          style: 0.5,
          use_speaker_boost: true
        }
      });

      // Collect chunks from Node.js Readable stream
      const chunks: Buffer[] = [];

      // Wait for all data chunks
      await new Promise<void>((resolve, reject) => {
        audioStream.on('data', (chunk: Buffer) => {
          chunks.push(chunk);
        });

        audioStream.on('end', () => {
          resolve();
        });

        audioStream.on('error', (err: Error) => {
          reject(err);
        });
      });

      // Combine chunks into single buffer
      const combinedBuffer = Buffer.concat(chunks);
      const audioBuffer = new Uint8Array(combinedBuffer);

      const characterCount = script.length;

      console.log(`✓ ElevenLabs audio synthesis: ${characterCount} characters, ${(audioBuffer.length / 1024 / 1024).toFixed(2)} MB`);

      return {
        audioBuffer,
        characterCount,
        durationSeconds: null // ElevenLabs doesn't provide duration in response
      };
    } catch (error) {
      console.error('ElevenLabs synthesis error:', error);
      throw new Error(`ElevenLabs synthesis failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Parse dialogue script into speaker turns
   * Format: "HOST A: text\nHOST B: text"
   */
  private parseDialogueScript(script: string): Array<{
    speaker: 'A' | 'B';
    text: string;
  }> {
    const turns: Array<{ speaker: 'A' | 'B'; text: string }> = [];
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
    const client = this.getElevenLabsClient();

    try {
      const subscription = await client.user.getSubscription();

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
    const client = this.getElevenLabsClient();

    try {
      const response = await client.voices.getAll();

      return response.voices.map((voice: any) => ({
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
