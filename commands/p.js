const { queueMap } = require("../player/musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");
const playCommand = require("./play");

module.exports = {
  name: "p",
  description: "Smart play/pause - plays music if not playing, pauses if playing",
  async execute(message, args, client) {
    const queue = queueMap.get(message.guild.id);
    
    // If bot is not in VC or no queue exists, act as play command
    if (!queue || !queue.player) {
      return playCommand.execute(message, args, client);
    }

    // If queue exists but no args provided, toggle pause
    if (args.length === 0) {
      if (queue.player.state.status === AudioPlayerStatus.Playing) {
        queue.player.pause();
        return message.channel.send("⏸️ Song paused.");
      } else if (queue.player.state.status === AudioPlayerStatus.Paused) {
        queue.player.unpause();
        return message.channel.send("▶️ Song resumed.");
      }
    }

    // If args provided, add to queue
    return playCommand.execute(message, args, client);
  },
};
