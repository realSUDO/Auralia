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
  async execute(message, args, client) {
    const voiceChannel = message.member.voice.channel;
    if (!voiceChannel) {
      return message.reply("You need to be in a voice channel to play music!");
    }

    if (args.length === 0) {
      return message.reply(
        "Please provide a YouTube link, Spotify link, or search term.",
      );
    }

    const query = args.join(" ");

    try {
      if (isYouTubeUrl(query)) {
        if (isYouTubePlaylist(query)) {
          // Handle YouTube playlist
          const playlist = await ytpl(query, { limit: Infinity });
          if (!playlist || !playlist.items || playlist.items.length === 0) {
            return message.reply("No videos found in the YouTube playlist.");
          }

          message.channel.send(
            `Found ${playlist.items.length} videos in YouTube playlist. Adding to queue...`,
          );

          for (const video of playlist.items) {
            if (!video || !video.url) continue;
            const track = {
              title: video.title,
              url: video.url,
              requester: message.author,
            };
            enqueueTrack(message.guild.id, track, client, message.channel);
          }

          return message.channel.send(
            `✅ Added ${playlist.items.length} tracks to the queue from YouTube playlist.`,
          );

        } else {
          // Handle YouTube single video URL - completely non-blocking
          setImmediate(async () => {
            try {
              const info = await ytdl.getInfo(query);
              const track = {
                title: info.videoDetails.title,
                url: query,
                requester: message.author,
              };
              enqueueTrack(message.guild.id, track, client, message.channel);
              message.channel.send(`✅ Added to queue: **${track.title}**`).catch(() => {});
            } catch (error) {
              console.error(error);
              message.channel.send("Could not fetch video info.").catch(() => {});
            }
          });
          return;
        }

      } else if (isSpotifyUrl(query)) {
        // Spotify URL handling (track, album, playlist)
        if (!isSpotifyReady()) {
          return message.reply(
            "⚠ Spotify API is still authorizing. Please try again shortly.",
          );
        }

        const spotifyTracks = await getSpotifyTracks(query);
        if (spotifyTracks.length === 0) {
          return message.reply("No tracks found for the provided Spotify URL.");
        }

        message.channel.send(
          `Found ${spotifyTracks.length} track(s) in Spotify link. Searching YouTube and adding to queue...`,
        );

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

        return message.channel.send(
          `✅ Added ${spotifyTracks.length} track(s) to the queue from Spotify.`,
        );

      } else {
        // Search term - search YouTube (completely non-blocking)
        console.log(`[${new Date().toLocaleTimeString()}] Deferring YouTube search for: ${query}`);
        setImmediate(async () => {
          console.log(`[${new Date().toLocaleTimeString()}] Starting YouTube search for: ${query}`);
          try {
            const searchResult = await searchYouTube(query);
            if (!searchResult) {
              message.reply("No results found on YouTube.").catch(() => {});
              return;
            }
            console.log(`[${new Date().toLocaleTimeString()}] Found: ${searchResult.title}`);
            const track = {
              title: searchResult.title,
              url: searchResult.url,
              requester: message.author,
            };
            enqueueTrack(message.guild.id, track, client, message.channel);
            message.channel.send(`✅ Added to queue: **${track.title}**`).catch(() => {});
          } catch (error) {
            console.error(error);
            message.reply("Could not search YouTube.").catch(() => {});
          }
        });
        console.log(`[${new Date().toLocaleTimeString()}] Command returned immediately`);
        return;
      }
    } catch (error) {
      console.error(error);
      return message.reply("Could not play the track, please try again later.");
    }
  },
};

