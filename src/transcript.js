import { YoutubeTranscript } from 'youtube-transcript';

export async function extractTranscript(videoId) {
  try {
    const transcriptItems = await YoutubeTranscript.fetchTranscript(videoId);

    // Combine all transcript segments into a single text
    const fullTranscript = transcriptItems
      .map(item => item.text)
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    return fullTranscript;
  } catch (error) {
    console.error('Transcript extraction error:', error);
    throw new Error(`Failed to extract transcript: ${error.message}`);
  }
}
