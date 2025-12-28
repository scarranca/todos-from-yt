const USER_AGENT = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

export async function extractTranscript(videoId) {
  const errors = [];

  // Method 1: Try video.google.com/timedtext endpoint
  try {
    const transcript = await tryTimedTextEndpoint(videoId);
    if (transcript) return transcript;
  } catch (e) {
    errors.push(`timedtext: ${e.message}`);
  }

  // Method 2: Try extracting from YouTube page
  try {
    const transcript = await tryYouTubePageExtraction(videoId);
    if (transcript) return transcript;
  } catch (e) {
    errors.push(`page extraction: ${e.message}`);
  }

  throw new Error(`Could not extract transcript. Tried: ${errors.join('; ')}`);
}

async function tryTimedTextEndpoint(videoId) {
  // Try different language codes
  const languages = ['en', 'en-US', 'en-GB', 'a.en', 'es', 'auto'];

  for (const lang of languages) {
    try {
      const url = `https://video.google.com/timedtext?lang=${lang}&v=${videoId}`;
      console.log(`Trying timedtext: ${url}`);

      const response = await fetch(url, {
        headers: { 'User-Agent': USER_AGENT }
      });

      if (!response.ok) continue;

      const xml = await response.text();
      if (!xml || xml.length < 50) continue;

      console.log(`Got response for lang=${lang}, length=${xml.length}`);

      const transcript = parseTimedTextXml(xml);
      if (transcript) return transcript;
    } catch (e) {
      console.log(`timedtext lang=${lang} failed:`, e.message);
    }
  }

  return null;
}

async function tryYouTubePageExtraction(videoId) {
  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      'User-Agent': USER_AGENT,
      'Accept-Language': 'en-US,en;q=0.9',
    }
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch video page: ${response.status}`);
  }

  const html = await response.text();

  // Try to find caption tracks in the page data
  const captionTracksMatch = html.match(/"captionTracks":\s*(\[[\s\S]*?\])/);

  if (!captionTracksMatch) {
    throw new Error('No caption tracks found in page');
  }

  let captionTracks;
  try {
    // Fix escaped characters and parse
    const tracksJson = captionTracksMatch[1]
      .replace(/\\"/g, '"')
      .replace(/\\u0026/g, '&');
    captionTracks = JSON.parse(tracksJson);
  } catch (e) {
    throw new Error('Failed to parse caption tracks JSON');
  }

  if (!captionTracks || captionTracks.length === 0) {
    throw new Error('No caption tracks available');
  }

  // Find English track or first available
  let track = captionTracks.find(t =>
    t.languageCode === 'en' || t.languageCode?.startsWith('en')
  ) || captionTracks[0];

  if (!track?.baseUrl) {
    throw new Error('No valid caption track URL');
  }

  let captionUrl = track.baseUrl.replace(/\\u0026/g, '&');
  console.log('Found caption URL from page:', captionUrl.substring(0, 80) + '...');

  // Fetch the captions
  const captionResponse = await fetch(captionUrl, {
    headers: { 'User-Agent': USER_AGENT }
  });

  if (!captionResponse.ok) {
    throw new Error(`Caption fetch failed: ${captionResponse.status}`);
  }

  const captionData = await captionResponse.text();
  console.log('Caption data length:', captionData.length);
  console.log('=== FULL CAPTION DATA START ===');
  console.log(captionData.substring(0, 2000));
  console.log('=== FULL CAPTION DATA END ===');

  // Try parsing as XML first
  let transcript = parseTimedTextXml(captionData);
  if (transcript) {
    console.log('Parsed as XML successfully');
    return transcript;
  }

  // Try parsing as JSON3
  transcript = parseJson3Format(captionData);
  if (transcript) {
    console.log('Parsed as JSON3 successfully');
    return transcript;
  }

  // Try srv3 format (YouTube's newer format)
  transcript = parseSrv3Format(captionData);
  if (transcript) {
    console.log('Parsed as srv3 successfully');
    return transcript;
  }

  throw new Error('Could not parse caption data');
}

function parseTimedTextXml(xml) {
  const parts = [];
  const matches = xml.matchAll(/<text[^>]*>([^<]*)<\/text>/g);

  for (const match of matches) {
    let text = match[1]
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/\\n/g, ' ');

    if (text.trim()) {
      parts.push(text.trim());
    }
  }

  if (parts.length === 0) return null;

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function parseJson3Format(data) {
  try {
    const json = JSON.parse(data);
    if (!json.events) return null;

    const parts = [];
    for (const event of json.events) {
      if (event.segs) {
        for (const seg of event.segs) {
          if (seg.utf8?.trim()) {
            parts.push(seg.utf8.trim());
          }
        }
      }
    }

    if (parts.length === 0) return null;
    return parts.join(' ').replace(/\s+/g, ' ').trim();
  } catch {
    return null;
  }
}

function parseSrv3Format(data) {
  // srv3 format uses <p> tags with <s> segments
  const parts = [];

  // Try matching <p> tags with nested content
  const pMatches = data.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g);
  for (const match of pMatches) {
    const content = match[1];
    // Extract text from <s> tags or direct content
    const sMatches = content.matchAll(/<s[^>]*>([^<]*)<\/s>/g);
    let hasS = false;
    for (const sMatch of sMatches) {
      hasS = true;
      if (sMatch[1]?.trim()) {
        parts.push(decodeEntities(sMatch[1].trim()));
      }
    }
    // If no <s> tags, use the content directly
    if (!hasS && content.trim()) {
      // Remove any remaining tags
      const cleanText = content.replace(/<[^>]+>/g, '').trim();
      if (cleanText) {
        parts.push(decodeEntities(cleanText));
      }
    }
  }

  // Also try body > p structure
  if (parts.length === 0) {
    const bodyMatch = data.match(/<body[^>]*>([\s\S]*?)<\/body>/);
    if (bodyMatch) {
      const bodyContent = bodyMatch[1];
      const textContent = bodyContent.replace(/<[^>]+>/g, ' ').trim();
      if (textContent) {
        parts.push(decodeEntities(textContent));
      }
    }
  }

  if (parts.length === 0) return null;
  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

function decodeEntities(text) {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(code));
}
