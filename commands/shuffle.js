const { queueMap, shuffleQueue } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleShuffle(guildId, send) {
  const shuffled = shuffleQueue(guildId);
  if (!shuffled) return send({ embeds: [createErrorEmbed("There's nothing to shuffle!")] });
  send({ embeds: [createSuccessEmbed("Queue shuffled!")] });
}

module.exports = {
  name: "shuffle",
  description: "Shuffles the current queue",
  execute(message) {
    handleShuffle(message.guild.id, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    handleShuffle(interaction.guildId, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
