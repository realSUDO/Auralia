const { queueMap } = require("../player/musicPlayer");
const { getMoodPlaylist, ALL_MOODS } = require("../recommendation-engine");
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require("../utils/embeds");

const VALID_MOODS = [...ALL_MOODS, "lofiradio"];

async function handleMood(moodType, strict, user, guild, channel, client, send) {
  const mood = moodType?.toLowerCase();

  // Toggle strict on active mood
  if (mood === 'strict') {
    const queue = require("../player/musicPlayer").queueMap.get(guild.id);
    if (!queue?.moodActive) return send({ embeds: [createErrorEmbed("No mood is active.")] });
    queue.moodStrict = !queue.moodStrict;
    return send({ embeds: [createSuccessEmbed(queue.moodStrict ? "🔒 Mood locked (strict)" : "🔓 Mood drift enabled")] });
  }
  if (!VALID_MOODS.includes(mood)) {
    return send({ embeds: [createErrorEmbed(`Unknown mood. Valid: ${VALID_MOODS.join(", ")}`)] });
  }

  const member = guild.members.cache.get(user.id);
  if (!member?.voice.channel) return send({ embeds: [createErrorEmbed("You need to be in a voice channel!")] });

  const { enqueueTrack } = require("../player/musicPlayer");
  const { eagerPreloadTrack } = require("../utils/preload");
  const playlist = getMoodPlaylist(mood);

  // Special case: lofiradio is a single livestream — just play it directly
  if (mood === "lofiradio") {
    const track = playlist[0];
    enqueueTrack(guild.id, { title: track.label, url: track.url, requester: user, livestream: true, directStream: !!track.directStream }, client, channel);
    return send({ embeds: [createSuccessEmbed(`📻 Starting lofi radio...`)] });
  }

  // Eagerly preload first track so it's on disk before startPlaying fires
  eagerPreloadTrack(guild.id, { url: playlist[0].url, title: playlist[0].label });

  // Enqueue all tracks
  for (const t of playlist) {
    enqueueTrack(guild.id, { title: t.label, url: t.url, requester: user, isAutoPlaySong: true }, client, channel);
  }

  // Tag the queue with mood state
  // We use setImmediate so queue is guaranteed to exist after first enqueueTrack
  setImmediate(() => {
    const queue = queueMap.get(guild.id);
    if (!queue) return;
    queue.moodActive = true;
    queue.moodGenre = mood;
    queue.moodStrict = !!strict;
    queue.moodSongsPlayed = 0;
    queue.autoplay = true; // autoplay kicks in when mood playlist ends
  });

  const msg = strict
    ? `${moodEmoji(mood)} **${mood}** mood started. ∞ songs queued\n*Strict mode — no drift.*`
    : `${moodEmoji(mood)} **${mood}** mood started. ∞ songs queued\n*Mood will change after 4-5 songs. Use \`!mood strict\` or \`/mood strict\` to stick to this one.*`;
  send({ embeds: [createInfoEmbed(msg)] });
}

function moodEmoji(mood) {
  const map = { happy: "😄", sad: "😢", energetic: "⚡", hiphop: "🎤", lofi: "🌙", metal: "🤘", lofiradio: "📻" };
  return map[mood] || "🎵";
}

module.exports = {
  name: "mood",
  description: "Play a mood-based playlist",
  handleMoodFromButton: (moodType, user, guild, channel, client, send) =>
    handleMood(moodType, false, user, guild, channel, client, send),
  execute(message, args, client) {
    const [moodType, flag] = args;
    const strict = flag === "strict";
    handleMood(moodType, strict, message.author, message.guild, message.channel, client,
      msg => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction, client) {
    await interaction.deferReply();
    const moodType = interaction.options.getString("mood");
    const strict = interaction.options.getBoolean("strict") ?? false;
    handleMood(moodType, strict, interaction.user, interaction.guild, interaction.channel, client,
      msg => interaction.editReply(msg).catch(() => {}));
  },
};
