/**
 * Netlify Background Function for Audio Processing
 *
 * Polls database for briefs AND podcast episodes with status='script_ready'
 * and processes audio generation using Gemini TTS, then uploads to Vultr.
 *
 * Background functions get 15-minute timeout (vs 10s for regular functions).
 * This function polls the database instead of using POST body since
 * background functions have a known issue where POST bodies are empty.
 */
import type { Context } from "@netlify/functions";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
// @ts-expect-error - lamejs doesn't have TypeScript definitions
import lamejs from "lamejs";

// Gemini TTS voice pairs for brief audio generation
const VOICE_PAIRS = [
  { hostA: 'Kore', hostB: 'Puck', names: 'Arabella & Mark' },
  { hostA: 'Aoede', hostB: 'Charon', names: 'Susan & Jon' },
  { hostA: 'Kore', hostB: 'Fenrir', names: 'Arabella & Chris' },
  { hostA: 'Aoede', hostB: 'Puck', names: 'Susan & Mark' },
  { hostA: 'Kore', hostB: 'Charon', names: 'Arabella & Jon' },
  { hostA: 'Aoede', hostB: 'Fenrir', names: 'Susan & Chris' },
];

// Fixed voice pair for podcast episodes (consistent branding)
const PODCAST_VOICE_PAIR = { hostA: 'Kore', hostB: 'Puck', names: 'Sarah & David' };

// Flash for daily briefs (cost-efficient, shorter content)
const GEMINI_FLASH_TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-tts:generateContent';
// Pro for podcasts (higher quality, structured multi-speaker content)
const GEMINI_PRO_TTS_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro-tts:generateContent';

// Raindrop service URLs (hakivo-prod @01kc6cdq deployment)
// Admin-dashboard service for database queries (uses /api/database/query)
const DASHBOARD_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzp.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';
// DB-Admin service for Spreaker uploads (uses /spreaker/*)
const DB_ADMIN_URL = 'https://svc-01kc6rbecv0s5k4yk6ksdaqyzq.01k66gywmx8x4r0w31fdjjfekf.lmapp.run';

// Content types for audio processing
type ContentType = 'brief' | 'podcast';

interface AudioContent {
  id: string;
  script: string;
  status: string;
  type: ContentType;
}

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
 * Convert brief script format to Gemini's named speaker format
 * Supports both old format (HOST A:/HOST B:) and new format (ARABELLA:/MARK:)
 * Removes emotional cues like [warmly] or [with urgency] for cleaner TTS
 */
function convertToDialoguePrompt(script: string, voiceA: string, voiceB: string): string {
  const lines = script.split('\n');
  const convertedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Remove emotional cues in brackets like [warmly], [with urgency], etc.
    const cleanLine = (content: string) => content.replace(/^\[[^\]]*\]\s*/, '').trim();

    // Support both old format (HOST A/HOST B) and new format (ARABELLA/MARK)
    if (trimmed.startsWith('HOST A:')) {
      convertedLines.push(`${voiceA}: ${cleanLine(trimmed.substring(7))}`);
    } else if (trimmed.startsWith('HOST B:')) {
      convertedLines.push(`${voiceB}: ${cleanLine(trimmed.substring(7))}`);
    } else if (trimmed.startsWith('ARABELLA:')) {
      convertedLines.push(`${voiceA}: ${cleanLine(trimmed.substring(9))}`);
    } else if (trimmed.startsWith('MARK:')) {
      convertedLines.push(`${voiceB}: ${cleanLine(trimmed.substring(5))}`);
    } else {
      // Skip non-dialogue lines (headers, stage directions, etc.)
      continue;
    }
  }

  return convertedLines.join('\n');
}

/**
 * Convert podcast script format (SARAH:/DAVID:) to Gemini's named speaker format
 * Podcast scripts use character names instead of HOST A/HOST B
 */
