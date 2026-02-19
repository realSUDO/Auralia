const { queueMap } = require("../player/musicPlayer");
const { createInfoEmbed, createErrorEmbed } = require("../utils/embeds");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

module.exports = {
  name: "queue",
  description: "Shows the current queue",
  async execute(message, args) {
    const queue = queueMap.get(message.guild.id);
    
    if (!queue || queue.tracks.length === 0) {
      return message.reply({ embeds: [createErrorEmbed("The queue is empty!")] });
    }

    const page = parseInt(args[0]) || 1;
    const perPage = 10;
    const start = (page - 1) * perPage;
    const end = start + perPage;
    const totalPages = Math.ceil(queue.tracks.length / perPage);
    
    if (page < 1 || page > totalPages) {
      return message.reply({ embeds: [createErrorEmbed(`Invalid page! Use 1-${totalPages}`)] });
    }

    const current = queue.tracks[0];
    const upcoming = queue.tracks.slice(start + 1, end + 1);
    
    let queueMessage = page === 1 ? `🎵 **Now Playing:**\n${current.title}\n\n` : '';
    
    if (upcoming.length > 0) {
      queueMessage += `**Up Next (Page ${page}/${totalPages}):**\n`;
      upcoming.forEach((track, index) => {
        queueMessage += `${start + index + 1}. ${track.title}\n`;
      });
    } else if (page === 1) {
      queueMessage += `No upcoming songs.`;
    }
    
    const components = [];
    if (totalPages > 1) {
      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`queue_prev_${page}_${message.guild.id}`)
          .setLabel("Previous")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === 1),
        
        new ButtonBuilder()
          .setCustomId(`queue_next_${page}_${message.guild.id}`)
          .setLabel("Next")
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page === totalPages)
      );
      components.push(row);
    }
    
    message.channel.send({ 
      embeds: [createInfoEmbed(queueMessage)],
      components 
    });
  },
};
