const { queueMap } = require("../player/musicPlayer");
const { createInfoEmbed, createErrorEmbed } = require("../utils/embeds");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

function buildQueueEmbed(queue, page, guildId) {
  const perPage = 10;
  const totalPages = Math.ceil(queue.tracks.length / perPage);
  page = Math.max(1, Math.min(page, totalPages));
  const start = (page - 1) * perPage;

  const current = queue.tracks[0];
  const upcoming = queue.tracks.slice(start + 1, start + perPage + 1);

  let msg = page === 1 ? `🎵 **Now Playing:**\n${current.title}\n\n` : '';
  if (upcoming.length > 0) {
    msg += `**Up Next (Page ${page}/${totalPages}):**\n`;
    upcoming.forEach((t, i) => { msg += `${start + i + 1}. ${t.title}\n`; });
  } else if (page === 1) {
    msg += `No upcoming songs.`;
  }

  const components = [];
  if (totalPages > 1) {
    components.push(new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`queue_prev_${page}_${guildId}`).setLabel("Previous").setStyle(ButtonStyle.Secondary).setDisabled(page === 1),
      new ButtonBuilder().setCustomId(`queue_next_${page}_${guildId}`).setLabel("Next").setStyle(ButtonStyle.Secondary).setDisabled(page === totalPages)
    ));
  }

  return { embeds: [createInfoEmbed(msg)], components };
}

module.exports = {
  name: "queue",
  description: "Shows the current queue",
  async execute(message, args) {
    const queue = queueMap.get(message.guild.id);
    if (!queue || queue.tracks.length === 0) return message.reply({ embeds: [createErrorEmbed("The queue is empty!")] });
    message.channel.send(buildQueueEmbed(queue, parseInt(args[0]) || 1, message.guild.id));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ ephemeral: true });
    const queue = queueMap.get(interaction.guildId);
    if (!queue || queue.tracks.length === 0) return interaction.editReply({ embeds: [createErrorEmbed("The queue is empty!")] });
    interaction.editReply(buildQueueEmbed(queue, interaction.options.getInteger("page") || 1, interaction.guildId));
  },
};
