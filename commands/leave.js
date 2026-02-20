const { queueMap, stopPlayback } = require("../player/musicPlayer");
const { cleanupPreload } = require("../utils/preload");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "leave",
  description: "Stops the music and leaves the voice channel",
  execute(message) {
    const queue = queueMap.get(message.guild.id);
    
    if (!queue) {
      return message.reply({ embeds: [createErrorEmbed("I'm not in a voice channel!")] });
    }

    stopPlayback(message.guild.id);
    
    // Clear player message
    if (queue.playerMessage) {
      queue.playerMessage.delete().catch(() => {});
      queue.playerMessage = null;
    }
    
    // Clear progress interval
    if (queue.progressInterval) {
      clearInterval(queue.progressInterval);
      queue.progressInterval = null;
    }
    
    if (queue.connection) {
      queue.connection.destroy();
    }
    
    if (queue.aloneTimer) {
      clearTimeout(queue.aloneTimer);
    }
    
    cleanupPreload(queue);
    
    queueMap.delete(message.guild.id);
    message.channel.send({ embeds: [createSuccessEmbed("Left voice channel.")] }).catch(() => {});
  },
};
