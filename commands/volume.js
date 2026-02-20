const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "volume",
  description: "Set the volume (0-100, multiples of 10)",
  execute(message, args) {
    const queue = queueMap.get(message.guild.id);
    
    if (!queue || !queue.player) {
      return message.reply({ embeds: [createErrorEmbed("There's no music playing!")] });
    }

    if (args.length === 0) {
      const currentVolume = queue.volume || 100;
      return message.reply({ embeds: [createSuccessEmbed(`Current volume: ${currentVolume}%`)] });
    }

    let volume = parseInt(args[0]);
    
    if (isNaN(volume)) {
      return message.reply({ embeds: [createErrorEmbed("Please provide a valid number!")] });
    }

    // Clamp between 0 and 100
    volume = Math.max(0, Math.min(100, volume));
    
    // Round to nearest 10
    volume = Math.round(volume / 10) * 10;
    
    // Set volume (Discord.js uses 0.0 to 1.0 scale)
    queue.volume = volume;
    
    if (queue.player.state.resource) {
      queue.player.state.resource.volume.setVolume(volume / 100);
    }
    
    message.channel.send({ embeds: [createSuccessEmbed(`🔊 Volume set to ${volume}%`)] }).catch(() => {});
  },
};
