const { queueMap } = require("../player/musicPlayer");

module.exports = {
  name: "queue",
  description: "Shows the current queue",
  execute(message) {
    const queue = queueMap.get(message.guild.id);
    
    if (!queue || queue.tracks.length === 0) {
      return message.reply("The queue is empty!");
    }

    const current = queue.tracks[0];
    const upcoming = queue.tracks.slice(1, 11);
    
    let queueMessage = `🎵 **Now Playing:**\n${current.title}\n\n`;
    
    if (upcoming.length > 0) {
      queueMessage += `**Up Next:**\n`;
      upcoming.forEach((track, index) => {
        queueMessage += `${index + 1}. ${track.title}\n`;
      });
      
      if (queue.tracks.length > 11) {
        queueMessage += `\n...and ${queue.tracks.length - 11} more`;
      }
    } else {
      queueMessage += `No upcoming songs.`;
    }
    
    message.channel.send(queueMessage);
  },
};
