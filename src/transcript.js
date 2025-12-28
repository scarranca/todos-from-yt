import { Innertube } from 'youtubei.js';

let innertube = null;

async function getClient() {
  if (!innertube) {
    innertube = await Innertube.create();
  }
  return innertube;
}

export async function extractTranscript(videoId) {
  try {
    const client = await getClient();
    const info = await client.getInfo(videoId);

    const transcriptInfo = await info.getTranscript();

    if (!transcriptInfo || !transcriptInfo.transcript || !transcriptInfo.transcript.content) {
      throw new Error('No transcript available for this video');
    }

    const segments = transcriptInfo.transcript.content.body.initial_segments;

    if (!segments || segments.length === 0) {
      throw new Error('Transcript is empty');
    }

    // Extract text from each segment
    const fullTranscript = segments
      .map(segment => {
        if (segment.snippet && segment.snippet.text) {
          return segment.snippet.text;
        }
        return '';
      })
      .filter(text => text.length > 0)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!fullTranscript) {
      throw new Error('Could not extract text from transcript');
    }

    return fullTranscript;
  } catch (error) {
    console.error('Transcript extraction error:', error);

    if (error.message.includes('No transcript')) {
      throw new Error('No transcript/captions available for this video');
    }
    if (error.message.includes('private') || error.message.includes('unavailable')) {
      throw new Error('Video is unavailable or private');
    }

    throw new Error(`Failed to extract transcript: ${error.message}`);
  }
}
