const { queueMap, replayCurrentSong } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleReplay(guildId, send) {
  const replayed = replayCurrentSong(guildId);
  if (!replayed) return send({ embeds: [createErrorEmbed("There's no song to replay!")] });
  send({ embeds: [createSuccessEmbed("🔁 Replaying current song...")] });
}

module.exports = {
  name: "replay",
  description: "Replays the current song",
  execute(message) {
    handleReplay(message.guild.id, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    handleReplay(interaction.guildId, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
