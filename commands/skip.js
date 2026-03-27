const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleSkip(guildId, send) {
  const queue = queueMap.get(guildId);
  if (!queue?.player) return send({ embeds: [createErrorEmbed("There's no music playing!")] });
  if (!queue.tracks.length) return send({ embeds: [createErrorEmbed("There's nothing to skip!")] });

  const skipped = queue.tracks[0].title;
  queue.intentionalStop = true;
  queue.player.stop();
  send({ embeds: [createSuccessEmbed(`Skipped: **${skipped}**`)] });
}

module.exports = {
  name: "skip",
  description: "Skips the current song",
  execute(message) {
    handleSkip(message.guild.id, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    handleSkip(interaction.guildId, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
