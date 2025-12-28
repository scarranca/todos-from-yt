# Todos from YouTube

API server that extracts YouTube video transcripts and generates actionable todos/learning items using AI.

## Features

- Extract transcripts from YouTube videos
- Generate actionable todos using AI (Claude, OpenAI, or Gemini)
- Configurable AI provider and model
- API key authentication
- Docker ready for easy deployment

## Quick Start

### Using Docker (Recommended)

1. Copy the environment file:
```bash
cp .env.example .env
```

2. Edit `.env` with your configuration:
```bash
AI_PROVIDER=anthropic
ANTHROPIC_API_KEY=your-key-here
SERVER_API_KEY=your-random-secret-key
```

3. Run with Docker Compose:
```bash
docker-compose up -d
```

### Local Development

1. Install dependencies:
```bash
npm install
```

2. Copy and configure environment:
```bash
cp .env.example .env
# Edit .env with your settings
```

3. Run the server:
```bash
npm run dev
```

## API Endpoints

### POST /api/analyze

Analyze a YouTube video and generate todos.

**Headers:**
- `X-API-Key: your-server-api-key` (or `Authorization: Bearer your-server-api-key`)

**Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID",
  "customPrompt": "Optional custom prompt for AI analysis"
}
```

**Response:**
```json
{
  "success": true,
  "videoId": "VIDEO_ID",
  "todos": [
    {
      "task": "Learn about new Claude Code features",
      "priority": "high",
      "category": "learn",
      "details": "Watch the demo section at 5:30"
    }
  ]
}
```

### POST /api/transcript

Get just the transcript without AI analysis.

**Headers:**
- `X-API-Key: your-server-api-key`

**Body:**
```json
{
  "url": "https://www.youtube.com/watch?v=VIDEO_ID"
}
```

### GET /api/config

Get current AI configuration (provider and model).

### GET /health

Health check endpoint (no authentication required).

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `PORT` | Server port | `3000` |
| `SERVER_API_KEY` | API key to protect your server | (none - unprotected) |
| `AI_PROVIDER` | AI provider: `anthropic`, `openai`, or `gemini` | `anthropic` |
| `AI_MODEL` | Model to use (provider-specific) | Provider default |
| `ANTHROPIC_API_KEY` | Anthropic API key | - |
| `OPENAI_API_KEY` | OpenAI API key | - |
| `GEMINI_API_KEY` | Google Gemini API key | - |

## Example Usage

```bash
# Analyze a video
curl -X POST http://localhost:3000/api/analyze \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-server-api-key" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'

# Get transcript only
curl -X POST http://localhost:3000/api/transcript \
  -H "Content-Type: application/json" \
  -H "X-API-Key: your-server-api-key" \
  -d '{"url": "https://www.youtube.com/watch?v=dQw4w9WgXcQ"}'
```

## Deployment

This server is designed to be deployed on platforms like:
- Railway
- Render
- Fly.io
- Any Docker-compatible platform

Set your environment variables in the platform's dashboard and deploy using the included Dockerfile.
