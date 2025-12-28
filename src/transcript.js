import { YoutubeTranscript } from 'youtube-transcript';

export async function extractTranscript(videoId) {
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    if (!transcriptItems || transcriptItems.length === 0) {
      throw new Error('No transcript available for this video. The video may not have captions enabled.');
    }

    // Combine all transcript segments into a single text
    const fullTranscript = transcriptItems
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!fullTranscript) {
      throw new Error('Transcript is empty');
    }

    return fullTranscript;
  } catch (error) {
    console.error('Transcript extraction error:', error);

    // Provide more specific error messages
    if (error.message.includes('Transcript is disabled')) {
      throw new Error('Transcripts are disabled for this video');
    }
    if (error.message.includes('No transcript available')) {
      throw new Error(error.message);
    }
    if (error.message.includes('Video unavailable')) {
      throw new Error('Video is unavailable or private');
    }

    throw new Error(`Failed to extract transcript: ${error.message}`);
  }
}
