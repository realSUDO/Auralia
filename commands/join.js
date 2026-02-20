const { joinVoiceChannel } = require("@discordjs/voice");
const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "join",
  description: "Makes the bot join your voice channel",
  execute(message, args, client) {
    const voiceChannel = message.member.voice.channel;
    
    if (!voiceChannel) {
      return message.reply({ embeds: [createErrorEmbed("You need to be in a voice channel!")] }).catch(() => {});
    }

    const queue = queueMap.get(message.guild.id);
    
    if (queue && queue.voiceChannel && queue.voiceChannel.id === voiceChannel.id) {
      return message.reply({ embeds: [createErrorEmbed("I'm already in your voice channel!")] }).catch(() => {});
    }
    
    // If bot is in a different channel, disconnect first
    if (queue && queue.connection) {
      queue.connection.destroy();
    }
    
    // Join the voice channel
    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: message.guild.id,
      adapterCreator: message.guild.voiceAdapterCreator,
    });

    message.channel.send({ embeds: [createSuccessEmbed(`Joined ${voiceChannel.name}`)] }).catch(() => {});
  },
};
