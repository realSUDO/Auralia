const https = require("https");

const LASTFM_API_KEY = process.env.LASTFM_API_KEY;

/**
 * Parse a messy YouTube title into { artist, track }
 * e.g. "Ishq Samundar - Full Video | Kaante | Sunidhi Chauhan, Anand Raj Anand"
 *   -> { artist: "Sunidhi Chauhan", track: "Ishq Samundar" }
 */
function parseTitle(title) {
  const clean = title.replace(/\(.*?\)/g, "").replace(/\[.*?\]/g, "").trim();
  const pipeParts = clean.split(/\s*\|\s*/).map(p => p.trim()).filter(Boolean);
  const dashParts = clean.split(/\s*-\s*/).map(p => p.trim()).filter(Boolean);

  // "Song - Lyrical/Official/Audio | Cast | Singer | ..." (Bollywood format)
  // detect if dashParts[1] is a descriptor word, not an artist
  const DESCRIPTORS = /^(lyrical|official|audio|video|full|hd|4k|ft|feat|remix|cover|reprise|unplugged)/i;
  if (dashParts.length >= 2 && DESCRIPTORS.test(dashParts[1]) && pipeParts.length >= 3) {
    // song = dashParts[0], singer = last meaningful pipe chunk before album/label
    // Try to find a known singer by picking the pipe chunk that looks like a person name (no spaces = likely artist)
    const singer = pipeParts.find((p, i) => i >= 1 && !DESCRIPTORS.test(p) && p.split(' ').length <= 3 && i !== pipeParts.length - 1);
    return { artist: singer || pipeParts[2] || "", track: dashParts[0] };
  }

  // "TRACK | descriptor | Artist | Album" (pure pipe format, no dash)
  if (pipeParts.length >= 3 && dashParts.length === 1) {
    const artist = pipeParts.find((p, i) => i >= 1 && !DESCRIPTORS.test(p));
    return { artist: artist || "", track: pipeParts[0] };
  }

  // "Artist - Track" simple format — but check it's not "Track - Artist" (NF style)
  if (dashParts.length >= 2) {
    return { artist: dashParts[0], track: dashParts[1] };
  }

  return { artist: "", track: pipeParts[0] || clean };
}

/**
 * Fetch similar tracks from Last.fm
 * Returns array of { artist, track } objects
 */
function lastfmRequest(artist, track, limit) {
  return new Promise((resolve) => {
    const params = new URLSearchParams({
      method: "track.getSimilar",
      artist, track,
      api_key: LASTFM_API_KEY,
      format: "json",
      limit,
      autocorrect: 1,
    });
    https.get(`https://ws.audioscrobbler.com/2.0/?${params}`, (res) => {
      let data = "";
      res.on("data", (chunk) => (data += chunk));
      res.on("end", () => {
        try {
          const json = JSON.parse(data);
          const tracks = json?.similartracks?.track;
          resolve(Array.isArray(tracks) ? tracks.map(t => ({ artist: t.artist.name, track: t.name })) : []);
        } catch { resolve([]); }
      });
    }).on("error", () => resolve([]));
  });
}

async function getSimilarTracks(artistOrTitle, trackName, limit = 10) {
  if (!LASTFM_API_KEY) return [];
  let artist, track;
  if (trackName) {
    artist = artistOrTitle;
    track = trackName;
  } else {
    ({ artist, track } = parseTitle(artistOrTitle));
  }
  if (!track) return [];

  const results = await lastfmRequest(artist, track, limit);
  // If empty and we have both, retry with swapped artist/track (handles "Track - Artist" YouTube format)
  if (!results.length && artist && track) {
    return lastfmRequest(track, artist, limit);
  }
  return results;
}

module.exports = { getSimilarTracks, parseTitle };
