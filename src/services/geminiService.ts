import { GoogleGenAI, Type, Modality } from "@google/genai";
import { Entity } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || "" });

export async function generateSpeech(text: string) {
  console.log("Generating speech for:", text.substring(0, 50) + "...");
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text: `Say with the wisdom and warmth of a traditional storyteller: ${text}` }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Kore' }, // Kore has a warm, mature tone suitable for a Griot
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    if (!base64Audio) {
      console.warn("No audio data received from Gemini TTS");
    } else {
      console.log("Audio data received, length:", base64Audio.length);
    }
    return base64Audio;
  } catch (error) {
    console.error("Gemini TTS API error:", error);
    throw error;
  }
}

export async function processVideo(mediaBase64: string, mimeType: string) {
  const model = "gemini-3-flash-preview";
  const isAudio = mimeType.startsWith('audio/');

  const prompt = `
    Analyze this ${isAudio ? 'audio recording' : 'video'}.
    1. Provide a verbatim transcript.
    2. Provide a concise narrative summary.
    3. Extract key entities: People, Places, Events, and Movements.
    4. Provide technical metadata: duration, ${isAudio ? 'bitrate, sample rate' : 'resolution, frame rate'}.
    
    Return the result in JSON format with the following structure:
    {
      "title": "A compelling title for this oral history record",
      "transcript": "...",
      "summary": "...",
      "entities": [
        { "type": "People", "name": "...", "description": "..." },
        { "type": "Places", "name": "...", "description": "..." },
        { "type": "Events", "name": "...", "description": "..." },
        { "type": "Movements", "name": "...", "description": "..." }
      ],
      "metadata": {
        "duration": "...",
        "resolution": "...",
        "frame_rate": "..."
      }
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: {
      parts: [
        { inlineData: { data: mediaBase64, mimeType } },
        { text: prompt }
      ]
    },
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          transcript: { type: Type.STRING },
          summary: { type: Type.STRING },
          entities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["type", "name", "description"]
            }
          },
          metadata: {
            type: Type.OBJECT,
            properties: {
              duration: { type: Type.STRING },
              resolution: { type: Type.STRING },
              frame_rate: { type: Type.STRING }
            },
            required: ["duration", "resolution", "frame_rate"]
          }
        },
        required: ["title", "transcript", "summary", "entities", "metadata"]
      }
    }
  });

  return JSON.parse(response.text || "{}");
}

import { YoutubeTranscript } from 'youtube-transcript';

export async function processYoutubeUrl(url: string) {
  const model = "gemini-3-flash-preview";
  let transcriptText = "";

  // Attempt to fetch the actual transcript from YouTube first
  try {
    console.log("Attempting to fetch YouTube transcript for:", url);
    const transcript = await YoutubeTranscript.fetchTranscript(url);
    transcriptText = transcript.map(t => t.text).join(" ");
    console.log("Successfully fetched YouTube transcript, length:", transcriptText.length);
  } catch (error) {
    console.warn("Could not fetch YouTube transcript directly, falling back to URL context:", error);
  }

  const prompt = transcriptText 
    ? `
    Analyze this YouTube video transcript:
    ---
    ${transcriptText}
    ---
    1. Provide a verbatim transcript (if accessible) or a detailed scene-by-scene description of the cultural narrative.
    2. Provide a concise narrative summary.
    3. Extract key entities: People, Places, Events, and Movements.
    4. Provide technical metadata: duration, resolution, frame rate.
    
    Return the result in JSON format with the following structure:
    {
      "title": "A compelling title for this oral history record",
      "transcript": "...",
      "summary": "...",
      "entities": [
        { "type": "People", "name": "...", "description": "..." },
        { "type": "Places", "name": "...", "description": "..." },
        { "type": "Events", "name": "...", "description": "..." },
        { "type": "Movements", "name": "...", "description": "..." }
      ],
      "metadata": {
        "duration": "...",
        "resolution": "...",
        "frame_rate": "..."
      }
    }
    `
    : `
    Analyze the YouTube video at this URL: ${url}
    1. Provide a verbatim transcript (if accessible) or a detailed scene-by-scene description of the cultural narrative.
    2. Provide a concise narrative summary.
    3. Extract key entities: People, Places, Events, and Movements.
    4. Provide technical metadata: duration, resolution, frame rate.
    
    Return the result in JSON format with the following structure:
    {
      "title": "A compelling title for this oral history record",
      "transcript": "...",
      "summary": "...",
      "entities": [
        { "type": "People", "name": "...", "description": "..." },
        { "type": "Places", "name": "...", "description": "..." },
        { "type": "Events", "name": "...", "description": "..." },
        { "type": "Movements", "name": "...", "description": "..." }
      ],
      "metadata": {
        "duration": "...",
        "resolution": "...",
        "frame_rate": "..."
      }
    }
  `;

  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      tools: [{ urlContext: {} }, { googleSearch: {} }],
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          transcript: { type: Type.STRING },
          summary: { type: Type.STRING },
          entities: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                type: { type: Type.STRING },
                name: { type: Type.STRING },
                description: { type: Type.STRING }
              },
              required: ["type", "name", "description"]
            }
          },
          metadata: {
            type: Type.OBJECT,
            properties: {
              duration: { type: Type.STRING },
              resolution: { type: Type.STRING },
              frame_rate: { type: Type.STRING }
            },
            required: ["duration", "resolution", "frame_rate"]
          }
        },
        required: ["title", "transcript", "summary", "entities", "metadata"]
      }
    }
  });

  const result = JSON.parse(response.text || "{}");
  // If we fetched the actual transcript, use it instead of the AI's guess
  if (transcriptText && !result.transcript) {
    result.transcript = transcriptText;
  }
  return result;
}
export async function chatWithGriot(message: string, transcripts: string[]) {
  const model = "gemini-3-flash-preview";
  
  const systemInstruction = `
    You are a 'Griot', a traditional West African storyteller, historian, and cultural preserver. 
    Your primary goal is to act as a repository and disseminator of cultural knowledge, with an unwavering commitment to honesty and completeness.
    Answer questions only based on the content of the provided oral history transcripts. 
    Cite specific parts of the transcript when possible.
    
    Context Transcripts:
    ${transcripts.join("\n\n---\n\n")}
  `;

  const response = await ai.models.generateContent({
    model,
    contents: [{ parts: [{ text: message }] }],
    config: {
      systemInstruction,
    }
  });

  return response.text;
}
