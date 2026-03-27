const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleLoop(guildId, send) {
  const queue = queueMap.get(guildId);
  if (!queue?.player) return send({ embeds: [createErrorEmbed("There's no music playing!")] });
  queue.isLooping = !queue.isLooping;
  send({ embeds: [createSuccessEmbed(queue.isLooping ? "🔂 Loop enabled" : "Loop disabled")] });
}

module.exports = {
  name: "loop",
  description: "Toggle loop mode for the current song",
  execute(message) {
    handleLoop(message.guild.id, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    handleLoop(interaction.guildId, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
