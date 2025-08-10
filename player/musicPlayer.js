const {
  joinVoiceChannel,
  createAudioPlayer,
  createAudioResource,
  AudioPlayerStatus,
  VoiceConnectionStatus,
  entersState,
} = require("@discordjs/voice");
const ytdl = require("ytdl-core");

// Holds the music queues for each guild
const queueMap = new Map();

async function enqueueTrack(guildId, track, client, textChannel) {
  let queue = queueMap.get(guildId);
  if (!queue) {
    // Initialize a new queue for the guild
    queue = {
      connection: null,
      player: null,
      voiceChannel: null,
      textChannel: textChannel || null,  // Store text channel for messages
      tracks: [],
      playing: false,
    };
    queueMap.set(guildId, queue);
  } else {
    // Always update text channel so messages go to the correct place
    queue.textChannel = textChannel || queue.textChannel;
  }
  queue.tracks.push(track);

  // Start playing if not already
  if (!queue.playing) {
    queue.playing = true;
    try {
      await startPlaying(guildId, client);
    } catch (error) {
      console.error("Error starting playback:", error);
      queue.playing = false;
      queue.tracks = [];
    }
  }
}

async function startPlaying(guildId, client) {
  const queue = queueMap.get(guildId);
  if (!queue) return;

  const track = queue.tracks[0];
  if (!track) {
    // No tracks: clean up voice connection safely
    if (queue.connection && !queue.connection.destroyed) {
      queue.connection.destroy();
    }
    queueMap.delete(guildId);
    return;
  }

  // Join voice channel if no active connection
  if (!queue.connection) {
    const guild = client.guilds.cache.get(guildId);
    if (!guild) return;

    const member = guild.members.cache.get(track.requester.id);
    if (!member || !member.voice.channel) {
      // Inform user if they're not in a voice channel
      queue.textChannel?.send("You need to be in a voice channel to play music!");
      return;
    }

    queue.voiceChannel = member.voice.channel;
    queue.connection = joinVoiceChannel({
      channelId: queue.voiceChannel.id,
      guildId: guildId,
      adapterCreator: guild.voiceAdapterCreator,
    });

    // WAIT for voice connection to become ready, or abort
    try {
      await entersState(queue.connection, VoiceConnectionStatus.Ready, 15_000);
    } catch (error) {
      queue.textChannel?.send("Failed to join voice channel.");
      queue.connection?.destroy();
      queueMap.delete(guildId);
      return;
    }

    // Create audio player and subscribe to the connection
    queue.player = createAudioPlayer();
    queue.connection.subscribe(queue.player);

    // Handle track end to play next track or disconnect
    queue.player.on(AudioPlayerStatus.Idle, () => {
      // Remove the track that just finished
      queue.tracks.shift();
      if (queue.tracks.length > 0) {
        // Play next track
        startPlaying(guildId, client);
      } else {
        // No more tracks, stop playing and disconnect
        queue.playing = false;
        if (queue.connection && !queue.connection.destroyed) {
          queue.connection.destroy();
        }
        queueMap.delete(guildId);
      }
    });

    // Handle audio player errors gracefully
    queue.player.on("error", (error) => {
      console.error(`Player error: ${error.message}`);
      queue.tracks.shift(); // Skip problematic track
      if (queue.tracks.length > 0) {
        startPlaying(guildId, client);
      } else {
        queue.playing = false;
        if (queue.connection && !queue.connection.destroyed) {
          queue.connection.destroy();
        }
        queueMap.delete(guildId);
      }
    });
  }

  // Create a stream from YouTube using ytdl-core and listen for errors
  const stream = ytdl(track.url, {
    filter: "audioonly",
    quality: "highestaudio",
    highWaterMark: 1 << 25, // Improves stream buffering
  });

  stream.on("error", (error) => {
    console.error("ytdl stream error:", error);
    queue.textChannel?.send(
      `❌ Error playing track: **${track.title}**. It might be unavailable or removed.`
    );
    // Remove the faulty track and attempt next
    queue.tracks.shift();
    if (queue.tracks.length > 0) {
      startPlaying(guildId, client);
    } else {
      queue.playing = false;
      if (queue.connection && !queue.connection.destroyed) {
        queue.connection.destroy();
      }
      queueMap.delete(guildId);
    }
  });

  // Create audio resource from the stream and start playback
  const resource = createAudioResource(stream);

  queue.player.play(resource);

  // Announce now playing
  queue.textChannel?.send(
    `🎶 Now playing: **${track.title}** (requested by ${track.requester.username})`
  );
}

module.exports = {
  enqueueTrack,
  queueMap,
};

