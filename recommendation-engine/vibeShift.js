const { ALL_MOODS } = require("./mood");

// Loosely related genres — used 50% of the time on vibe shift
const RELATED_GENRES = {
  happy:     ["energetic", "lofi"],
  sad:       ["lofi", "hiphop"],
  energetic: ["hiphop", "metal", "happy"],
  hiphop:    ["energetic", "happy"],
  lofi:      ["sad", "happy"],
  lofiradio: ["lofi", "sad"],
  metal:     ["energetic"],
};

/**
 * Pick next genre for a vibe shift.
 * 50/50: loosely related vs completely different.
 * @param {string} currentGenre
 * @returns {string}
 */
function getVibeShiftGenre(currentGenre) {
  const related = RELATED_GENRES[currentGenre] || [];
  const useRelated = Math.random() < 0.5 && related.length > 0;

  if (useRelated) {
    return related[Math.floor(Math.random() * related.length)];
  }

  const exclude = new Set([currentGenre, ...related]);
  const pool = ALL_MOODS.filter(m => !exclude.has(m));
  return pool[Math.floor(Math.random() * pool.length)] || ALL_MOODS[0];
}

module.exports = { getVibeShiftGenre, RELATED_GENRES };
