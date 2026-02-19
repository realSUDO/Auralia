const ytdl = require("@distube/ytdl-core"); // For YouTube video handling
const ytpl = require("@distube/ytpl"); // For YouTube playlist handling
const { enqueueTrack } = require("../player/musicPlayer");
const { searchYouTube } = require("../utils/ytSearch");
const { getSpotifyTracks, isSpotifyReady } = require("../utils/spotify"); // Spotify readiness flag

function isYouTubeUrl(url) {
  return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/i.test(url);
}

// Detects if a YouTube URL is a playlist (contains "list" query parameter)
function isYouTubePlaylist(url) {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.has("list");
  } catch {
    return false;
  }
}

function isSpotifyUrl(url) {
  return /^(https?:\/\/)?(open\.spotify\.com)\/(track|album|playlist)\/[a-zA-Z0-9]+/.test(
    url,
  );
}

module.exports = {
  name: "play",
  description:
    "Plays a song from YouTube by URL, Spotify link, or search term.",
  execute(message, args, client) {
    // Immediately return - do EVERYTHING in background
    process.nextTick(async () => {
      const voiceChannel = message.member.voice.channel;
      if (!voiceChannel) {
        const { createErrorEmbed } = require("../utils/embeds");
        return message.reply({ embeds: [createErrorEmbed("You need to be in a voice channel to play music!")] }).catch(() => {});
      }

      if (args.length === 0) {
        const { createErrorEmbed } = require("../utils/embeds");
        return message.reply({ embeds: [createErrorEmbed("Please provide a YouTube link, Spotify link, or search term.")] }).catch(() => {});
      }

      const query = args.join(" ");

      try {
        if (isYouTubeUrl(query)) {
          if (isYouTubePlaylist(query)) {
            // Handle YouTube playlist
            const playlist = await ytpl(query, { limit: Infinity });
            if (!playlist || !playlist.items || playlist.items.length === 0) {
              const { createErrorEmbed } = require("../utils/embeds");
              return message.reply({ embeds: [createErrorEmbed("No videos found in the YouTube playlist.")] }).catch(() => {});
            }

            const { createInfoEmbed } = require("../utils/embeds");
            message.channel.send({ embeds: [createInfoEmbed(`Found ${playlist.items.length} videos in YouTube playlist. Adding to queue...`)] }).catch(() => {});

            for (const video of playlist.items) {
              if (!video || !video.url) continue;
              const track = {
                title: video.title,
                url: video.url,
                requester: message.author,
              };
              enqueueTrack(message.guild.id, track, client, message.channel);
            }

            const { createSuccessEmbed } = require("../utils/embeds");
            return message.channel.send({ 
              embeds: [createSuccessEmbed(`Added ${playlist.items.length} tracks to the queue from YouTube playlist.`)] 
            }).catch(() => {});

          } else {
            // Handle YouTube single video URL
            try {
              const info = await ytdl.getInfo(query);
              const track = {
                title: info.videoDetails.title,
                url: query,
                requester: message.author,
              };
              enqueueTrack(message.guild.id, track, client, message.channel);
              const { createSuccessEmbed } = require("../utils/embeds");
              message.channel.send({ embeds: [createSuccessEmbed(`Added to queue: **${track.title}**`)] }).catch(() => {});
            } catch (error) {
              console.error(error);
              const { createErrorEmbed } = require("../utils/embeds");
              message.channel.send({ embeds: [createErrorEmbed("Could not fetch video info.")] }).catch(() => {});
            }
          }

        } else if (isSpotifyUrl(query)) {
          // Spotify URL handling (track, album, playlist)
          const { createErrorEmbed, createInfoEmbed } = require("../utils/embeds");
          if (!isSpotifyReady()) {
            return message.reply({ embeds: [createErrorEmbed("Spotify API is still authorizing. Please try again shortly.")] }).catch(() => {});
          }

          const spotifyTracks = await getSpotifyTracks(query);
          if (spotifyTracks.length === 0) {
            return message.reply({ embeds: [createErrorEmbed("No tracks found for the provided Spotify URL.")] }).catch(() => {});
          }

          message.channel.send({ embeds: [createInfoEmbed(`Found ${spotifyTracks.length} track(s) in Spotify link. Searching YouTube and adding to queue...`)] }).catch(() => {});

          for (const trackName of spotifyTracks) {
            const searchResult = await searchYouTube(trackName);
            if (searchResult) {
              const ytTrack = {
                title: searchResult.title,
                url: searchResult.url,
                requester: message.author,
              };
              enqueueTrack(message.guild.id, ytTrack, client, message.channel);
            }
          }

          const { createSuccessEmbed } = require("../utils/embeds");
          return message.channel.send({ 
            embeds: [createSuccessEmbed(`Added ${spotifyTracks.length} track(s) to the queue from Spotify.`)] 
          }).catch(() => {});

        } else {
          // Search term - search YouTube
          console.log(`[${new Date().toLocaleTimeString()}] Starting YouTube search for: ${query}`);
          try {
            const searchResult = await searchYouTube(query);
            if (!searchResult) {
              const { createErrorEmbed } = require("../utils/embeds");
              message.reply({ embeds: [createErrorEmbed("No results found on YouTube.")] }).catch(() => {});
              return;
            }
            console.log(`[${new Date().toLocaleTimeString()}] Found: ${searchResult.title}`);
            const track = {
              title: searchResult.title,
              url: searchResult.url,
              requester: message.author,
            };
            enqueueTrack(message.guild.id, track, client, message.channel);
            const { createSuccessEmbed } = require("../utils/embeds");
            message.channel.send({ embeds: [createSuccessEmbed(`Added to queue: **${track.title}**`)] }).catch(() => {});
          } catch (error) {
            console.error(error);
            const { createErrorEmbed } = require("../utils/embeds");
            message.reply({ embeds: [createErrorEmbed("Could not search YouTube.")] }).catch(() => {});
          }
        }
      } catch (error) {
        console.error(error);
        const { createErrorEmbed } = require("../utils/embeds");
        message.reply({ embeds: [createErrorEmbed("Could not play the track, please try again later.")] }).catch(() => {});
      }
    });
  },
};

