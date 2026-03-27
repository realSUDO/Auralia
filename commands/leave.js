const { queueMap, stopPlayback } = require("../player/musicPlayer");
const { cleanupPreload } = require("../utils/preload");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleLeave(guildId, client, send) {
  const queue = queueMap.get(guildId);
  if (!queue) return send({ embeds: [createErrorEmbed("I'm not in a voice channel!")] });

  stopPlayback(guildId);
  if (queue.playerMessage) { queue.playerMessage.delete().catch(() => {}); queue.playerMessage = null; }
  if (queue.progressInterval) { clearInterval(queue.progressInterval); queue.progressInterval = null; }
  if (queue.voiceStateHandler) { client.off('voiceStateUpdate', queue.voiceStateHandler); queue.voiceStateHandler = null; }
  if (queue.aloneTimer) { clearTimeout(queue.aloneTimer); queue.aloneTimer = null; }
  if (queue.connection) queue.connection.destroy();
  cleanupPreload(queue);
  queueMap.delete(guildId);

  send({ embeds: [createSuccessEmbed("Left voice channel.")] });
}

module.exports = {
  name: "leave",
  description: "Stops the music and leaves the voice channel",
  execute(message, args, client) {
    handleLeave(message.guild.id, client, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction, client) {
    await interaction.deferReply({ ephemeral: true });
    handleLeave(interaction.guildId, client, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
