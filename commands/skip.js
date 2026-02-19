const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "skip",
  description: "Skips the current song",
  execute(message) {
    const queue = queueMap.get(message.guild.id);
    
    if (!queue || !queue.player) {
      return message.reply({ embeds: [createErrorEmbed("There's no music playing!")] });
    }

    if (queue.tracks.length === 0) {
      return message.reply({ embeds: [createErrorEmbed("There's nothing to skip!")] });
    }

    const skippedSong = queue.tracks[0].title;
    queue.intentionalStop = true;
    queue.player.stop(); // This triggers the Idle event which plays the next song
    message.channel.send({ embeds: [createSuccessEmbed(`Skipped: **${skippedSong}**`)] }).catch(() => {});
  },
};
