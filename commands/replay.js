const { queueMap, replayCurrentSong } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "replay",
  description: "Replays the current song",
  execute(message) {
    const replayed = replayCurrentSong(message.guild.id);
    
    if (!replayed) {
      return message.reply({ embeds: [createErrorEmbed("There's no song to replay!")] }).catch(() => {});
    }

    message.channel.send({ embeds: [createSuccessEmbed("Replaying current song...")] }).catch(() => {});
  },
};