function convertPodcastToDialoguePrompt(script: string, voiceA: string, voiceB: string): string {
  const lines = script.split('\n');
  const convertedLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    // Match SARAH: or DAVID: at the start (with optional brackets for stage directions)
    if (trimmed.startsWith('SARAH:')) {
      // Remove stage directions like [with dramatic tension] for cleaner TTS
      const content = trimmed.substring(6).trim().replace(/^\[[^\]]*\]\s*/, '');
      convertedLines.push(`${voiceA}: ${content}`);
    } else if (trimmed.startsWith('DAVID:')) {
      const content = trimmed.substring(6).trim().replace(/^\[[^\]]*\]\s*/, '');
      convertedLines.push(`${voiceB}: ${content}`);
    } else {
      // Skip non-dialogue lines (stage directions, etc.)
      continue;
    }
  }

  return convertedLines.join('\n');
}

/**
 * Query database for briefs ready for audio processing
 */
async function getBriefsReadyForAudio(): Promise<Brief[]> {
  const query = `SELECT id, script, status FROM briefs WHERE status = 'script_ready' ORDER BY created_at ASC LIMIT 1`;

  const response = await fetch(`${DASHBOARD_URL}/api/database/query`, {
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
 * Query database for podcast episodes ready for audio processing
 */
async function getPodcastEpisodesReadyForAudio(): Promise<AudioContent[]> {
  const query = `SELECT id, script, status FROM podcast_episodes WHERE status = 'script_ready' ORDER BY episode_number ASC LIMIT 1`;

  const response = await fetch(`${DASHBOARD_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[AUDIO] Failed to query podcast episodes: ${response.status}`);
    return [];
  }

  const result = await response.json() as { results?: Brief[] };
  return (result.results || []).map(ep => ({ ...ep, type: 'podcast' as ContentType }));
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

  const response = await fetch(`${DASHBOARD_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[AUDIO] Failed to update brief status: ${response.status}`);
  }
}

/**
 * Update podcast episode status in database
 */
async function updatePodcastStatus(
  episodeId: string,
  status: string,
  audioUrl: string | null
): Promise<void> {
  const timestamp = Date.now();
  const query = audioUrl
    ? `UPDATE podcast_episodes SET status = '${status}', audio_url = '${audioUrl}', updated_at = ${timestamp} WHERE id = '${episodeId}'`
    : `UPDATE podcast_episodes SET status = '${status}', updated_at = ${timestamp} WHERE id = '${episodeId}'`;

  const response = await fetch(`${DASHBOARD_URL}/api/database/query`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  });

  if (!response.ok) {
    console.error(`[AUDIO] Failed to update podcast episode status: ${response.status}`);
  }
}

/**
 * Upload podcast episode to Spreaker after audio is ready
 * Uses the same endpoint as the backfill functionality
 */
async function uploadToSpreaker(episodeId: string): Promise<boolean> {
  console.log(`[SPREAKER] Auto-uploading episode ${episodeId} to Spreaker...`);

  try {
    const response = await fetch(`${DB_ADMIN_URL}/spreaker/upload/${episodeId}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[SPREAKER] Upload failed: ${response.status} - ${errorText}`);
      return false;
    }

    const result = await response.json() as { success?: boolean; spreakerId?: string; error?: string };

    if (result.success) {
      console.log(`[SPREAKER] ✅ Episode ${episodeId} uploaded successfully! Spreaker ID: ${result.spreakerId}`);
      return true;
    } else {
      console.error(`[SPREAKER] Upload returned error: ${result.error}`);
      return false;
    }
  } catch (error) {
    console.error(`[SPREAKER] Upload exception:`, error);
    return false;
  }
}

/**
 * Convert raw PCM (16-bit signed, mono, 24kHz) to MP3 using lamejs
 * This is a pure JavaScript encoder - no native dependencies needed!
 */
