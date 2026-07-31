import { GoogleGenAI } from '@google/genai';
import { dbAll } from './db';
import dotenv from 'dotenv';
dotenv.config();

const apiKey = process.env.GEMINI_API_KEY;
if (!apiKey) {
    console.error("GEMINI_API_KEY is missing in .env");
}

const ai = new GoogleGenAI({ apiKey: apiKey });

export const askLLMStream = async (prompt: string, context: string, onData: (chunk: string) => void) => {
    const memories = await dbAll('SELECT * FROM memory ORDER BY timestamp DESC LIMIT 5');
    let memoryString = memories.map(m => `User previously taught you about ${m.topic}: ${m.fact}`).join('\n');
    
    const systemPrompt = `You are a highly intelligent, real-time Voice Assistant.
CRITICAL INSTRUCTION: You MUST select the BEST visual medium for your explanation and you MUST output the visual tag at the VERY BEGINNING of your response before any conversational text.

Visual Tags Available:
1. [MODEL: engine] -> Use ONLY when the user specifically asks about how a CAR ENGINE works. This will load an interactive 3D engine.
2. [VIDEO: search_term] -> Use if explaining a complex process or moving mechanism that is NOT a car engine.
3. [IMAGE: search_term] -> Use for specific people, places, or branded items (e.g. "Tata Punch", "Eiffel Tower", "Car", "Mountain").
4. [NONE] -> Use if answering a purely conversational question (e.g. "how are you?").

IF YOU CHOOSE [MODEL: engine], you MUST ALSO output JSON animation coordinates sprinkled throughout your text to manipulate the engine in real-time. 
Use this exact tag format: [ANIMATE: {"pistons": "fast" | "slow" | "stop", "blockOpacity": 1.0 | 0.3, "explode": true | false }]

IF YOU CHOOSE [IMAGE], you MUST act like a dynamic slideshow. You must place the FIRST [IMAGE: search_term] tag at the very start of your response, and sprinkle multiple [IMAGE: search_term] tags throughout your response whenever you introduce a new sub-topic or noun, so the image changes in real-time as you speak!

Example 1: [IMAGE: Solar System] The Solar System is huge. [IMAGE: Sun] At the center is the sun. [IMAGE: Earth] We live on Earth, the third planet.
Example 2: [MODEL: engine] Let's look inside. [ANIMATE: {"blockOpacity": 0.3, "pistons": "stop", "explode": false}] The engine block protects the cylinders.

Relevant Memory/Facts:
${memoryString}

Web Context:
${context || 'None'}
`;

    try {
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-3.6-flash',
            contents: [
                { role: 'user', parts: [{ text: systemPrompt + '\n\nUser Question: ' + prompt }] }
            ],
            config: {
                systemInstruction: systemPrompt
            }
        });

        for await (const chunk of responseStream) {
            if (chunk.text) {
                // Since our frontend VoiceController expects small chunks, and Ollama sends words,
                // Gemini sends larger chunks. This is perfectly fine since the VoiceController uses a rawBuffer now.
                onData(chunk.text);
            }
        }
    } catch (error) {
        console.error("Error communicating with Gemini:", error);
        onData(" I'm having trouble reaching my Gemini brain right now.");
    }
};
