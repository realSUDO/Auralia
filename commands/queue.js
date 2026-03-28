const { queueMap } = require("../player/musicPlayer");
const { createInfoEmbed, createErrorEmbed } = require("../utils/embeds");
const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

function buildQueueEmbed(queue, page, guildId) {
  const current = queue.currentTrack;

  // User songs = upcoming tracks that are NOT autoplay
  const userTracks = queue.tracks.slice(1).filter(t => !t.isAutoPlaySong);
  const autoTracks = queue.tracks.slice(1).filter(t => t.isAutoPlaySong);

  // Build display: user tracks first, then autoplay tracks, then pending suggestion if nothing else
  let displayTracks = [...userTracks];
  if (autoTracks.length > 0) {
    displayTracks = [...displayTracks, ...autoTracks];
  } else if (userTracks.length === 0 && queue.autoplaySuggestion) {
    displayTracks = [{ ...queue.autoplaySuggestion, isAutoPlaySong: true }];
  }

  const perPage = 10;
  const totalPages = Math.max(1, Math.ceil(displayTracks.length / perPage));
  page = Math.max(1, Math.min(page, totalPages));
  const start = (page - 1) * perPage;
  const slice = displayTracks.slice(start, start + perPage);

  let msg = page === 1 ? `🎵 **Now Playing:**\n${current?.title || 'Nothing'}\n\n` : '';

  if (slice.length > 0) {
    msg += `**Up Next (Page ${page}/${totalPages}):**\n`;
    slice.forEach((t, i) => {
      msg += `${start + i + 1}. ${t.title}${t.isAutoPlaySong ? ' *(autoplay)*' : ''}\n`;
    });
  } else if (page === 1) {
    if (queue.autoplay && queue.preloadAutoplayProcess) {
      msg += '*⏳ Fetching next autoplay suggestion...*';
    } else if (queue.autoplay) {
      msg += '*Queue empty — autoplay will suggest next.*';
    } else {
      msg += 'No upcoming songs.';
    }
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
  buildQueueEmbed,
  description: "Shows the current queue",
  async execute(message, args) {
    const queue = queueMap.get(message.guild.id);
    if (!queue?.currentTrack) return message.reply({ embeds: [createErrorEmbed("Nothing is playing!")] });
    message.channel.send(buildQueueEmbed(queue, parseInt(args[0]) || 1, message.guild.id));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const queue = queueMap.get(interaction.guildId);
    if (!queue?.currentTrack) return interaction.editReply({ embeds: [createErrorEmbed("Nothing is playing!")] });
    interaction.editReply(buildQueueEmbed(queue, interaction.options.getInteger("page") || 1, interaction.guildId));
  },
};
