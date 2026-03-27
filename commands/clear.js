const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleClear(guildId, send) {
  const queue = queueMap.get(guildId);
  if (!queue || queue.tracks.length === 0) return send({ embeds: [createErrorEmbed("There's nothing in the queue to clear!")] });

  const cleared = queue.tracks.length - 1;
  if (cleared === 0) return send({ embeds: [createErrorEmbed("No upcoming songs to clear!")] });

  queue.tracks = [queue.tracks[0]];
  send({ embeds: [createSuccessEmbed(`Cleared ${cleared} song(s) from the queue.`)] });
}

module.exports = {
  name: "clear",
  description: "Clears all upcoming songs from the queue",
  execute(message) {
    handleClear(message.guild.id, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    handleClear(interaction.guildId, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
