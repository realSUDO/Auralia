const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleVolume(guildId, level, send) {
  const queue = queueMap.get(guildId);
  if (!queue?.player) return send({ embeds: [createErrorEmbed("There's no music playing!")] });

  if (level === null) {
    return send({ embeds: [createSuccessEmbed(`Current volume: ${queue.volume || 100}%`)] });
  }

  const volume = Math.round(Math.max(0, Math.min(100, level)) / 10) * 10;
  queue.volume = volume;
  if (queue.player.state.resource) queue.player.state.resource.volume.setVolume(volume / 100);
  send({ embeds: [createSuccessEmbed(`🔊 Volume set to ${volume}%`)] });
}

module.exports = {
  name: "volume",
  description: "Set or check the volume (0-100)",
  execute(message, args) {
    const level = args.length ? parseInt(args[0]) : null;
    handleVolume(message.guild.id, isNaN(level) ? null : level, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const level = interaction.options.getInteger("level");
    handleVolume(interaction.guildId, level ?? null, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
