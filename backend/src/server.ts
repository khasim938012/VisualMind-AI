import express from 'express';
import cors from 'cors';
import { dbRun, dbAll } from './db';
import { askLLMStream } from './llm';
import { fetchWebContext } from './scraper';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 3001;

app.use(cors());
app.use(express.json());

// Server-Sent Events Endpoint for real-time streaming
app.get('/api/chat/stream', async (req, res) => {
    const message = req.query.message as string;
    if (!message) return res.status(400).json({ error: "Message is required" });

    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders(); // flush the headers to establish SSE

    try {
        const webContext = await fetchWebContext(message);
        let fullResponse = "";

        await askLLMStream(message, webContext, (chunk) => {
            fullResponse += chunk;
            // Send chunk to client
            res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
        });

        // Save to DB after stream finishes
        await dbRun('INSERT INTO history (role, content) VALUES (?, ?)', ['user', message]);
        await dbRun('INSERT INTO history (role, content) VALUES (?, ?)', ['assistant', fullResponse.replace(/\[IMAGE:.*?\]/g, '').trim()]);

        res.write(`data: [DONE]\n\n`);
        res.end();
    } catch (error) {
        console.error("Stream error", error);
        res.write(`data: ${JSON.stringify({ error: "Internal Server Error" })}\n\n`);
        res.end();
    }
});

app.post('/api/memory', async (req, res) => {
    const { topic, fact } = req.body;
    if (!topic || !fact) return res.status(400).json({ error: "Topic and fact are required" });

    try {
        await dbRun('INSERT INTO memory (topic, fact) VALUES (?, ?)', [topic, fact]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const rows = await dbAll('SELECT * FROM history ORDER BY timestamp DESC LIMIT 50');
        res.json(rows.reverse());
    } catch (error) {
        res.status(500).json({ error: "Internal Server Error" });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
