const { enqueueTrack, queueMap } = require("../player/musicPlayer");
const { getMoodPlaylist } = require("../recommendation-engine");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleLofiRadio(user, guild, channel, client, send) {
  const member = guild.members.cache.get(user.id);
  if (!member?.voice.channel) return send({ embeds: [createErrorEmbed("You need to be in a voice channel!")] });

  // Clear mood state — lofi radio is not a mood
  setImmediate(() => {
    const queue = queueMap.get(guild.id);
    if (queue) { queue.moodActive = false; queue.moodGenre = null; queue.moodSongsPlayed = 0; }
  });

  const track = getMoodPlaylist("lofiradio")[0];
  enqueueTrack(guild.id, { title: track.label, url: track.url, requester: user, livestream: true, directStream: true, isAutoPlaySong: false }, client, channel);
  send({ embeds: [createSuccessEmbed("📻 Starting lofi radio...")] });
}

module.exports = {
  name: "lofiradio",
  description: "Start the lofi radio livestream",
  execute(message, args, client) {
    handleLofiRadio(message.author, message.guild, message.channel, client,
      msg => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction, client) {
    await interaction.deferReply();
    handleLofiRadio(interaction.user, interaction.guild, interaction.channel, client,
      msg => interaction.editReply(msg).catch(() => {}));
  },
};
