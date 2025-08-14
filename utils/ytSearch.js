// utils/ytSearch.js
const yts = require('yt-search');

/**
 * Searches YouTube for a query and returns a playable video's details.
 * Filters out age-restricted and obviously unplayable results (private, live, etc.).
 * @param {string} query
 * @returns {Promise<{ title: string, url: string, duration: string }>}
 */
async function searchYouTube(query) {
  const result = await yts(query);

  if (!result || !result.videos || result.videos.length === 0) {
    throw new Error('No results found on YouTube.');
  }

  // Filter out problematic videos
  const filtered = result.videos.filter(video => {
    const isAgeRestricted = video.age_restricted === true;
    const isLive = video.live === true;
    const isTooLong = false; // Optionally apply duration limit here

    return !isAgeRestricted && !isLive && video.seconds > 0 && !isTooLong;
  });

  if (filtered.length === 0) {
    throw new Error('No playable videos found on YouTube (all restricted/unavailable).');
  }

  // Pick the first playable video
  const video = filtered[0];
  return {
    title: video.title,
    url: video.url,
    duration: video.timestamp
  };
}

module.exports = { searchYouTube };

