const { queueMap } = require("../player/musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");
const { createSuccessEmbed } = require("../utils/embeds");

module.exports = {
  name: "p",
  description: "Smart play/pause - plays music if not playing, pauses if playing",
  execute(message, args, client) {
    const queue = queueMap.get(message.guild.id);
    
    // If bot is not in VC or no queue exists, act as play command
    if (!queue || !queue.player) {
      const playCommand = require("./play");
      return playCommand.execute(message, args, client);
    }

    // If queue exists but no args provided, toggle pause
    if (args.length === 0) {
      if (queue.player.state.status === AudioPlayerStatus.Playing) {
        queue.player.pause();
        return message.channel.send({ embeds: [createSuccessEmbed("Song paused.")] }).catch(() => {});
      } else if (queue.player.state.status === AudioPlayerStatus.Paused) {
        queue.player.unpause();
        return message.channel.send({ embeds: [createSuccessEmbed("Song resumed.")] }).catch(() => {});
      }
    }

    // If args provided, add to queue
    const playCommand = require("./play");
    return playCommand.execute(message, args, client);
  },
};
