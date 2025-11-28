/**
 * Netlify Background Function for Audio Processing
 *
 * Polls database for briefs with status='script_ready' and processes
 * audio generation using Gemini TTS, then uploads directly to Vultr.
 *
 * Background functions get 15-minute timeout (vs 10s for regular functions).
 * This function polls the database instead of using POST body since
 * background functions have a known issue where POST bodies are empty.
 */
import type { Context } from "@netlify/functions";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import wav from "wav";
import ffmpeg from "fluent-ffmpeg";
import ffmpegPath from "@ffmpeg-installer/ffmpeg";

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

// Raindrop db-admin URL for database queries
const DB_ADMIN_URL = 'https://svc-01ka8k5e6tr0kgy0jkzj9m4q1a.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

interface Brief {
  id: string;
  script: string;
  status: string;
}

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
 * Query database for briefs ready for audio processing
 */
async function getBriefsReadyForAudio(): Promise<Brief[]> {
  const query = `SELECT id, script, status FROM briefs WHERE status = 'script_ready' ORDER BY created_at ASC LIMIT 1`;

  const response = await fetch(`${DB_ADMIN_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[AUDIO] Failed to query briefs: ${response.status}`);
    return [];
  }

  const result = await response.json() as { results?: Brief[] };
  return result.results || [];
}

/**
 * Update brief status in database
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
    console.error(`[AUDIO] Failed to update brief status: ${response.status}`);
  }
}

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath.path);

/**
 * Save PCM data as a proper WAV file using the wav library
 * Gemini TTS returns raw PCM (L16) at 24kHz, 16-bit, mono
 */
async function saveWavFile(
  filePath: string,
  pcmData: Buffer,
  channels: number = 1,
  sampleRate: number = 24000,
  sampleWidth: number = 2 // bytes per sample (16-bit = 2)
): Promise<void> {
  return new Promise((resolve, reject) => {
    const writer = new wav.FileWriter(filePath, {
      channels,
      sampleRate,
      bitDepth: sampleWidth * 8,
    });

    writer.on('finish', resolve);
    writer.on('error', reject);

    writer.write(pcmData);
    writer.end();
  });
}

/**
 * Convert WAV file to MP3 using ffmpeg
 */
async function convertWavToMp3(wavPath: string, mp3Path: string): Promise<void> {
  return new Promise((resolve, reject) => {
    ffmpeg(wavPath)
      .audioCodec('libmp3lame')
      .audioBitrate('128k')
      .audioChannels(1)
      .audioFrequency(24000)
      .on('end', () => resolve())
      .on('error', (err: Error) => reject(err))
      .save(mp3Path);
  });
}

/**
 * Generate date-based file key
 * Format: audio/YYYY/MM/DD/brief-{briefId}-{timestamp}.mp3
 */
function generateFileKey(briefId: string): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const ts = date.getTime();

  return `audio/${year}/${month}/${day}/brief-${briefId}-${ts}.mp3`;
}

/**
 * Upload audio directly to Vultr S3-compatible storage using AWS SDK
 */
async function uploadAudio(
  briefId: string,
  audioBuffer: Uint8Array,
  mimeType: string
): Promise<string> {
  const endpoint = Netlify.env.get('VULTR_ENDPOINT') || 'sjc1.vultrobjects.com';
  const accessKeyId = Netlify.env.get('VULTR_ACCESS_KEY');
  const secretAccessKey = Netlify.env.get('VULTR_SECRET_KEY');
  const bucketName = Netlify.env.get('VULTR_BUCKET_NAME') || 'hakivo';

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('Missing Vultr S3 credentials: VULTR_ACCESS_KEY or VULTR_SECRET_KEY');
  }

  console.log(`[AUDIO] Vultr config - endpoint: ${endpoint}, bucket: ${bucketName}, accessKey prefix: ${accessKeyId.substring(0, 8)}...`);

  const s3Client = new S3Client({
    endpoint: `https://${endpoint}`,
    region: 'us-east-1', // Vultr uses us-east-1 for S3 signature signing
    forcePathStyle: true, // Required for S3-compatible storage
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });

  const key = generateFileKey(briefId);

  console.log(`[AUDIO] Uploading to Vultr: bucket=${bucketName}, key=${key}, size=${audioBuffer.length} bytes`);

  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: audioBuffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000',
    Metadata: {
      briefId,
      generatedAt: new Date().toISOString(),
    },
  }));

  // Generate public URL (path-style)
  const url = `https://${endpoint}/${bucketName}/${key}`;
  console.log(`[AUDIO] Upload successful: ${url}`);

  return url;
}

/**
 * Process a single brief's audio generation
 */
