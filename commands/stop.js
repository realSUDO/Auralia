const { stopPlayback } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleStop(guildId, send) {
  const stopped = stopPlayback(guildId);
  if (!stopped) return send({ embeds: [createErrorEmbed("There's no music playing!")] });
  send({ embeds: [createSuccessEmbed("Stopped playback and cleared queue.")] });
}

module.exports = {
  name: "stop",
  description: "Stops the music and clears the queue",
  execute(message) {
    handleStop(message.guild.id, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ flags: 64 });
    handleStop(interaction.guildId, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
