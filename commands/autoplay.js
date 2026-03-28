const { queueMap, triggerAutoplayFetch } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");
const { updatePlayerUI } = require("../utils/playerUI");

function handleAutoplay(guildId, args, send) {
  const queue = queueMap.get(guildId);
  if (!queue?.player) return send({ embeds: [createErrorEmbed("There's no music playing!")] });

  const arg = (args?.[0] || "").toLowerCase();
  const wantsOff = arg === "off";

  if (wantsOff) {
    if (!queue.autoplay) return send({ embeds: [createErrorEmbed("Autoplay is already off.")] });
    queue.autoplay = false;
    queue.autoplaySuggestion = null;
    queue.tracks = queue.tracks.filter((t, i) => i === 0 || !t.isAutoPlaySong);
    // Edit existing player message to reflect new state — don't send a new one
    if (queue.playerMessage && queue.currentTrack) {
      updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(() => {});
    }
    return send({ embeds: [createSuccessEmbed("Autoplay disabled.")] });
  }

  if (queue.autoplay) {
    return send({ embeds: [createErrorEmbed("Autoplay is already on. Use `!autoplay off` to disable.")] });
  }

  queue.autoplay = true;
  // Edit existing player message to reflect new state — don't send a new one
  if (queue.playerMessage && queue.currentTrack) {
    updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(() => {});
  }
  send({ embeds: [createSuccessEmbed("🎵 Autoplay enabled.")] });

  // Only fetch now if we're already on the last user-queued song
  const hasUserSongsAhead = queue.tracks.slice(1).some(t => !t.isAutoPlaySong);
  if (!hasUserSongsAhead && queue.currentTrack) {
    triggerAutoplayFetch(guildId);
  }
}

module.exports = {
  name: "autoplay",
  aliases: ["auto"],
  description: "Toggle autoplay. Use `!autoplay off` to disable.",
  execute(message, args) {
    handleAutoplay(message.guild.id, args, msg => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const off = interaction.options.getString("action") === "off";
    handleAutoplay(interaction.guildId, off ? ["off"] : [], msg => interaction.editReply(msg).catch(() => {}));
  },
};
