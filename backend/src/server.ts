import express from 'express';
import cors from 'cors';
import { dbRun, dbAll } from './db';
import { askLLMStream, askLLM } from './llm';
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
    const sessionId = (req.query.sessionId as string) || 'default';
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
        const historyCount = await dbAll('SELECT COUNT(*) as count FROM history WHERE session_id = ?', [sessionId]);
        if (historyCount && historyCount[0] && historyCount[0].count === 0) {
            let shortTitle = message.substring(0, 30);
            try {
                shortTitle = await askLLM(`Generate a 2 to 3 word title for this chat based on the user's first message: "${message}". Reply ONLY with the title, no quotes, no extra text.`, "You are a summarizer.");
                shortTitle = shortTitle.trim();
            } catch(e) {}
            await dbRun('UPDATE sessions SET title = ? WHERE id = ?', [shortTitle, sessionId]);
        }

        await dbRun('INSERT INTO history (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'user', message]);
        await dbRun('INSERT INTO history (session_id, role, content) VALUES (?, ?, ?)', [sessionId, 'assistant', fullResponse.replace(/\[IMAGE:.*?\]/g, '').trim()]);

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

// Get all sessions
app.get('/api/sessions', async (req, res) => {
    try {
        const sessions = await dbAll('SELECT * FROM sessions ORDER BY timestamp DESC');
        res.json(sessions);
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

// Create new session
app.post('/api/sessions', express.json(), async (req, res) => {
    try {
        const { id, title } = req.body;
        await dbRun('INSERT INTO sessions (id, title) VALUES (?, ?)', [id, title]);
        res.json({ success: true });
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.get('/api/history', async (req, res) => {
    try {
        const sessionId = req.query.sessionId || 'default';
        const history = await dbAll('SELECT * FROM history WHERE session_id = ? ORDER BY timestamp ASC', [sessionId]);
        res.json(history);
    } catch (e) {
        res.status(500).json({ error: 'Database error' });
    }
});

app.listen(PORT, () => {
    console.log(`Backend server running on http://localhost:${PORT}`);
});
