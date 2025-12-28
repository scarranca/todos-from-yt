const RE_YOUTUBE = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i;
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

    // Extract captions data from the page
    const captionsMatch = videoPageHtml.match(/"captions":\s*(\{[^}]+?"captionTracks":\s*\[[^\]]+\][^}]*\})/);

    if (!captionsMatch) {
      // Try alternative pattern for playerCaptionsTracklistRenderer
      const altMatch = videoPageHtml.match(/"playerCaptionsTracklistRenderer":\s*(\{.*?"captionTracks":\s*\[.*?\])/s);
      if (!altMatch) {
        throw new Error('No captions available for this video');
      }
    }

    // Find caption track URL
    const captionUrlMatch = videoPageHtml.match(/"captionTracks":\s*\[\s*\{[^}]*"baseUrl":\s*"([^"]+)"/);

    if (!captionUrlMatch) {
      throw new Error('Could not find caption track URL');
    }

    let captionUrl = captionUrlMatch[1].replace(/\\u0026/g, '&');

    // Request XML format for easier parsing
    if (!captionUrl.includes('fmt=')) {
      captionUrl += '&fmt=json3';
    }

    // Fetch the captions
    const captionsResponse = await fetch(captionUrl, {
      headers: {
        'User-Agent': USER_AGENT,
      }
    });

    if (!captionsResponse.ok) {
      throw new Error(`Failed to fetch captions: ${captionsResponse.status}`);
    }

    const captionsData = await captionsResponse.json();

    if (!captionsData.events || captionsData.events.length === 0) {
      throw new Error('Caption data is empty');
    }

    // Extract text from caption events
    const transcriptParts = [];

    for (const event of captionsData.events) {
      if (event.segs) {
        for (const seg of event.segs) {
          if (seg.utf8) {
            transcriptParts.push(seg.utf8);
          }
        }
      }
    }

    const fullTranscript = transcriptParts
      .join('')
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
