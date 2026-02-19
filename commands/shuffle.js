const { queueMap, shuffleQueue } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "shuffle",
  description: "Shuffles the current queue",
  execute(message) {
    const shuffled = shuffleQueue(message.guild.id);
    
    if (!shuffled) {
      return message.reply({ embeds: [createErrorEmbed("There's nothing to shuffle!")] }).catch(() => {});
    }

    message.channel.send({ embeds: [createSuccessEmbed("Queue shuffled!")] }).catch(() => {});
  },
};
