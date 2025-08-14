// player/musicPlayer.js
const {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	entersState,
} = require("@discordjs/voice");
const ytdl = require("@distube/ytdl-core");

const queueMap = new Map();

/**
 * Enqueue a track and start playing if idle
 */
async function enqueueTrack(guildId, track, client, textChannel) {
	let queue = queueMap.get(guildId);

	if (!queue) {
		queue = {
			connection: null,
			player: null,
			voiceChannel: null,
			textChannel: textChannel || null,
			tracks: [],
			playing: false,
			cleanupInProgress: false,
		};
		queueMap.set(guildId, queue);
	} else {
		queue.textChannel = textChannel || queue.textChannel;
	}

	queue.tracks.push(track);

	if (!queue.playing) {
		queue.playing = true;
		try {
			await startPlaying(guildId, client);
		} catch (err) {
			console.error("Error starting playback:", err);
			queue.playing = false;
			queue.tracks = [];
		}
	}
}

/**
 * Start playing the first track in the queue
 */
async function startPlaying(guildId, client) {
	const queue = queueMap.get(guildId);
	if (!queue) return;

	const track = queue.tracks[0];
	if (!track) {
		safeDestroy(queue);
		queueMap.delete(guildId);
		return;
	}

	// Reset cleanup flag before starting this track
	queue.cleanupInProgress = false;

	// If no active voice connection, join and setup the player
	if (!queue.connection) {
		const guild = client.guilds.cache.get(guildId);
		if (!guild) return;

		const member = guild.members.cache.get(track.requester.id);
		if (!member || !member.voice.channel) {
			queue.textChannel?.send(
				"You need to be in a voice channel to play music!",
			);
			return;
		}

		queue.voiceChannel = member.voice.channel;
		queue.connection = joinVoiceChannel({
			channelId: queue.voiceChannel.id,
			guildId,
			adapterCreator: guild.voiceAdapterCreator,
		});

		try {
			await entersState(queue.connection, VoiceConnectionStatus.Ready, 15_000);
		} catch {
			queue.textChannel?.send("Failed to join voice channel.");
			safeDestroy(queue);
			queueMap.delete(guildId);
			return;
		}

		// Create a fresh player and remove old listeners if reusing
		if (queue.player) {
			queue.player.removeAllListeners();
		}
		queue.player = createAudioPlayer();
		queue.connection.subscribe(queue.player);

		// Attach player events ONCE
		queue.player.on(AudioPlayerStatus.Idle, () => {
			queue.tracks.shift();
			if (queue.tracks.length > 0) {
				startPlaying(guildId, client);
			} else {
				queue.playing = false;
				safeDestroy(queue);
				queueMap.delete(guildId);
			}
		});

		queue.player.on("error", (error) => {
			if (queue.cleanupInProgress) return;
			queue.cleanupInProgress = true;

			console.error(`Player error: ${error.message}`);

			if (
				error.message.includes("Sign in to confirm your age") ||
				error.message.includes("UnrecoverableError")
			) {
				queue.textChannel?.send(
					`⚠ Skipping track **${queue.tracks[0]?.title || "Unknown"}** — age restricted/blocked.`,
				);
			} else {
				queue.textChannel?.send(
					`⚠ Skipping track **${queue.tracks[0]?.title || "Unknown"}** due to playback error.`,
				);
			}

			skipTrack(queue, guildId, client);
		});
	}

	// Create a new stream for the current track
	let stream;
	try {
		stream = ytdl(track.url, {
			filter: "audioonly",
			quality: "highestaudio",
			format: "251",
			highWaterMark: 1 << 25,
		});
	} catch {
		queue.textChannel?.send(`❌ Error loading **${track.title}**, skipping...`);
		skipTrack(queue, guildId, client);
		return;
	}

	// Only run the stream's error handler once
	stream.once("error", (error) => {
		if (queue.cleanupInProgress) return;
		queue.cleanupInProgress = true;

		console.error("ytdl stream error:", error);

		if (
			error.message.includes("Sign in to confirm your age") ||
			error.message.includes("UnrecoverableError")
		) {
			queue.textChannel?.send(
				`⚠ Skipping track **${queue.tracks[0]?.title || "Unknown"}** — age restricted/blocked.`,
			);
		} else {
			queue.textChannel?.send(
				`❌ Stream error on track **${queue.tracks[0]?.title || "Unknown"}**, skipping.`,
			);
		}

		skipTrack(queue, guildId, client);
	});

	const resource = createAudioResource(stream);
	queue.player.play(resource);

	queue.textChannel?.send(
		`🎶 Now playing: **${track.title}** (requested by ${track.requester.username})`,
	);
}

/**
 * Skip current track and continue or clean up
 */
function skipTrack(queue, guildId, client) {
	queue.tracks.shift();
	if (queue.tracks.length > 0) {
		queue.cleanupInProgress = false; // Reset for next track
		startPlaying(guildId, client);
	} else {
		queue.playing = false;
		safeDestroy(queue);
		queueMap.delete(guildId);
	}
}

/**
 * Safely destroy voice connection
 */
function safeDestroy(queue) {
	if (queue.connection && !queue.connection.destroyed) {
		queue.connection.destroy();
	}
}

module.exports = {
	enqueueTrack,
	queueMap,
};
