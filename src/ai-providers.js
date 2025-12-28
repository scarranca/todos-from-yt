import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import { GoogleGenerativeAI } from '@google/generative-ai';

const DEFAULT_PROMPT = `Analyze this YouTube video transcript and extract actionable todos/learning items.

For each item, provide:
- A clear, actionable task or learning point
- Priority (high/medium/low)
- Category (e.g., "learn", "practice", "research", "implement", "explore")

Format your response as a JSON array with objects containing: "task", "priority", "category", "details" (optional additional context).

Focus on practical, actionable items that someone could add to their learning or work todo list.`;

export async function generateTodos(transcript, customPrompt) {
  const provider = process.env.AI_PROVIDER || 'anthropic';
  const prompt = customPrompt || DEFAULT_PROMPT;

  const fullPrompt = `${prompt}\n\nTranscript:\n${transcript}`;

  switch (provider.toLowerCase()) {
    case 'anthropic':
    case 'claude':
      return await generateWithClaude(fullPrompt);
    case 'openai':
    case 'gpt':
      return await generateWithOpenAI(fullPrompt);
    case 'gemini':
    case 'google':
      return await generateWithGemini(fullPrompt);
    default:
      throw new Error(`Unsupported AI provider: ${provider}`);
  }
}

async function generateWithClaude(prompt) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error('ANTHROPIC_API_KEY is not set');
  }

  const client = new Anthropic({ apiKey });
  const model = process.env.AI_MODEL || 'claude-sonnet-4-20250514';

  const response = await client.messages.create({
    model,
    max_tokens: 4096,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ]
  });

  return parseAIResponse(response.content[0].text);
}

async function generateWithOpenAI(prompt) {
  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    throw new Error('OPENAI_API_KEY is not set');
  }

  const client = new OpenAI({ apiKey });
  const model = process.env.AI_MODEL || 'gpt-4o';

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: prompt
      }
    ],
    max_tokens: 4096
  });

  return parseAIResponse(response.choices[0].message.content);
}

async function generateWithGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set');
  }

  const genAI = new GoogleGenerativeAI(apiKey);
  const model = process.env.AI_MODEL || 'gemini-1.5-flash';
  const generativeModel = genAI.getGenerativeModel({ model });

  const result = await generativeModel.generateContent(prompt);
  const response = await result.response;

  return parseAIResponse(response.text());
}

function parseAIResponse(text) {
  try {
    // Try to extract JSON from the response
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0]);
    }

    // If no JSON array found, try parsing the whole response
    return JSON.parse(text);
  } catch (error) {
    // If parsing fails, return the raw text wrapped in a structure
    return {
      raw: text,
      parsed: false,
      message: 'Could not parse AI response as JSON, returning raw text'
    };
  }
}
