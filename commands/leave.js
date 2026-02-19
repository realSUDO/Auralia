const { queueMap, stopPlayback } = require("../player/musicPlayer");

module.exports = {
  name: "leave",
  description: "Stops the music and leaves the voice channel",
  execute(message) {
    const queue = queueMap.get(message.guild.id);
    
    if (!queue) {
      return message.reply("I'm not in a voice channel!");
    }

    stopPlayback(message.guild.id);
    
    if (queue.connection) {
      queue.connection.destroy();
    }
    
    if (queue.aloneTimer) {
      clearTimeout(queue.aloneTimer);
    }
    
    queueMap.delete(message.guild.id);
    message.channel.send("👋 Left voice channel.").catch(() => {});
  },
};
