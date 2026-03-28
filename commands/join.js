const { joinVoiceChannel } = require("@discordjs/voice");
const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleJoin(user, guild, send) {
  const member = guild.members.cache.get(user.id);
  if (!member?.voice.channel) return send({ embeds: [createErrorEmbed("You need to be in a voice channel!")] });

  const voiceChannel = member.voice.channel;
  const queue = queueMap.get(guild.id);
  if (queue?.voiceChannel?.id === voiceChannel.id) return send({ embeds: [createErrorEmbed("I'm already in your voice channel!")] });
  if (queue?.connection) queue.connection.destroy();

  joinVoiceChannel({ channelId: voiceChannel.id, guildId: guild.id, adapterCreator: guild.voiceAdapterCreator });
  send({ embeds: [createSuccessEmbed(`Joined **${voiceChannel.name}**`)] });
}

module.exports = {
  name: "join",
  description: "Makes the bot join your voice channel",
  execute(message) {
    handleJoin(message.author, message.guild, (msg) => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    if (!interaction.guild) return interaction.reply({ content: "This command can only be used in a server.", flags: 64 });
    await interaction.deferReply({ flags: 64 });
    handleJoin(interaction.user, interaction.guild, (msg) => interaction.editReply(msg).catch(() => {}));
  },
};
