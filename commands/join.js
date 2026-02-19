const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "join",
  description: "Makes the bot join your voice channel",
  execute(message) {
    const voiceChannel = message.member.voice.channel;
    
    if (!voiceChannel) {
      return message.reply({ embeds: [createErrorEmbed("You need to be in a voice channel!")] }).catch(() => {});
    }

    const queue = queueMap.get(message.guild.id);
    
    if (queue && queue.voiceChannel && queue.voiceChannel.id === voiceChannel.id) {
      return message.reply({ embeds: [createErrorEmbed("I'm already in your voice channel!")] }).catch(() => {});
    }

    message.channel.send({ embeds: [createSuccessEmbed(`Joined ${voiceChannel.name}`)] }).catch(() => {});
  },
};
