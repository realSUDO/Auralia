const { replayLastQueue } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleReplayQ(guildId, user, guild, channel, client, send) {
  const member = guild.members.cache.get(user.id);
  if (!member?.voice.channel) return send({ embeds: [createErrorEmbed("You need to be in a voice channel!")] });
  const count = replayLastQueue(guildId, client, channel, user);
  if (!count) return send({ embeds: [createErrorEmbed("No previous queue to replay!")] });
  send({ embeds: [createSuccessEmbed(`🔁 Added ${count} song(s) from previous queue.`)] });
}

module.exports = {
  name: "replayq",
  description: "Replays the last queue",
  execute(message, args, client) {
    handleReplayQ(message.guild.id, message.author, message.guild, message.channel, client, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction, client) {
    await interaction.deferReply({ flags: 64 });
    handleReplayQ(interaction.guildId, interaction.user, interaction.guild, interaction.channel, client, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
