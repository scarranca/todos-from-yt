import express from 'express';
import dotenv from 'dotenv';
import { extractTranscript } from './transcript.js';
import { generateTodos } from './ai-providers.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;

// Health check endpoint (no auth required)
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Main endpoint to process YouTube videos
app.post('/api/analyze', authMiddleware, async (req, res) => {
  try {
    const { url, customPrompt } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    // Get transcript
    const transcript = await extractTranscript(videoId);
    if (!transcript) {
      return res.status(404).json({ error: 'Could not extract transcript from video' });
    }

    // Generate todos using AI
    const todos = await generateTodos(transcript, customPrompt);

    res.json({
      success: true,
      videoId,
      todos
    });

  } catch (error) {
    console.error('Error processing video:', error);
    res.status(500).json({
      error: 'Failed to process video',
      message: error.message
    });
  }
});

// Endpoint to just get transcript
app.post('/api/transcript', authMiddleware, async (req, res) => {
  try {
    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'YouTube URL is required' });
    }

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Invalid YouTube URL' });
    }

    const transcript = await extractTranscript(videoId);
    if (!transcript) {
      return res.status(404).json({ error: 'Could not extract transcript from video' });
    }

    res.json({
      success: true,
      videoId,
      transcript
    });

  } catch (error) {
    console.error('Error extracting transcript:', error);
    res.status(500).json({
      error: 'Failed to extract transcript',
      message: error.message
    });
  }
});

// Get current configuration (without exposing secrets)
app.get('/api/config', authMiddleware, (req, res) => {
  res.json({
    provider: process.env.AI_PROVIDER || 'anthropic',
    model: process.env.AI_MODEL || 'default'
  });
});

function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([^&\n?#]+)/,
    /^([a-zA-Z0-9_-]{11})$/  // Direct video ID
  ];

  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match) return match[1];
  }
  return null;
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`AI Provider: ${process.env.AI_PROVIDER || 'anthropic'}`);
  console.log(`AI Model: ${process.env.AI_MODEL || 'default'}`);
});
