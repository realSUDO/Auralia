const { queueMap } = require("../player/musicPlayer");
const { getMoodPlaylist, getVibeShiftGenre } = require("../recommendation-engine");
const { createErrorEmbed, createInfoEmbed } = require("../utils/embeds");

function handleMoodSkip(guildId, send, client) {
  const queue = queueMap.get(guildId);
  if (!queue?.player) return send({ embeds: [createErrorEmbed("No music playing!")] });
  if (!queue.moodActive) return send({ embeds: [createErrorEmbed("No mood is active. Use `!mood` first.")] });

  const newMood = getVibeShiftGenre(queue.moodGenre);
  queue.moodGenre = newMood;
  queue.moodSongsPlayed = 0;
  queue.tracks = [];

  const playlist = getMoodPlaylist(newMood);
  const requester = queue.currentTrack?.requester;
  for (const t of playlist) {
    queue.tracks.push({ title: t.label, url: t.url, requester });
  }

  send({ embeds: [createInfoEmbed(`🎵 Mood skip → **${newMood}**`)] });

  // Skip current song — Idle will fire and pick up the new queue
  queue.player.stop();
}

module.exports = {
  name: "moodskip",
  description: "Skip current song and shift to a new mood",
  execute(message, args, client) {
    handleMoodSkip(message.guild.id, msg => message.channel.send(msg).catch(() => {}), client);
  },
  async slashExecute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    handleMoodSkip(interaction.guildId, msg => interaction.editReply(msg).catch(() => {}), client);
  },
};
