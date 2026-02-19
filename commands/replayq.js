const { queueMap, replayLastQueue } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "replayq",
  description: "Replays the last queue",
  execute(message, args, client) {
    // Check if user is in voice channel
    if (!message.member.voice.channel) {
      return message.reply({ embeds: [createErrorEmbed("You need to be in a voice channel!")] }).catch(() => {});
    }

    const count = replayLastQueue(message.guild.id, client, message.channel, message.author);
    
    if (count === 0) {
      return message.reply({ embeds: [createErrorEmbed("No previous queue to replay!")] }).catch(() => {});
    }

    message.channel.send({ embeds: [createSuccessEmbed(`🔁 Added ${count} song(s) from previous queue.`)] }).catch(() => {});
  },
};
