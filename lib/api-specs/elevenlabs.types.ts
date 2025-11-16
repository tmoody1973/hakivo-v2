/**
 * ElevenLabs API Types
 *
 * Type definitions for ElevenLabs text-to-dialogue audio generation
 * using the eleven_v3 model with Sarah and James voices.
 *
 * API Documentation: https://elevenlabs.io/docs/api-reference
 */

import { APIResponse } from './common.types';

// ============================================================================
// Voice Types
// ============================================================================

export enum VoiceId {
  SARAH = 'sarah', // Will be replaced with actual voice ID from env
  JAMES = 'james', // Will be replaced with actual voice ID from env
}

export interface Voice {
  voice_id: string;
  name: string;
  category?: string;
  description?: string;
  labels?: Record<string, string>;
  samples?: VoiceSample[];
  settings?: VoiceSettings;
}

export interface VoiceSample {
  sample_id: string;
  file_name: string;
  mime_type: string;
  size_bytes: number;
  hash: string;
}

// ============================================================================
// Text-to-Dialogue Types
// ============================================================================

export interface DialogueTurn {
  speaker: string; // Speaker name (e.g., 'Sarah', 'James')
  text: string;
  voice_id: string; // ElevenLabs voice ID
}

export interface TextToDialogueRequest {
  model_id: 'eleven_v3'; // Text-to-dialogue model
  dialogue: DialogueTurn[];
  output_format?: AudioFormat;
  voice_settings?: VoiceSettings;
}

export interface VoiceSettings {
  stability?: number; // 0-1, default: 0.5
  similarity_boost?: number; // 0-1, default: 0.75
  style?: number; // 0-1, default: 0.5
  use_speaker_boost?: boolean; // default: true
}

export type AudioFormat =
  | 'mp3_44100_64'
  | 'mp3_44100_96'
  | 'mp3_44100_128' // Default
  | 'mp3_44100_192'
  | 'pcm_16000'
  | 'pcm_22050'
  | 'pcm_24000'
  | 'pcm_44100';

export interface TextToDialogueResponse {
  audio_base64: string; // Base64 encoded audio
}

// ============================================================================
// Response Types
// ============================================================================

export type GenerateDialogueAudioResponse = APIResponse<{
  audioData: string; // Base64 encoded
  format: AudioFormat;
  sizeBytes: number;
}>;

export interface VoiceListResponse {
  voices: Voice[];
}

// ============================================================================
// Usage & Quota Types
// ============================================================================

export interface UsageQuota {
  character_count: number;
  character_limit: number;
  can_extend_character_limit: boolean;
  allowed_to_extend_character_limit: boolean;
  next_character_count_reset_unix: number;
  voice_limit: number;
  max_voice_add_edits: number;
  professional_voice_limit: number;
  can_extend_voice_limit: boolean;
}