async function processBrief(brief: Brief, geminiApiKey: string): Promise<void> {
  console.log(`[AUDIO] Processing brief: ${brief.id}`);
  console.log(`[AUDIO] Script length: ${brief.script.length} characters`);

  // Mark as processing to prevent duplicate processing
  await updateBriefStatus(brief.id, 'audio_processing', null);

  try {
    // Select voice pair
    const voicePair = selectVoicePair(brief.id);
    console.log(`[AUDIO] Using voices: ${voicePair.names}`);

    // Convert script to dialogue format
    const dialoguePrompt = convertToDialoguePrompt(brief.script, voicePair.hostA, voicePair.hostB);

    // Call Gemini TTS API
    console.log('[AUDIO] Calling Gemini TTS API...');
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
      console.error(`[AUDIO] Gemini TTS error ${ttsResponse.status}: ${errorText}`);
      await updateBriefStatus(brief.id, 'audio_failed', null);
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
      console.error('[AUDIO] No audio data in Gemini response');
      await updateBriefStatus(brief.id, 'audio_failed', null);
      return;
    }

    console.log(`[AUDIO] Gemini TTS returned ${audioData.mimeType} audio`);

    // Convert base64 to buffer (raw PCM data)
    const pcmBuffer = Buffer.from(audioData.data, 'base64');
    console.log(`[AUDIO] Raw PCM size: ${pcmBuffer.length} bytes`);

    // Create temp directory for audio processing
    const tempDir = os.tmpdir();
    const wavPath = path.join(tempDir, `brief-${brief.id}.wav`);
    const mp3Path = path.join(tempDir, `brief-${brief.id}.mp3`);

    try {
      // Save PCM data as proper WAV file using wav library
      console.log(`[AUDIO] Saving WAV file to ${wavPath}...`);
      await saveWavFile(wavPath, pcmBuffer, 1, 24000, 2);
      const wavStats = fs.statSync(wavPath);
      console.log(`[AUDIO] WAV file created: ${wavStats.size} bytes`);

      // Convert WAV to MP3 using ffmpeg
      console.log(`[AUDIO] Converting to MP3...`);
      await convertWavToMp3(wavPath, mp3Path);
      const mp3Stats = fs.statSync(mp3Path);
      console.log(`[AUDIO] MP3 file created: ${mp3Stats.size} bytes`);

      // Read MP3 file for upload
      const mp3Buffer = fs.readFileSync(mp3Path);

      // Upload to Vultr storage directly
      console.log('[AUDIO] Uploading MP3 to Vultr storage...');
      const audioUrl = await uploadAudio(brief.id, new Uint8Array(mp3Buffer), 'audio/mpeg');

      // Clean up temp files
      try {
        fs.unlinkSync(wavPath);
        fs.unlinkSync(mp3Path);
      } catch (cleanupError) {
        console.warn('[AUDIO] Failed to clean up temp files:', cleanupError);
      }

      console.log(`[AUDIO] Uploaded to: ${audioUrl}`);

      // Update brief with completed status and audio URL
      await updateBriefStatus(brief.id, 'completed', audioUrl);

      console.log(`[AUDIO] Successfully processed brief ${brief.id}`);

    } catch (conversionError) {
      // Clean up temp files on error
      try {
        if (fs.existsSync(wavPath)) fs.unlinkSync(wavPath);
        if (fs.existsSync(mp3Path)) fs.unlinkSync(mp3Path);
      } catch {
        // Ignore cleanup errors
      }
      throw conversionError; // Re-throw to outer catch
    }

  } catch (error) {
    console.error('[AUDIO] Audio generation error:', error);
    await updateBriefStatus(brief.id, 'audio_failed', null);
  }
}

/**
 * Background function handler - polls database for briefs to process
 *
 * This is a BACKGROUND FUNCTION (15 min timeout) that polls for briefs.
 * It must be triggered via HTTP call, but ignores the request body
 * (since background functions have empty POST bodies).
 */
export default async (_req: Request, _context: Context) => {
  console.log('[AUDIO] Background function triggered');

  // Get Gemini API key
  const geminiApiKey = Netlify.env.get('GEMINI_API_KEY');
  if (!geminiApiKey) {
    console.error('[AUDIO] GEMINI_API_KEY not configured');
    return; // Background functions return empty 202
  }

  // Query for briefs ready for audio
  const briefs = await getBriefsReadyForAudio();

  if (briefs.length === 0) {
    console.log('[AUDIO] No briefs ready for audio processing');
    return;
  }

  console.log(`[AUDIO] Found ${briefs.length} brief(s) ready for audio`);

  // Process one brief at a time
  for (const brief of briefs) {
    await processBrief(brief, geminiApiKey);
  }

  console.log('[AUDIO] Background function complete');
};

// No config needed - background functions use the -background filename suffix
