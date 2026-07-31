import axios from 'axios';
import { dbAll } from './db';

const OLLAMA_URL = 'http://127.0.0.1:11434/api/generate';
const OLLAMA_MODEL = 'llama3';

export const askLLM = async (prompt: string, context?: string): Promise<{ text: string, blueprint: any }> => {
    // Fetch memory/facts
    const memories = await dbAll('SELECT * FROM memory ORDER BY timestamp DESC LIMIT 5');
    let memoryString = memories.map(m => `User previously taught you about ${m.topic}: ${m.fact}`).join('\n');
    
    const systemPrompt = `You are a highly intelligent, self-learning Zero-G Explainer AI.
You answer user questions and provide explanations. 
If the user's question relates to a specific concept, you must return a dual-stream response: a natural language explanation and a JSON blueprint for 3D visualization.
Format your output STRICTLY as follows:

<explanation>
Your conversational text goes here. Keep it engaging and concise.
</explanation>
<blueprint>
[
  { "type": "sphere", "name": "core", "color": "#ff0000", "position": [0,0,0] },
  { "type": "box", "name": "shell", "color": "#00ff00", "position": [2,0,0] }
]
</blueprint>

If the user is correcting you or providing a new fact (e.g., "Actually, X is Y"), acknowledge it and return an empty blueprint [].

Relevant Memory/Facts taught by user:
${memoryString}

Web Context (if any):
${context || 'None'}
`;

    const fullPrompt = `${systemPrompt}\nUser Question: ${prompt}`;

    try {
        const response = await axios.post(OLLAMA_URL, {
            model: OLLAMA_MODEL,
            prompt: fullPrompt,
            stream: false
        });

        const rawText = response.data.response;
        
        let explanation = "I'm sorry, I couldn't formulate an explanation.";
        let blueprint = [];

        const expMatch = rawText.match(/<explanation>([\s\S]*?)<\/explanation>/);
        if (expMatch) explanation = expMatch[1].trim();
        else explanation = rawText; // Fallback if format is missed

        const bpMatch = rawText.match(/<blueprint>([\s\S]*?)<\/blueprint>/);
        if (bpMatch) {
            try {
                blueprint = JSON.parse(bpMatch[1].trim());
            } catch(e) {
                console.error("Failed to parse blueprint JSON", e);
            }
        }

        return { text: explanation, blueprint };
    } catch (error) {
        console.error("Error communicating with Ollama:", error);
        return { text: "Error communicating with local AI. Is Ollama running on port 11434?", blueprint: [] };
    }
};
