import { Service } from '@liquidmetal-ai/raindrop-framework';
import { Env } from './raindrop.gen';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';

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

    // Parse dialogue script into turns for text-to-dialogue API
    const turns = this.parseDialogueScript(script);

    if (turns.length === 0) {
      throw new Error('No dialogue turns found in script');
    }

    console.log(`✓ Parsed ${turns.length} dialogue turns`);

    try {
      // Build input array for text-to-dialogue API (camelCase per SDK)
      const inputs = turns.map(turn => ({
        text: turn.text,
        voiceId: turn.speaker === 'A' ? voiceIdA : voiceIdB
      }));

      // Use text-to-dialogue API
      const audioStream = await client.textToDialogue.convert({
        inputs
      });

      // Convert Web ReadableStream to Uint8Array
      const reader = audioStream.getReader();
      const chunks: Uint8Array[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (value) {
          chunks.push(value);
        }
      }

      // Combine chunks into single buffer
      const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
      const audioBuffer = new Uint8Array(totalLength);
      let offset = 0;
      for (const chunk of chunks) {
        audioBuffer.set(chunk, offset);
        offset += chunk.length;
      }

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
      const subscription: any = await client.user.subscription;

      const characterCount = subscription.characterCount || 0;
      const characterLimit = subscription.characterLimit || 0;
      const remainingCharacters = characterLimit - characterCount;

      return {
        characterCount,
        characterLimit,
        remainingCharacters,
        canResetVoiceAdd: subscription.canUseInstantVoiceCloning || false
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