function encodePcmToMp3(pcmBuffer: Buffer, sampleRate: number = 24000, channels: number = 1): Uint8Array {
  console.log(`[AUDIO] Encoding PCM to MP3: ${pcmBuffer.length} bytes, ${sampleRate}Hz, ${channels} channel(s)`);

  // Create MP3 encoder (128kbps)
  const mp3encoder = new lamejs.Mp3Encoder(channels, sampleRate, 128);

  // Convert Buffer to Int16Array properly
  // Node.js Buffers can share ArrayBuffers, so we need to copy the data
  const arrayBuffer = new ArrayBuffer(pcmBuffer.length);
  new Uint8Array(arrayBuffer).set(new Uint8Array(pcmBuffer));
  const samples = new Int16Array(arrayBuffer);
  console.log(`[AUDIO] PCM samples: ${samples.length}`);

  // Encode in chunks (lamejs recommends 1152 samples per chunk)
  const sampleBlockSize = 1152;
  const mp3Data: Uint8Array[] = [];

  for (let i = 0; i < samples.length; i += sampleBlockSize) {
    const sampleChunk = samples.subarray(i, i + sampleBlockSize);
    const mp3buf = mp3encoder.encodeBuffer(sampleChunk);
    if (mp3buf.length > 0) {
      mp3Data.push(new Uint8Array(mp3buf));
    }
  }

  // Flush remaining data
  const mp3buf = mp3encoder.flush();
  if (mp3buf.length > 0) {
    mp3Data.push(new Uint8Array(mp3buf));
  }

  // Combine all chunks into single Uint8Array
  const totalLength = mp3Data.reduce((acc, chunk) => acc + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of mp3Data) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  console.log(`[AUDIO] MP3 encoded: ${result.length} bytes`);
  return result;
}

/**
 * Generate date-based file key
 * Format: audio/YYYY/MM/DD/brief-{briefId}-{timestamp}.mp3
 * For podcasts: podcast/100-laws/{episodeId}-{timestamp}.mp3
 */
function generateFileKey(id: string, type: ContentType = 'brief'): string {
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const ts = date.getTime();

  if (type === 'podcast') {
    // Podcast episodes get their own folder structure
    return `podcast/100-laws/${id}-${ts}.mp3`;
  }

  return `audio/${year}/${month}/${day}/brief-${id}-${ts}.mp3`;
}

/**
 * Upload audio directly to Vultr S3-compatible storage using AWS SDK
 */
