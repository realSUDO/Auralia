const ytdl = require("@distube/ytdl-core");
const ytpl = require("@distube/ytpl");
const { enqueueTrack } = require("../player/musicPlayer");
const { searchYouTube } = require("../utils/ytSearch");
const { getSpotifyTracks, isSpotifyReady } = require("../utils/spotify");
const { createErrorEmbed, createSuccessEmbed, createInfoEmbed, createWarningEmbed } = require("../utils/embeds");
const { parseTitle } = require("../utils/lastfm");

function isYouTubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url);
}
function isYouTubePlaylist(url) {
  try { return new URL(url).searchParams.has("list"); } catch { return false; }
}
function isSpotifyUrl(url) {
  return /^(https?:\/\/)?(open\.spotify\.com)\/(track|album|playlist)\/[a-zA-Z0-9]+/.test(url);
}

async function handlePlay(query, user, guild, channel, client, interaction) {
  const send = (msg) => interaction ? interaction.editReply(msg).catch(() => {}) : channel.send(msg).catch(() => {});
  const { queueMap } = require("../player/musicPlayer");
  const isFirstSong = !queueMap.get(guild.id)?.playing;

  const member = guild.members.cache.get(user.id);
  if (!member?.voice.channel) return send({ embeds: [createErrorEmbed("You need to be in a voice channel!")] });
  if (!query) return send({ embeds: [createErrorEmbed("Please provide a YouTube link, Spotify link, or search term.")] });

  try {
    if (isYouTubeUrl(query)) {
      if (isYouTubePlaylist(query)) {
        const playlist = await ytpl(query, { limit: Infinity });
        if (!playlist?.items?.length) return send({ embeds: [createErrorEmbed("No videos found in playlist.")] });
        send({ embeds: [createInfoEmbed(`Found ${playlist.items.length} videos. Adding to queue...`)] });
        for (const video of playlist.items) {
          if (!video?.url) continue;
          enqueueTrack(guild.id, { title: video.title, url: video.url, requester: user }, client, channel);
        }
        send({ embeds: [createSuccessEmbed(`Added ${playlist.items.length} tracks from YouTube playlist.`)] });
      } else {
        const info = await ytdl.getInfo(query);
        const durationSeconds = parseInt(info.videoDetails.lengthSeconds) || 0;
        if (durationSeconds / 60 > 30) return send({ embeds: [createErrorEmbed("This is not even a song bruh! 😂")] });
        const { artist: a, track: t } = parseTitle(info.videoDetails.title);
        const track = { title: info.videoDetails.title, url: query, requester: user, duration: durationSeconds, artist: a, trackName: t };
        enqueueTrack(guild.id, track, client, channel);
        send({ embeds: [isFirstSong ? createInfoEmbed(`hollup, I'm getting ur track 🎵`) : createSuccessEmbed(`Added to queue: **${track.title}**`)] });
      }

    } else if (isSpotifyUrl(query)) {
      if (!isSpotifyReady()) return send({ embeds: [createErrorEmbed("Spotify API is still authorizing. Try again shortly.")] });
      let spotifyTracks;
      try {
        spotifyTracks = await getSpotifyTracks(query);
      } catch (err) {
        return send({ embeds: [createErrorEmbed("Couldn't fetch that Spotify link. It may be a private or curated playlist.")] });
      }
      if (!spotifyTracks.length) return send({ embeds: [createErrorEmbed("No tracks found for this Spotify URL.")] });
      send({ embeds: [createInfoEmbed(`Found ${spotifyTracks.length} track(s). Searching YouTube...`)] });
      for (const t of spotifyTracks) {
        const result = await searchYouTube(t.searchQuery).catch(() => null);
        if (result) enqueueTrack(guild.id, { title: result.title, url: result.url, requester: user, artist: t.artist, trackName: t.trackName }, client, channel);
      }
      send({ embeds: [createSuccessEmbed(`Added ${spotifyTracks.length} track(s) from Spotify.`)] });

    } else {
      const result = await searchYouTube(query);
      if (!result) return send({ embeds: [createErrorEmbed("No results found on YouTube.")] });
      console.log(`[${new Date().toLocaleTimeString()}] Search: "${query}" → ${result.title}`);
      const mins = (result.seconds || 0) / 60;
      if (mins > 30) return send({ embeds: [createErrorEmbed("This is not even a song bruh! 😂")] });
      if (mins > 15) return send({ embeds: [createWarningEmbed("Song too long ⚠️\nUse `!play <url>` or `/play <url>` to force play.")] });
      const { artist: a, track: t } = parseTitle(result.title);
      const track = { title: result.title, url: result.url, requester: user, duration: result.seconds || 0, artist: a, trackName: t };
      enqueueTrack(guild.id, track, client, channel);
      send({ embeds: [isFirstSong ? createInfoEmbed(`hollup, I'm getting ur track 🎵`) : createSuccessEmbed(`Added to queue: **${track.title}**`)] });
    }
  } catch (err) {
    console.error(err);
    send({ embeds: [createErrorEmbed("Could not play the track, please try again.")] });
  }
}

module.exports = {
  name: "play",
  description: "Plays a song from YouTube by URL, Spotify link, or search term.",
  execute(message, args, client) {
    process.nextTick(() => handlePlay(args.join(" "), message.author, message.guild, message.channel, client));
  },
  async slashExecute(interaction, client) {
    await interaction.deferReply();
    await handlePlay(interaction.options.getString("query"), interaction.user, interaction.guild, interaction.channel, client, interaction);
  },
};
