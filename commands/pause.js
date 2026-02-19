const { queueMap } = require("../player/musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "pause",
  description: "Pauses or unpauses the current song",
  execute(message) {
    const queue = queueMap.get(message.guild.id);
    
    if (!queue || !queue.player) {
      return message.reply({ embeds: [createErrorEmbed("There's no music playing!")] });
    }

    if (queue.player.state.status === AudioPlayerStatus.Playing) {
      queue.player.pause();
      message.channel.send({ embeds: [createSuccessEmbed("Song paused.")] }).catch(() => {});
    } else if (queue.player.state.status === AudioPlayerStatus.Paused) {
      queue.player.unpause();
      message.channel.send({ embeds: [createSuccessEmbed("Song resumed.")] }).catch(() => {});
    } else {
      message.reply({ embeds: [createErrorEmbed("Nothing is currently playing!")] });
    }
  },
};
