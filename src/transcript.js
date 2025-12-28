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

    console.log('Caption URL found:', captionUrl.substring(0, 100) + '...');

    // Try JSON3 format first
    let jsonUrl = captionUrl;
    if (captionUrl.includes('fmt=')) {
      jsonUrl = captionUrl.replace(/fmt=[^&]+/, 'fmt=json3');
    } else {
      jsonUrl = captionUrl + '&fmt=json3';
    }

    const captionsResponse = await fetch(jsonUrl, {
      headers: {
        'User-Agent': USER_AGENT,
      }
    });

    if (!captionsResponse.ok) {
      throw new Error(`Failed to fetch captions: ${captionsResponse.status}`);
    }

    const captionsText = await captionsResponse.text();
    console.log('Caption response length:', captionsText.length);
    console.log('Caption response preview:', captionsText.substring(0, 200));

    // Try to parse as JSON3 format
    let transcriptParts = [];

    try {
      const captionsData = JSON.parse(captionsText);

      if (captionsData.events) {
        for (const event of captionsData.events) {
          if (event.segs) {
            for (const seg of event.segs) {
              if (seg.utf8 && seg.utf8.trim()) {
                transcriptParts.push(seg.utf8);
              }
            }
          }
        }
      }
    } catch (jsonError) {
      console.log('JSON parse failed, trying XML...');

      // Fallback: try XML format
      const xmlResponse = await fetch(captionUrl, {
        headers: {
          'User-Agent': USER_AGENT,
        }
      });
      const xmlText = await xmlResponse.text();
      console.log('XML response preview:', xmlText.substring(0, 200));

      // Parse XML - extract text content from <text> tags
      const textMatches = xmlText.matchAll(/<text[^>]*>([^<]*)<\/text>/g);

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
    }

    if (transcriptParts.length === 0) {
      throw new Error('Could not parse transcript data');
    }

    console.log('Found', transcriptParts.length, 'transcript segments');

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
