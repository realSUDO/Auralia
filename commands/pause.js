const { queueMap } = require("../player/musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handlePause(guildId, send) {
  const queue = queueMap.get(guildId);
  if (!queue?.player) return send({ embeds: [createErrorEmbed("There's no music playing!")] });

  if (queue.player.state.status === AudioPlayerStatus.Playing) {
    queue.player.pause();
    send({ embeds: [createSuccessEmbed("⏸️ Paused.")] });
  } else if (queue.player.state.status === AudioPlayerStatus.Paused) {
    queue.player.unpause();
    send({ embeds: [createSuccessEmbed("▶️ Resumed.")] });
  } else {
    send({ embeds: [createErrorEmbed("Nothing is currently playing!")] });
  }
}

module.exports = {
  name: "pause",
  description: "Pauses or resumes the current song",
  execute(message) {
    handlePause(message.guild.id, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    handlePause(interaction.guildId, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
