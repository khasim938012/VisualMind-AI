import { GoogleGenAI } from '@google/genai';
import dotenv from 'dotenv';
dotenv.config();

console.log("API KEY LOADED:", process.env.GEMINI_API_KEY ? "YES" : "NO", "Length:", process.env.GEMINI_API_KEY?.length);

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

async function test() {
    try {
        const responseStream = await ai.models.generateContentStream({
            model: 'gemini-3.6-flash',
            contents: 'Hello',
        });
        
        for await (const chunk of responseStream) {
            console.log(chunk.text);
        }
    } catch (e) {
        console.error("FAILED:", e.message);
    }
}
test();
