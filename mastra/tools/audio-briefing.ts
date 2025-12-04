import { createTool } from "@mastra/core/tools";
import { z } from "zod";

/**
 * Audio Briefing Tools for Hakivo Congressional Assistant
 *
 * Uses ElevenLabs text-to-speech API to generate spoken summaries of:
 * - Bill analyses and updates
 * - Voting records
 * - Legislative updates
 * - Personalized district briefings
 */

// ElevenLabs API configuration
const ELEVENLABS_API_URL = "https://api.elevenlabs.io/v1";

const getElevenLabsConfig = () => {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY not configured");
  }

  // Default to Sarah voice for briefings (clear, professional)
  const voiceId =
    process.env.ELEVENLABS_SARAH_VOICE_ID ||
    process.env.ELEVENLABS_VOICE_ID_SARAH ||
    "21m00Tcm4TlvDq8ikWAM"; // Default ElevenLabs voice

  return { apiKey, voiceId };
};

// Result types
interface AudioBriefingResult {
  success: boolean;
  audioUrl?: string;
  audioBase64?: string;
  duration?: number;
  transcript: string;
  voiceId: string;
  error?: string;
}

// Briefing types
type BriefingType =
  | "bill_summary"
  | "voting_record"
  | "legislative_update"
  | "district_briefing"
  | "weekly_recap";

/**
 * Generate Audio Briefing Tool
 *
 * Creates an audio briefing using ElevenLabs TTS.
 * Returns audio as base64 for direct playback in the frontend.
 */
