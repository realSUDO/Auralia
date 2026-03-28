const PLAYLISTS = require("./playlists.json");

const ALL_MOODS = Object.keys(PLAYLISTS).filter(m => m !== "lofiradio");

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Returns a shuffled copy of the mood playlist.
 * @param {string} moodType
 * @returns {{ url: string, label: string, livestream?: boolean }[]}
 */
function getMoodPlaylist(moodType) {
  const list = PLAYLISTS[moodType];
  if (!list) throw new Error(`Unknown mood: ${moodType}. Valid: ${Object.keys(PLAYLISTS).join(", ")}`);
  return shuffle(list);
}

module.exports = { getMoodPlaylist, ALL_MOODS };
