const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "loop",
  description: "Toggle loop mode for the current song",
  execute(message) {
    const queue = queueMap.get(message.guild.id);
    
    if (!queue || !queue.player) {
      return message.reply({ embeds: [createErrorEmbed("There's no music playing!")] }).catch(() => {});
    }

    queue.isLooping = !queue.isLooping;
    
    if (queue.isLooping) {
      message.channel.send({ embeds: [createSuccessEmbed("🔂 Loop enabled")] }).catch(() => {});
    } else {
      message.channel.send({ embeds: [createSuccessEmbed("Loop disabled")] }).catch(() => {});
    }
  },
};
