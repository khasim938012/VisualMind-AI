import axios from 'axios';
import { dbAll } from './db';

const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = 'llama3';

export const askLLMStream = async (prompt: string, context: string, onData: (chunk: string) => void) => {
    const memories = await dbAll('SELECT * FROM memory ORDER BY timestamp DESC LIMIT 5');
    let memoryString = memories.map(m => `User previously taught you about ${m.topic}: ${m.fact}`).join('\n');
    
    const systemPrompt = `You are a highly intelligent, real-time Voice Assistant.
Answer the user's question directly, clearly, and conversationally. Do NOT use markdown.
If the question is about a specific physical object or person (e.g., a car, a planet, a historical figure), start your response EXACTLY with this tag: [IMAGE: search_term] where search_term is the name of the object.
Example: [IMAGE: Tata Punch] The Tata Punch is a compact SUV...

Relevant Memory/Facts:
${memoryString}

Web Context:
${context || 'None'}
`;

    const fullPrompt = `${systemPrompt}\nUser Question: ${prompt}`;

    try {
        const response = await axios.post(OLLAMA_URL, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: true
        }, {
            responseType: 'stream'
        });

        return new Promise<void>((resolve, reject) => {
            response.data.on('data', (chunk: Buffer) => {
                const lines = chunk.toString().split('\n').filter(line => line.trim() !== '');
                for (const line of lines) {
                    try {
                        const parsed = JSON.parse(line);
                        if (parsed.response) {
                            onData(parsed.response);
                        }
                    } catch (e) {
                        // ignore parse errors for partial chunks
                    }
                }
            });

            response.data.on('end', () => {
                resolve();
            });

            response.data.on('error', (err: any) => {
                reject(err);
            });
        });
    } catch (error) {
        console.error("Error communicating with Ollama:", error);
        onData(" I'm having trouble reaching my brain right now.");
    }
};
