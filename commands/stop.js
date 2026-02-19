const { stopPlayback } = require("../player/musicPlayer");

module.exports = {
  name: "stop",
  description: "Stops the music and clears the queue",
  execute(message) {
    const stopped = stopPlayback(message.guild.id);
    
    if (!stopped) {
      return message.reply("There's no music playing!");
    }

    message.channel.send("⏹️ Stopped playback and cleared queue.").catch(() => {});
  },
};
