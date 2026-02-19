const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "clear",
  description: "Clears all upcoming songs from the queue",
  execute(message) {
    const queue = queueMap.get(message.guild.id);
    
    if (!queue || queue.tracks.length === 0) {
      return message.reply({ embeds: [createErrorEmbed("There's nothing in the queue to clear!")] });
    }

    const clearedCount = queue.tracks.length - 1;
    queue.tracks = [queue.tracks[0]]; // Keep only the currently playing song
    
    if (clearedCount > 0) {
      message.channel.send({ embeds: [createSuccessEmbed(`Cleared ${clearedCount} song(s) from the queue.`)] });
    } else {
      message.reply({ embeds: [createErrorEmbed("No upcoming songs to clear!")] });
    }
  },
};
