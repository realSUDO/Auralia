const { spawn } = require("child_process");
const { getMoodPlaylist, ALL_MOODS } = require("./mood");
const { ytdlpArgs } = require("../utils/ytdlp");

const SLOWED_REGEX = /slowed|reverb|lofi|lo-fi|sped up|nightcore|instrumental|karaoke|cover/i;

/**
 * Scrape YouTube RD mix playlist for a video, return a random valid pick.
 * @param {string} videoId
 * @param {Set<string>} excludeUrls
 * @returns {Promise<{title: string, url: string}|null>}
 */
function scrapeYouTubeRD(videoId, excludeUrls) {
  return new Promise((resolve) => {
    const proc = spawn("yt-dlp", ytdlpArgs([
      "--flat-playlist", "--playlist-end", "7",
      "--print", "%(id)s|||%(title)s|||%(duration)s",
      `https://www.youtube.com/watch?v=${videoId}&list=RD${videoId}`,
    ]));

    let out = "";
    proc.stdout.on("data", d => (out += d));
    proc.on("close", () => {
      const candidates = out.trim().split("\n")
        .map(line => {
          const [id, title, dur] = line.split("|||");
          return { id: (id || "").trim(), title: (title || "").trim(), duration: parseFloat(dur) || 0 };
        })
        .filter(v =>
          v.id && v.id !== videoId &&
          v.duration > 60 && v.duration < 600 &&
          !SLOWED_REGEX.test(v.title) &&
          !excludeUrls.has(`https://www.youtube.com/watch?v=${v.id}`)
        );

      if (!candidates.length) return resolve(null);
      const pick = candidates[Math.floor(Math.random() * candidates.length)];
      resolve({ title: pick.title, url: `https://www.youtube.com/watch?v=${pick.id}` });
    });
    proc.on("error", () => resolve(null));
  });
}

/**
 * Fetch next autoplay suggestion.
 * Pipeline:
 *   1. Last.fm  — only for Spotify-sourced tracks (clean artist + trackName)
 *   2. YouTube RD mix scrape
 *   3. Random track from a random mood playlist
 *
 * @param {object} track - { url, title, artist?, trackName? }
 * @param {Set<string>} excludeUrls
 * @returns {Promise<{title: string, url: string}|null>}
 */
async function fetchAutoplaySuggestion(track, excludeUrls = new Set()) {
  const { url, title, artist, trackName } = track;
  console.log(`[Engine] Autoplay seed → artist:"${artist||""}" track:"${trackName||""}" title:"${title}"`);

  // Step 1: Last.fm (Spotify-sourced only)
  if (artist && trackName) {
    try {
      const { getSimilarTracks } = require("../utils/lastfm");
      const { searchYouTube } = require("../utils/ytSearch");
      const similar = await getSimilarTracks(artist, trackName);
      if (similar.length) {
        const pool = similar.slice(0, 5);
        const pick = pool[Math.floor(Math.random() * pool.length)];
        const result = await searchYouTube(`${pick.artist} ${pick.track}`).catch(() => null);
        if (result && !SLOWED_REGEX.test(result.title) && !excludeUrls.has(result.url)) {
          console.log(`[Engine] ✅ Step 1 (Last.fm) → "${result.title}"`);
          return result;
        }
      }
    } catch (e) {
      console.log(`[Engine] Last.fm error: ${e.message}`);
    }
  }

  // Step 2: YouTube RD mix
  const videoId = (url || "").match(/(?:v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/)?.[1];
  if (videoId) {
    const result = await scrapeYouTubeRD(videoId, excludeUrls);
    if (result) {
      console.log(`[Engine] ✅ Step 2 (RD mix) → "${result.title}"`);
      return result;
    }
  }

  // Step 3: Random track from a random mood playlist
  const mood = ALL_MOODS[Math.floor(Math.random() * ALL_MOODS.length)];
  const fallback = getMoodPlaylist(mood).find(t => !excludeUrls.has(t.url));
  if (fallback) {
    console.log(`[Engine] ✅ Step 3 (mood fallback: ${mood}) → "${fallback.label}"`);
    return { title: fallback.label, url: fallback.url };
  }

  console.log(`[Engine] ❌ All steps failed`);
  return null;
}

module.exports = { fetchAutoplaySuggestion };
