/**
 * ElevenLabs API Client
 *
 * Generates multi-speaker audio using the text-to-dialogue eleven_v3 model
 * for podcast-style briefings with Sarah and James voices.
 *
 * API Base URL: https://api.elevenlabs.io/v1
 * Documentation: https://elevenlabs.io/docs
 *
 * Rate Limits: Varies by plan, typically by characters/month
 */

import {
  DialogueTurn,
  TextToDialogueRequest,
  VoiceSettings,
  AudioFormat,
  GenerateDialogueAudioResponse,
  Voice,
  VoiceListResponse,
  UsageQuota,
} from '../api-specs/elevenlabs.types';
import { APIResponse } from '../api-specs/common.types';
import { BriefingScript, DialogueLine } from '../api-specs/claude.types';

// ============================================================================
// Mock Data
// ============================================================================

const MOCK_AUDIO_BASE64 = 'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4Ljc2LjEwMAAAAAAAAAAAAAAA//tQwAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAACAAABhgC7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7u7////////////////////////////////////////////////////////';

// ============================================================================
// Audio Generation Functions
// ============================================================================

/**
 * Generate dialogue audio from briefing script
 *
 * Converts a podcast script with Sarah and James into multi-speaker audio
 * using ElevenLabs text-to-dialogue model.
 *
 * @param script - Briefing script with dialogue
 * @param options - Audio generation options
 * @returns Base64 encoded audio file
 *
 * API ENDPOINT: POST https://api.elevenlabs.io/v1/text-to-dialogue
 * HEADERS: {
 *   'xi-api-key': process.env.ELEVENLABS_API_KEY,
 *   'Content-Type': 'application/json'
 * }
 * REQUEST BODY: {
 *   model_id: 'eleven_v3',
 *   dialogue: [{
 *     speaker: 'Sarah',
 *     text: 'Hello everyone!',
 *     voice_id: process.env.ELEVENLABS_VOICE_ID_SARAH
 *   }, {
 *     speaker: 'James',
 *     text: 'Welcome to the show!',
 *     voice_id: process.env.ELEVENLABS_VOICE_ID_JAMES
 *   }],
 *   output_format: 'mp3_44100_128',
 *   voice_settings: {
 *     stability: 0.5,
 *     similarity_boost: 0.75,
 *     style: 0.5,
 *     use_speaker_boost: true
 *   }
 * }
 * SUCCESS RESPONSE (200): {
 *   audio_base64: string (very long base64 string)
 * }
 * ERROR RESPONSES:
 *   400: { detail: 'Invalid request format' }
 *   401: { detail: 'Invalid API key' }
 *   422: { 
 *     detail: [{
 *       loc: ['body', 'dialogue', 0],
 *       msg: 'Invalid dialogue format',
 *       type: 'value_error'
 *     }]
 *   }
 *   429: { 
 *     detail: {
 *       message: 'Rate limit exceeded',
 *       quota_used: number,
 *       quota_limit: number
 *     }
 *   }
 *   500: { detail: 'Internal server error' }
 */
export async function generateDialogueAudio(
  script: BriefingScript,
  options: {
    format?: AudioFormat;
    voiceSettings?: VoiceSettings;
  } = {}
): Promise<GenerateDialogueAudioResponse> {
  const dialogue: DialogueTurn[] = script.dialogue.map((line) => ({
    speaker: line.speaker === 'sarah' ? 'Sarah' : 'James',
    text: line.text,
    voice_id:
      line.speaker === 'sarah'
        ? process.env.ELEVENLABS_VOICE_ID_SARAH || 'voice_sarah_default'
        : process.env.ELEVENLABS_VOICE_ID_JAMES || 'voice_james_default',
  }));

  const requestBody: TextToDialogueRequest = {
    model_id: 'eleven_v3',
    dialogue,
    output_format: options.format || 'mp3_44100_128',
    voice_settings: options.voiceSettings || {
      stability: 0.5,
      similarity_boost: 0.75,
      style: 0.5,
      use_speaker_boost: true,
    },
  };

  // API ENDPOINT: POST https://api.elevenlabs.io/v1/text-to-dialogue
  // HEADERS: {
  //   'xi-api-key': process.env.ELEVENLABS_API_KEY,
  //   'Content-Type': 'application/json'
  // }
  // REQUEST BODY: requestBody

  // The response contains audio_base64 which can be decoded and saved as MP3
  // To save: Buffer.from(audio_base64, 'base64') -> write to file or upload to storage

  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      audioData: MOCK_AUDIO_BASE64,
      format: requestBody.output_format || 'mp3_44100_128',
      sizeBytes: Math.floor(script.wordCount * 50), // Rough estimate: 50 bytes per word
    },
  };
}

/**
 * List available voices
 *
 * API ENDPOINT: GET https://api.elevenlabs.io/v1/voices
 * HEADERS: {
 *   'xi-api-key': process.env.ELEVENLABS_API_KEY
 * }
 * SUCCESS RESPONSE (200): {
 *   voices: [{
 *     voice_id: string,
 *     name: string,
 *     category: string,
 *     labels: { accent: string, age: string, gender: string, ... },
 *     ...
 *   }]
 * }
 */
export async function getVoices(): Promise<APIResponse<VoiceListResponse>> {
  // API ENDPOINT: GET https://api.elevenlabs.io/v1/voices
  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      voices: [
        {
          voice_id: 'sarah_mock',
          name: 'Sarah',
          category: 'professional',
        },
        {
          voice_id: 'james_mock',
          name: 'James',
          category: 'professional',
        },
      ],
    },
  };
}

/**
 * Get user's usage quota and limits
 *
 * API ENDPOINT: GET https://api.elevenlabs.io/v1/user/subscription
 * HEADERS: {
 *   'xi-api-key': process.env.ELEVENLABS_API_KEY
 * }
 * SUCCESS RESPONSE (200): {
 *   character_count: number,
 *   character_limit: number,
 *   next_character_count_reset_unix: number,
 *   ...
 * }
 */
export async function getUsageQuota(): Promise<APIResponse<UsageQuota>> {
  // API ENDPOINT: GET https://api.elevenlabs.io/v1/user/subscription
  // TODO: Replace with actual API call
  return {
    success: true,
    data: {
      character_count: 50000,
      character_limit: 500000,
      can_extend_character_limit: true,
      allowed_to_extend_character_limit: true,
      next_character_count_reset_unix: Date.now() / 1000 + 2592000,
      voice_limit: 10,
      max_voice_add_edits: 5,
      professional_voice_limit: 3,
      can_extend_voice_limit: true,
    },
  };
}
