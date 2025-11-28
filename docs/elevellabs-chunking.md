## Introduction

This guide provides a comprehensive overview of how to leverage the ElevenLabs API to generate long-form, multi-host audio content. It is specifically tailored for integration into the existing `rhythm-lab-app`, building upon its current implementation of single-voice podcast generation. By the end of this guide, you will be able to create dynamic, conversational audio with multiple speakers, enhancing the immersive experience of your application.

The primary tool for this task is the **ElevenLabs Text to Dialogue API**, which is designed to produce natural-sounding conversations from a structured script. This powerful feature allows for the assignment of different voices to different parts of the text, complete with emotional cues and contextual awareness, making it ideal for podcasts, interviews, and other multi-speaker formats.

## Prerequisites

Before proceeding, ensure you have the following prerequisites in place, which are already part of the `rhythm-lab-app` project:

- **ElevenLabs API Key**: Your `ELEVENLABS_API_KEY` should be securely stored as an environment variable.
- **ElevenLabs SDK**: The `@elevenlabs/elevenlabs-js` package should be installed in your project.

## Understanding the Text to Dialogue API

The Text to Dialogue API is a powerful feature of the Eleven v3 model that allows for the creation of realistic, multi-speaker conversations. Unlike the standard Text-to-Speech API, which is designed for a single voice, the Text to Dialogue API accepts a list of inputs, where each input is a segment of text assigned to a specific voice.

### Key Concepts

- **Dialogue Structure**: The API takes an array of objects, where each object represents a line of dialogue. Each object must contain the `text` to be spoken and the `voice_id` of the speaker.
- **Emotional Cues**: The model can interpret emotional and delivery cues directly from the text. By including bracketed tags like `[laughing]`, `[thoughtful]`, or `[excitedly]`, you can guide the model to produce more expressive and nuanced audio.
- **No Speaker Limit**: There is no hard limit to the number of speakers you can include in a dialogue, allowing for complex, multi-person conversations.

### API Request Structure

The following table illustrates the basic structure of a request to the Text to Dialogue API:

| Parameter | Type | Description |
|---|---|---|
| `inputs` | Array of Objects | A list of dialogue inputs. Each object must contain `text` and `voice_id`. |
| `model_id` | String | The ID of the model to use. For Text to Dialogue, this must be `eleven_v3`. |
| `voice_settings` | Object | Optional settings to control stability, similarity, and other voice characteristics. |

## Implementation Steps

### Step 1: Prepare the Dialogue Script

To create a multi-host audio file, you first need to structure your text into a dialogue format. This involves breaking down the content into individual lines and assigning a voice to each line. For example, a simple two-person conversation would be structured as follows:

```javascript
const dialogue = [
  {
    text: "[cheerfully] Welcome to the Rhythm Lab Radio podcast! I'm your host, Tarik.",
    voice_id: "YOUR_HOST_VOICE_ID_1"
  },
  {
    text: "And I'm your co-host, Moody. Today, we're diving deep into the world of neo-soul.",
    voice_id: "YOUR_HOST_VOICE_ID_2"
  }
];
```

### Step 2: Modify the Existing Code

In your `rhythm-lab-app`, you can adapt the existing `podcast-generator.ts` file to use the Text to Dialogue API. Instead of calling the standard text-to-speech endpoint, you will use the `text_to_dialogue.convert` method.

Here is an example of how you can modify the `generateAudioFromScript` function:

```typescript
// In /lib/elevenlabs/podcast-generator.ts

import { ElevenLabsClient } from "@elevenlabs/elevenlabs-js";

// ... (existing code)

export async function generateMultiHostAudio(
  dialogue: { text: string; voice_id: string }[],
  options: PodcastGenerationOptions
): Promise<{ success: boolean; audioBuffer?: Buffer; error?: string }> {
  try {
    if (!ELEVENLABS_API_KEY) {
      throw new Error("ElevenLabs API key not configured");
    }

    const elevenlabs = new ElevenLabsClient({
      apiKey: ELEVENLABS_API_KEY,
    });

    const audio = await elevenlabs.textToDialogue.convert({
      inputs: dialogue,
      model_id: "eleven_v3",
      voice_settings: {
        stability: options.stability ?? 0.5,
        similarity_boost: options.clarityBoost ?? 0.75,
        style: 0.0,
        use_speaker_boost: options.speakerBoost ?? true,
      },
    });

    console.log(`Audio generated successfully, size: ${audio.length} bytes`);

    return {
      success: true,
      audioBuffer: Buffer.from(audio),
    };
  } catch (error: any) {
    console.error("ElevenLabs API error:", error);
    return {
      success: false,
      error: error.message || "Failed to generate audio",
    };
  }
}
```

### Step 3: Handling Long-Form Audio

The ElevenLabs API has character limits for each generation request (typically around 5,000 characters for paid plans). To generate long-form audio, such as a full-length podcast, you need to break your content into smaller chunks and generate the audio for each chunk separately. You can then concatenate the audio files to create the final product.

Here is a conceptual example of how to implement chunking:

```javascript
// Conceptual chunking strategy

const fullDialogue = [/* your entire dialogue script */];
const characterLimit = 4500; // Slightly below the 5000 limit for safety
const audioChunks = [];

let currentChunk = [];
let currentLength = 0;

for (const line of fullDialogue) {
  if (currentLength + line.text.length > characterLimit) {
    // Generate audio for the current chunk
    const audio = await generateMultiHostAudio(currentChunk, options);
    audioChunks.push(audio.audioBuffer);

    // Start a new chunk
    currentChunk = [line];
    currentLength = line.text.length;
  } else {
    currentChunk.push(line);
    currentLength += line.text.length;
  }
}

// Generate audio for the last chunk
if (currentChunk.length > 0) {
  const audio = await generateMultiHostAudio(currentChunk, options);
  audioChunks.push(audio.audioBuffer);
}

// Concatenate the audio chunks to create the final audio file
const finalAudio = Buffer.concat(audioChunks);
```

## Advanced Techniques

### Using the Streaming API

For a more seamless user experience, especially for real-time applications, you can use the **Streaming API for Dialogue**. This allows you to start playing the audio before the entire file has been generated, reducing perceived latency.

The streaming endpoint is `POST /v1/text-to-dialogue/stream`, and it returns the audio data in chunks. This is particularly useful for long-form content, as it provides a much better user experience than waiting for the entire file to be generated.

### Voice Customization

To create a truly unique listening experience, you can use a variety of voices from the ElevenLabs **Voice Library**, or you can clone your own voices using **Professional Voice Cloning** for the highest fidelity. Each speaker in your dialogue can have a distinct voice, adding to the realism of the conversation.

## Conclusion

By utilizing the ElevenLabs Text to Dialogue API, you can significantly enhance the audio capabilities of your `rhythm-lab-app`. This guide has provided a roadmap for implementing multi-host audio generation, from structuring your dialogue to handling long-form content. With these techniques, you can create engaging, conversational podcasts and other audio experiences that will captivate your audience.

## References

1.  [ElevenLabs Text to Dialogue Documentation](https://elevenlabs.io/docs/capabilities/text-to-dialogue)
2.  [ElevenLabs Text to Dialogue Quickstart](https://elevenlabs.io/docs/cookbooks/text-to-dialogue)
3.  [ElevenLabs API Reference - Create Dialogue](https://elevenlabs.io/docs/api-reference/text-to-dialogue/convert)
4.  [ElevenLabs API Reference - Stream Dialogue](https://elevenlabs.io/docs/api-reference/text-to-dialogue/stream)