async function uploadAudio(
  id: string,
  audioBuffer: Uint8Array,
  mimeType: string,
  type: ContentType = 'brief'
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

  const key = generateFileKey(id, type);

  console.log(`[AUDIO] Uploading to Vultr: bucket=${bucketName}, key=${key}, size=${audioBuffer.length} bytes`);

  await s3Client.send(new PutObjectCommand({
    Bucket: bucketName,
    Key: key,
    Body: audioBuffer,
    ContentType: mimeType,
    CacheControl: 'public, max-age=31536000',
    Metadata: {
      contentId: id,
      contentType: type,
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
    console.log(`[AUDIO] Dialogue prompt length: ${dialoguePrompt.length} chars`);
    console.log(`[AUDIO] Dialogue preview: ${dialoguePrompt.substring(0, 300)}...`);

    // Verify we have dialogue lines
    if (dialoguePrompt.length < 100) {
      console.error(`[AUDIO] Dialogue prompt too short (${dialoguePrompt.length} chars), script format may not match expected pattern`);
      console.log(`[AUDIO] Script preview: ${brief.script.substring(0, 500)}`);
      await updateBriefStatus(brief.id, 'audio_failed', null);
      return;
    }

    // Call Gemini Flash TTS API (cost-efficient for daily briefs)
    console.log('[AUDIO] Calling Gemini Flash TTS API...');
    const ttsResponse = await fetch(`${GEMINI_FLASH_TTS_ENDPOINT}?key=${geminiApiKey}`, {
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

    // Convert base64 to buffer (raw PCM data - 16-bit signed, 24kHz, mono)
    const pcmBuffer = Buffer.from(audioData.data, 'base64');
    console.log(`[AUDIO] Raw PCM size: ${pcmBuffer.length} bytes`);

    // Convert PCM to MP3 using lamejs (pure JavaScript - no native dependencies!)
    console.log('[AUDIO] Converting PCM to MP3 using lamejs...');
    const mp3Buffer = encodePcmToMp3(pcmBuffer, 24000, 1);

    // Upload to Vultr storage directly
    console.log('[AUDIO] Uploading MP3 to Vultr storage...');
    const audioUrl = await uploadAudio(brief.id, mp3Buffer, 'audio/mpeg');

    console.log(`[AUDIO] Uploaded to: ${audioUrl}`);

    // Update brief with completed status and audio URL
    await updateBriefStatus(brief.id, 'completed', audioUrl);

    console.log(`[AUDIO] Successfully processed brief ${brief.id}`);

  } catch (error) {
    console.error('[AUDIO] Audio generation error:', error);
    await updateBriefStatus(brief.id, 'audio_failed', null);
  }
}

/**
 * Split dialogue into chunks at natural boundaries (max ~4000 chars per chunk)
 * This ensures we stay within Gemini TTS limits while maintaining conversation flow
 */
function chunkDialogue(dialogue: string, maxChunkSize: number = 4000): string[] {
  const lines = dialogue.split('\n').filter(l => l.trim());
  const chunks: string[] = [];
  let currentChunk: string[] = [];
  let currentSize = 0;

  for (const line of lines) {
    // If adding this line would exceed limit, save current chunk and start new one
    if (currentSize + line.length + 1 > maxChunkSize && currentChunk.length > 0) {
      chunks.push(currentChunk.join('\n'));
      currentChunk = [];
      currentSize = 0;
    }
    currentChunk.push(line);
    currentSize += line.length + 1;
  }

  // Don't forget the last chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk.join('\n'));
  }

  return chunks;
}

/**
 * Generate audio for a single dialogue chunk
 */
async function generateAudioChunk(
  dialogueChunk: string,
  voicePair: typeof PODCAST_VOICE_PAIR,
  geminiApiKey: string,
  chunkIndex: number
): Promise<Buffer | null> {
  console.log(`[AUDIO] Processing chunk ${chunkIndex + 1}, length: ${dialogueChunk.length} chars`);

  // Use Pro model for podcasts (higher quality structured content)
  const ttsResponse = await fetch(`${GEMINI_PRO_TTS_ENDPOINT}?key=${geminiApiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: dialogueChunk }]
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
    console.error(`[AUDIO] Gemini TTS chunk ${chunkIndex + 1} error ${ttsResponse.status}: ${errorText}`);
    return null;
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

  const audioData = ttsResult.candidates?.[0]?.content?.parts?.[0]?.inlineData;
  if (!audioData) {
    console.error(`[AUDIO] No audio data in chunk ${chunkIndex + 1} response`);
    return null;
  }

  return Buffer.from(audioData.data, 'base64');
}

/**
 * Process a single podcast episode's audio generation
 * Handles long scripts by chunking and concatenating audio
 */
async function processPodcastEpisode(episode: AudioContent, geminiApiKey: string): Promise<void> {
  console.log(`[AUDIO] Processing podcast episode: ${episode.id}`);
  console.log(`[AUDIO] Script length: ${episode.script.length} characters`);

  // Mark as processing to prevent duplicate processing
  await updatePodcastStatus(episode.id, 'audio_processing', null);

  try {
    // Use fixed voice pair for consistent podcast branding
    const voicePair = PODCAST_VOICE_PAIR;
    console.log(`[AUDIO] Using podcast voices: ${voicePair.names}`);

    // Convert podcast script to dialogue format (SARAH:/DAVID: -> Kore:/Puck:)
    const dialoguePrompt = convertPodcastToDialoguePrompt(episode.script, voicePair.hostA, voicePair.hostB);
    console.log(`[AUDIO] Total dialogue length: ${dialoguePrompt.length} chars`);
    console.log(`[AUDIO] Dialogue prompt preview: ${dialoguePrompt.substring(0, 200)}...`);

    // Chunk the dialogue for long scripts (Gemini TTS has ~4000 char limit)
    const chunks = chunkDialogue(dialoguePrompt, 4000);
    console.log(`[AUDIO] Split into ${chunks.length} chunks for processing`);

    // Generate audio for each chunk
    const pcmBuffers: Buffer[] = [];
    for (let i = 0; i < chunks.length; i++) {
      const pcmBuffer = await generateAudioChunk(chunks[i]!, voicePair, geminiApiKey, i);
      if (!pcmBuffer) {
        console.error(`[AUDIO] Failed to generate audio for chunk ${i + 1}`);
        await updatePodcastStatus(episode.id, 'audio_failed', null);
        return;
      }
      pcmBuffers.push(pcmBuffer);
      console.log(`[AUDIO] Chunk ${i + 1}/${chunks.length} complete: ${pcmBuffer.length} bytes`);
    }

    // Concatenate all PCM buffers
    const totalPcmLength = pcmBuffers.reduce((sum, buf) => sum + buf.length, 0);
    console.log(`[AUDIO] Total PCM size: ${totalPcmLength} bytes from ${pcmBuffers.length} chunks`);

    const combinedPcm = Buffer.concat(pcmBuffers);

    // Convert combined PCM to MP3 using lamejs
    console.log('[AUDIO] Converting combined PCM to MP3 using lamejs...');
    const mp3Buffer = encodePcmToMp3(combinedPcm, 24000, 1);

    // Upload to Vultr storage directly
    console.log('[AUDIO] Uploading podcast MP3 to Vultr storage...');
    const audioUrl = await uploadAudio(episode.id, mp3Buffer, 'audio/mpeg', 'podcast');

    console.log(`[AUDIO] Uploaded podcast to: ${audioUrl}`);

    // Update episode with completed status and audio URL
    await updatePodcastStatus(episode.id, 'completed', audioUrl);

    console.log(`[AUDIO] Successfully processed podcast episode ${episode.id}`);

    // Auto-upload to Spreaker now that audio is ready
    console.log(`[AUDIO] Triggering Spreaker upload for episode ${episode.id}...`);
    const spreakSuccess = await uploadToSpreaker(episode.id);
    if (spreakSuccess) {
      console.log(`[AUDIO] ✅ Episode ${episode.id} fully published to Vultr + Spreaker`);
    } else {
      console.log(`[AUDIO] ⚠️ Episode ${episode.id} audio ready but Spreaker upload failed (can be retried via backfill)`);
    }

  } catch (error) {
    console.error('[AUDIO] Podcast audio generation error:', error);
    await updatePodcastStatus(episode.id, 'audio_failed', null);
  }
}

/**
 * Background function handler - polls database for briefs AND podcast episodes
 *
 * This is a BACKGROUND FUNCTION (15 min timeout) that polls for content.
 * It must be triggered via HTTP call, but ignores the request body
 * (since background functions have empty POST bodies).
 *
 * Processes both:
 * - Daily briefs from `briefs` table (HOST A:/HOST B: format)
 * - Podcast episodes from `podcast_episodes` table (SARAH:/DAVID: format)
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

  if (briefs.length > 0) {
    console.log(`[AUDIO] Found ${briefs.length} brief(s) ready for audio`);
    // Process one brief at a time
    for (const brief of briefs) {
      await processBrief(brief, geminiApiKey);
    }
  } else {
    console.log('[AUDIO] No briefs ready for audio processing');
  }

  // Query for podcast episodes ready for audio
  const episodes = await getPodcastEpisodesReadyForAudio();

  if (episodes.length > 0) {
    console.log(`[AUDIO] Found ${episodes.length} podcast episode(s) ready for audio`);
    // Process one episode at a time
    for (const episode of episodes) {
      await processPodcastEpisode(episode, geminiApiKey);
    }
  } else {
    console.log('[AUDIO] No podcast episodes ready for audio processing');
  }

  console.log('[AUDIO] Background function complete');
};

// No config needed - background functions use the -background filename suffix
