import express from 'express';
import path from 'path';
import dotenv from 'dotenv';
import { GoogleGenAI } from '@google/genai';
import { createServer as createViteServer } from 'vite';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Lazy Gemini client helper
function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', time: new Date().toISOString() });
});

// AI Summarize PDF Text
app.post('/api/ai/summarize', async (req, res) => {
  try {
    const { text, language = 'en', mode = 'brief' } = req.body;
    if (!text || typeof text !== 'string' || text.trim().length === 0) {
      return res.status(400).json({ error: 'Text content is required for summarization.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }

    const prompt = `You are an expert document analyst. Analyze and summarize the following PDF document content.
Document text:
"""
${text.slice(0, 30000)}
"""

Requirements:
- Target Language: ${language === 'hi' ? 'Hindi (हिंदी)' : 'English'}
- Summary Style: ${mode === 'detailed' ? 'Detailed in-depth breakdown with sections and bullet points' : mode === 'action_items' ? 'Key action items and next steps' : 'Concise executive summary with 4-6 key takeaways'}
- Return clear markdown formatting with headings, bullet points, and highlight key stats or takeaways.
- Provide a 1-sentence "Bottom Line" at the top.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are a precise, articulate document processing assistant. Output clean markdown without conversational filler.',
      },
    });

    res.json({ summary: response.text });
  } catch (error: any) {
    console.error('Error in /api/ai/summarize:', error);
    res.status(500).json({ error: error.message || 'Failed to summarize document.' });
  }
});

// AI Chat with PDF
app.post('/api/ai/chat', async (req, res) => {
  try {
    const { documentText, messages, language = 'en' } = req.body;
    if (!documentText) {
      return res.status(400).json({ error: 'Document text is required.' });
    }
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'Valid chat messages array is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured in environment.' });
    }

    const lastMessage = messages[messages.length - 1].content;
    const historyText = messages
      .slice(0, -1)
      .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content}`)
      .join('\n');

    const prompt = `You are a helpful AI Document Assistant answering questions about this uploaded PDF document.
Use the document content strictly as your knowledge source. If information is not found in the document, clarify politely.

Document content:
"""
${documentText.slice(0, 35000)}
"""

Conversation history:
${historyText || '(No previous conversation)'}

User Question: "${lastMessage}"
Respond in: ${language === 'hi' ? 'Hindi (हिंदी) or Hinglish as natural to user' : 'English'}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        systemInstruction: 'You are a smart, accurate PDF Q&A assistant. Provide clear, structured answers with citations from the document where applicable.',
      },
    });

    res.json({ reply: response.text });
  } catch (error: any) {
    console.error('Error in /api/ai/chat:', error);
    res.status(500).json({ error: error.message || 'Failed to process document chat.' });
  }
});

// AI Quiz & Flashcards Generator from PDF
app.post('/api/ai/generate-quiz', async (req, res) => {
  try {
    const { text, language = 'en' } = req.body;
    if (!text) {
      return res.status(400).json({ error: 'Document text is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(500).json({ error: 'GEMINI_API_KEY is not configured.' });
    }

    const prompt = `Analyze this PDF document content and create 5 multiple-choice questions with answers, and 5 key flashcards for studying.
Document text:
"""
${text.slice(0, 25000)}
"""

Language: ${language === 'hi' ? 'Hindi' : 'English'}

Return ONLY valid JSON with this exact structure:
{
  "questions": [
    {
      "question": "string",
      "options": ["option A", "option B", "option C", "option D"],
      "correctIndex": 0,
      "explanation": "string"
    }
  ],
  "flashcards": [
    {
      "term": "string",
      "definition": "string"
    }
  ]
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.7-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/generate-quiz:', error);
    res.status(500).json({ error: error.message || 'Failed to generate quiz.' });
  }
});

// AI Face Detection for Biometric Passport Photo Cropping
app.post('/api/ai/detect-face', async (req, res) => {
  try {
    const { image } = req.body;
    if (!image) {
      return res.status(400).json({ error: 'Image data is required.' });
    }

    const ai = getGeminiClient();
    if (!ai) {
      return res.status(503).json({ error: 'AI client not initialized.' });
    }

    const match = image.match(/^data:([^;]+);base64,(.+)$/);
    const mimeType = match ? match[1] : 'image/jpeg';
    const base64Data = match ? match[2] : image;

    const prompt = `Detect the primary human face in this photo for cropping an official passport photo.
Return ONLY valid JSON with this exact schema:
{
  "detected": true,
  "box_2d": [ymin, xmin, ymax, xmax],
  "confidence": 0.96
}
Note: ymin, xmin, ymax, xmax must be normalized integers from 0 to 1000 representing [top, left, bottom, right] of the face/head.
If no face is detected, return:
{
  "detected": false,
  "box_2d": null,
  "confidence": 0
}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: [
        {
          inlineData: {
            mimeType,
            data: base64Data,
          },
        },
        { text: prompt },
      ],
      config: {
        responseMimeType: 'application/json',
      },
    });

    const parsed = JSON.parse(response.text || '{}');
    res.json(parsed);
  } catch (error: any) {
    console.error('Error in /api/ai/detect-face:', error);
    res.status(500).json({ error: error.message || 'Face detection failed.' });
  }
});

async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`PDF Studio server running at http://0.0.0.0:${PORT}`);
  });
}

startServer();
