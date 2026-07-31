import express from 'express';
import cors from 'cors';
import { dbRun, dbAll } from './db';
import { askLLM } from './llm';
import { fetchWebContext } from './scraper';

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Main Chat Endpoint
app.post('/api/chat', async (req, res) => {
    const { message } = req.body;
    if (!message) return res.status(400).json({ error: "Message is required" });

    try {
        // 1. Fetch live web context if it looks like a factual query
        const webContext = await fetchWebContext(message);

        // 2. Ask local Ollama LLM
        const { text, blueprint } = await askLLM(message, webContext);

        // 3. Save to History
        await dbRun('INSERT INTO history (role, content) VALUES (?, ?)', ['user', message]);
        await dbRun('INSERT INTO history (role, content) VALUES (?, ?)', ['assistant', text]);

        // 4. Send Response
        res.json({ text, blueprint });
    } catch (error) {
        console.error("Chat error", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Correct the AI / Add to Memory (Self-Learning)
app.post('/api/memory', async (req, res) => {
    const { topic, fact } = req.body;
    if (!topic || !fact) return res.status(400).json({ error: "Topic and fact are required" });

    try {
        await dbRun('INSERT INTO memory (topic, fact) VALUES (?, ?)', [topic, fact]);
        res.json({ success: true });
    } catch (error) {
        console.error("Memory error", error);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Get Chat History
app.get('/api/history', async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM history ORDER BY timestamp DESC LIMIT 50');
        res.json(rows.reverse()); // return in chronological order
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
