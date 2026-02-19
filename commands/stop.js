const { stopPlayback } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "stop",
  description: "Stops the music and clears the queue",
  execute(message) {
    const stopped = stopPlayback(message.guild.id);
    
    if (!stopped) {
      return message.reply({ embeds: [createErrorEmbed("There's no music playing!")] });
    }

    message.channel.send({ embeds: [createSuccessEmbed("Stopped playback and cleared queue.")] }).catch(() => {});
  },
};
