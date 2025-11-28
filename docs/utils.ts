/**
 * Audio Generator Observer - Utility Functions
 * Stub implementations for testing
 */

import type {
  AudioGeneratorEnv,
  DialogueScript,
  AudioResult,
  ElevenLabsResponse,
} from './interfaces';

export async function generateDialogueAudio(
  script: DialogueScript[],
  env: AudioGeneratorEnv
): Promise<ElevenLabsResponse> {
  env.logger.info('Generating dialogue audio', { scriptLength: script.length });

  const requestBody = formatScriptForElevenLabs(script);

  // Populate voice IDs for speakers
  const body = requestBody as any;
  body.speakers = body.speakers.map((speaker: any) => ({
    ...speaker,
    voice_id: speaker.name === 'sarah'
      ? env.ELEVENLABS_SARAH_VOICE_ID
      : env.ELEVENLABS_JAMES_VOICE_ID,
  }));

  const response = await fetch('https://api.elevenlabs.io/v1/text-to-dialogue', {
    method: 'POST',
    headers: {
      'xi-api-key': env.ELEVENLABS_API_KEY,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`ElevenLabs API error: ${response.status}`);
  }

  const audio = await response.arrayBuffer();

  // Return response with alignment data
  return {
    audio,
    alignment: {
      characters: [],
      character_start_times_seconds: [],
      character_end_times_seconds: [],
    },
  };
}

export async function uploadToVultr(
  audioBuffer: ArrayBuffer,
  filename: string,
  env: AudioGeneratorEnv
): Promise<string> {
  const bucketName = 'hakivo-audio';
  const url = `${env.VULTR_STORAGE_ENDPOINT}/${bucketName}/${filename}`;

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      'Content-Type': 'audio/mpeg',
    },
    body: audioBuffer,
  });

  if (!response.ok) {
    throw new Error(`Vultr upload error: ${response.status}`);
  }

  env.logger.info('Uploaded audio to Vultr', { filename });

  // Return CDN URL
  return `${env.VULTR_CDN_URL}/${bucketName}/${filename}`;
}

export function calculateAudioDuration(
  alignment: ElevenLabsResponse['alignment']
): number {
  if (!alignment.character_end_times_seconds.length) {
    return 0;
  }

  const lastEndTime =
    alignment.character_end_times_seconds[
      alignment.character_end_times_seconds.length - 1
    ];

  return lastEndTime;
}

export function formatScriptForElevenLabs(
  script: DialogueScript[]
): Record<string, unknown> {
  // Get unique speakers from script
  const uniqueSpeakers = Array.from(new Set(script.map(s => s.host)));

  // Create speaker definitions with voice IDs
  // Note: In production, voice IDs are passed via env vars
  const speakers = uniqueSpeakers.map(name => ({
    name,
    voice_id: '', // Will be populated by generateDialogueAudio
  }));

  // Create turns from script
  const turns = script.map(line => ({
    speaker: line.host,
    text: line.text,
  }));

  return {
    speakers,
    turns,
  };
}