export const generateAudioBriefingTool = createTool({
  id: "generateAudioBriefing",
  description: `Generate an audio briefing using text-to-speech.

Briefing types:
- bill_summary: Quick summary of a specific bill
- voting_record: Summary of a representative's recent votes
- legislative_update: Updates on tracked legislation
- district_briefing: Personalized update for user's district
- weekly_recap: Week in Congress summary

Returns audio for playback with transcript.`,
  inputSchema: z.object({
    briefingType: z
      .enum([
        "bill_summary",
        "voting_record",
        "legislative_update",
        "district_briefing",
        "weekly_recap",
      ])
      .describe("Type of briefing to generate"),
    content: z.string().describe("Text content to convert to speech"),
    title: z.string().optional().describe("Briefing title for display"),
    voiceStyle: z
      .enum(["professional", "conversational", "energetic"])
      .optional()
      .default("professional")
      .describe("Voice style/tone"),
    speed: z
      .number()
      .min(0.5)
      .max(2.0)
      .optional()
      .default(1.0)
      .describe("Playback speed multiplier"),
  }),
  execute: async ({ context }): Promise<AudioBriefingResult> => {
    const {
      content,
      voiceStyle = "professional",
      speed = 1.0,
    } = context;

    try {
      const { apiKey, voiceId } = getElevenLabsConfig();

      // Configure voice settings based on style
      const stabilitySettings = {
        professional: { stability: 0.75, similarity_boost: 0.75 },
        conversational: { stability: 0.5, similarity_boost: 0.8 },
        energetic: { stability: 0.3, similarity_boost: 0.9 },
      };

      const settings = stabilitySettings[voiceStyle];

      // Call ElevenLabs text-to-speech API
      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: content,
            model_id: "eleven_turbo_v2", // Fast, high-quality model
            voice_settings: {
              stability: settings.stability,
              similarity_boost: settings.similarity_boost,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      // Get audio as ArrayBuffer
      const audioBuffer = await response.arrayBuffer();

      // Convert to base64 for frontend playback
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      // Estimate duration (roughly 150 words per minute at normal speed)
      const wordCount = content.split(/\s+/).length;
      const estimatedDuration = Math.ceil((wordCount / 150) * 60 / speed);

      return {
        success: true,
        audioBase64,
        duration: estimatedDuration,
        transcript: content,
        voiceId,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes("ELEVENLABS_API_KEY")) {
        return {
          success: false,
          transcript: content,
          voiceId: "",
          error: "ElevenLabs API not configured. Please set ELEVENLABS_API_KEY.",
        };
      }

      return {
        success: false,
        transcript: content,
        voiceId: "",
        error: error instanceof Error ? error.message : "Unknown error generating audio",
      };
    }
  },
});

/**
 * Generate Bill Summary Audio Tool
 *
 * Generates a spoken summary of a specific bill.
 * Formats the bill data into natural speech.
 */
export const generateBillAudioSummaryTool = createTool({
  id: "generateBillAudioSummary",
  description: `Generate an audio summary of a specific bill.

Takes bill details and creates a natural-sounding spoken summary.
Ideal for users who want to listen to bill updates on the go.`,
  inputSchema: z.object({
    billId: z.string().describe("Bill ID (e.g., hr1234-118)"),
    billTitle: z.string().describe("Bill title"),
    billSummary: z.string().describe("Bill summary text"),
    sponsor: z.string().optional().describe("Bill sponsor name and party"),
    status: z.string().optional().describe("Current bill status"),
    latestAction: z.string().optional().describe("Most recent action"),
    includeAnalysis: z
      .boolean()
      .optional()
      .default(true)
      .describe("Include AI analysis in the briefing"),
  }),
  execute: async ({ context }): Promise<AudioBriefingResult> => {
    const {
      billId,
      billTitle,
      billSummary,
      sponsor,
      status,
      latestAction,
    } = context;

    try {
      const { apiKey, voiceId } = getElevenLabsConfig();

      // Format bill info into natural speech
      let speechText = `Here's a summary of ${billTitle}. `;

      if (sponsor) {
        speechText += `This bill was introduced by ${sponsor}. `;
      }

      if (status) {
        speechText += `Its current status is: ${status}. `;
      }

      speechText += `${billSummary} `;

      if (latestAction) {
        speechText += `The most recent action was: ${latestAction}. `;
      }

      speechText += `That's the update on bill ${billId.replace("-", " from Congress ")}.`;

      // Generate audio
      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: speechText,
            model_id: "eleven_turbo_v2",
            voice_settings: {
              stability: 0.75,
              similarity_boost: 0.75,
              style: 0.0,
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      const wordCount = speechText.split(/\s+/).length;
      const estimatedDuration = Math.ceil((wordCount / 150) * 60);

      return {
        success: true,
        audioBase64,
        duration: estimatedDuration,
        transcript: speechText,
        voiceId,
      };
    } catch (error) {
      return {
        success: false,
        transcript: "",
        voiceId: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

/**
 * Generate Daily Briefing Audio Tool
 *
 * Creates a comprehensive daily audio briefing for the user.
 */
export const generateDailyBriefingAudioTool = createTool({
  id: "generateDailyBriefingAudio",
  description: `Generate a personalized daily audio briefing.

Includes:
- Updates on tracked bills
- Recent votes by user's representatives
- Relevant news highlights
- Upcoming congressional schedule

Perfect for morning commute listening.`,
  inputSchema: z.object({
    userName: z.string().optional().describe("User's name for personalization"),
    trackedBillsUpdate: z.string().describe("Update on tracked bills"),
    representativeVotes: z.string().optional().describe("Recent votes by representatives"),
    newsHighlights: z.string().optional().describe("Relevant news highlights"),
    upcomingSchedule: z.string().optional().describe("Upcoming congressional schedule"),
  }),
  execute: async ({ context }): Promise<AudioBriefingResult> => {
    const {
      userName,
      trackedBillsUpdate,
      representativeVotes,
      newsHighlights,
      upcomingSchedule,
    } = context;

    try {
      const { apiKey, voiceId } = getElevenLabsConfig();

      // Build the daily briefing script
      const greeting = userName
        ? `Good morning, ${userName}. Here's your congressional briefing for today.`
        : "Good morning. Here's your congressional briefing for today.";

      let speechText = `${greeting} `;

      if (trackedBillsUpdate) {
        speechText += `First, an update on the bills you're tracking. ${trackedBillsUpdate} `;
      }

      if (representativeVotes) {
        speechText += `Now, let's look at how your representatives voted recently. ${representativeVotes} `;
      }

      if (newsHighlights) {
        speechText += `In the news: ${newsHighlights} `;
      }

      if (upcomingSchedule) {
        speechText += `Looking ahead: ${upcomingSchedule} `;
      }

      speechText += "That's your briefing for today. Have a great day!";

      // Generate audio
      const response = await fetch(
        `${ELEVENLABS_API_URL}/text-to-speech/${voiceId}`,
        {
          method: "POST",
          headers: {
            "xi-api-key": apiKey,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            text: speechText,
            model_id: "eleven_turbo_v2",
            voice_settings: {
              stability: 0.7,
              similarity_boost: 0.8,
              style: 0.1, // Slightly more expressive for daily briefing
              use_speaker_boost: true,
            },
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`ElevenLabs API error: ${response.status} - ${errorText}`);
      }

      const audioBuffer = await response.arrayBuffer();
      const audioBase64 = Buffer.from(audioBuffer).toString("base64");

      const wordCount = speechText.split(/\s+/).length;
      const estimatedDuration = Math.ceil((wordCount / 150) * 60);

      return {
        success: true,
        audioBase64,
        duration: estimatedDuration,
        transcript: speechText,
        voiceId,
      };
    } catch (error) {
      return {
        success: false,
        transcript: "",
        voiceId: "",
        error: error instanceof Error ? error.message : "Unknown error",
      };
    }
  },
});

// Export all audio briefing tools
export const audioBriefingTools = {
  generateAudioBriefing: generateAudioBriefingTool,
  generateBillAudioSummary: generateBillAudioSummaryTool,
  generateDailyBriefingAudio: generateDailyBriefingAudioTool,
};
