const { queueMap } = require("../player/musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");

module.exports = {
  name: "pause",
  description: "Pauses or unpauses the current song",
  execute(message) {
    const queue = queueMap.get(message.guild.id);
    
    if (!queue || !queue.player) {
      return message.reply("There's no music playing!");
    }

    if (queue.player.state.status === AudioPlayerStatus.Playing) {
      queue.player.pause();
      message.channel.send("⏸️ Song paused.");
    } else if (queue.player.state.status === AudioPlayerStatus.Paused) {
      queue.player.unpause();
      message.channel.send("▶️ Song resumed.");
    } else {
      message.reply("Nothing is currently playing!");
    }
  },
};
