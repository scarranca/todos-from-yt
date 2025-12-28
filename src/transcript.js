const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function extractTranscript(videoId) {
  try {
    // Fetch the video page to get caption track info
    const videoPageResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      headers: {
        'User-Agent': USER_AGENT,
        'Accept-Language': 'en-US,en;q=0.9',
      }
    });

    if (!videoPageResponse.ok) {
      throw new Error(`Failed to fetch video page: ${videoPageResponse.status}`);
    }

    const videoPageHtml = await videoPageResponse.text();

    // Find caption track URL - try multiple patterns
    let captionUrl = null;

    // Pattern 1: Look for baseUrl in captionTracks
    const captionUrlMatch = videoPageHtml.match(/"captionTracks":\s*\[\s*\{[^}]*"baseUrl":\s*"([^"]+)"/);
    if (captionUrlMatch) {
      captionUrl = captionUrlMatch[1].replace(/\\u0026/g, '&');
    }

    // Pattern 2: Look for timedtext URL directly
    if (!captionUrl) {
      const timedTextMatch = videoPageHtml.match(/https:\/\/www\.youtube\.com\/api\/timedtext[^"]+/);
      if (timedTextMatch) {
        captionUrl = timedTextMatch[0].replace(/\\u0026/g, '&');
      }
    }

    if (!captionUrl) {
      throw new Error('No captions available for this video');
    }

    // Fetch as XML (default format, more reliable)
    const captionsResponse = await fetch(captionUrl, {
      headers: {
        'User-Agent': USER_AGENT,
      }
    });

    if (!captionsResponse.ok) {
      throw new Error(`Failed to fetch captions: ${captionsResponse.status}`);
    }

    const captionsXml = await captionsResponse.text();

    // Parse XML - extract text content from <text> tags
    const textMatches = captionsXml.matchAll(/<text[^>]*>([^<]*)<\/text>/g);
    const transcriptParts = [];

    for (const match of textMatches) {
      let text = match[1];
      // Decode HTML entities
      text = text
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/&apos;/g, "'");

      if (text.trim()) {
        transcriptParts.push(text);
      }
    }

    if (transcriptParts.length === 0) {
      throw new Error('Could not parse transcript data');
    }

    const fullTranscript = transcriptParts
      .join(' ')
      .replace(/\n/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

    if (!fullTranscript) {
      throw new Error('Transcript is empty');
    }

    return fullTranscript;

  } catch (error) {
    console.error('Transcript extraction error:', error);

    if (error.message.includes('No captions') || error.message.includes('Could not find caption')) {
      throw new Error('No captions/transcript available for this video');
    }

    throw new Error(`Failed to extract transcript: ${error.message}`);
  }
}
