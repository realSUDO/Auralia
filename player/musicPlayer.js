// player/musicPlayer.js
const {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	entersState,
} = require("@discordjs/voice");
const youtubedl = require("youtube-dl-exec");

const queueMap = new Map();

/**
 * Enqueue a track and start playing if idle
 */
function enqueueTrack(guildId, track, client, textChannel) {
	console.log(`[${new Date().toLocaleTimeString()}] Enqueuing track: ${track.title}`);
	
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
			intentionalStop: false,
			currentStream: null,
			aloneTimer: null,
		};
		queueMap.set(guildId, queue);
	} else {
		queue.textChannel = textChannel || queue.textChannel;
	}

	queue.tracks.push(track);
	console.log(`[${new Date().toLocaleTimeString()}] Queue length: ${queue.tracks.length}`);

	if (!queue.playing) {
		queue.playing = true;
		console.log(`[${new Date().toLocaleTimeString()}] Starting playback...`);
		startPlaying(guildId, client).catch(err => {
			console.error("Error starting playback:", err);
			queue.playing = false;
			queue.tracks = [];
		});
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

	console.log("Track URL:", track.url);
	console.log(`[${new Date().toLocaleTimeString()}] Starting to play: ${track.title}`);

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
			queue.textChannel?.send("Failed to join voice channel.").catch(() => {});
			safeDestroy(queue);
			queueMap.delete(guildId);
			return;
		}

		// Start monitoring voice channel for alone status
		startAloneMonitoring(guildId, client);

		// Create a fresh player and remove old listeners if reusing
		if (queue.player) {
			queue.player.removeAllListeners();
		}
		queue.player = createAudioPlayer();
		queue.connection.subscribe(queue.player);

		// Attach player events ONCE
		queue.player.on(AudioPlayerStatus.Idle, () => {
			queue.intentionalStop = false;
			queue.tracks.shift();
			if (queue.tracks.length > 0) {
				startPlaying(guildId, client);
			} else {
				queue.playing = false;
				// Don't leave VC, just stop playing - alone monitoring will handle leaving if needed
			}
		});

		queue.player.on("error", (error) => {
			if (queue.cleanupInProgress || queue.intentionalStop) return;
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
	let ytdlpProcess;
	try {
		const { spawn } = require('child_process');
		ytdlpProcess = spawn('yt-dlp', [
			'-f', 'bestaudio',
			'-o', '-',
			'--no-playlist',
			'--quiet',
			track.url
		]);
		stream = ytdlpProcess.stdout;
		queue.currentStream = stream;
		
		let streamStarted = false;
		
		// Wait for stream to actually start before playing
		stream.once('readable', () => {
			if (streamStarted || queue.intentionalStop) return;
			streamStarted = true;
			
			const resource = createAudioResource(stream);
			queue.player.play(resource);
			
			queue.textChannel?.send(
				`🎶 Now playing: **${track.title}** (requested by ${track.requester.username})`,
			);
		});
		
		stream.once("error", (error) => {
			if (queue.cleanupInProgress || queue.intentionalStop || queue.currentStream !== stream) return;
			queue.cleanupInProgress = true;

			console.error("ytdl stream error:", error.message);

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
		
		ytdlpProcess.on('error', (error) => {
			if (queue.cleanupInProgress || queue.intentionalStop) return;
			queue.cleanupInProgress = true;
			console.error("yt-dlp process error:", error.message);
			queue.textChannel?.send(`❌ Error loading **${track.title}**, skipping...`).catch(() => {});
			skipTrack(queue, guildId, client);
		});
		
	} catch (error) {
		console.error("ytdl stream error:", error);
		queue.textChannel?.send(`❌ Error loading **${track.title}**, skipping...`);
		skipTrack(queue, guildId, client);
		return;
	}
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
	if (queue.aloneTimer) {
		clearTimeout(queue.aloneTimer);
		queue.aloneTimer = null;
	}
	if (queue.connection) {
		try {
			if (queue.connection.state.status !== 'destroyed') {
				queue.connection.destroy();
			}
		} catch (e) {
			// Already destroyed
		}
	}
}

/**
 * Monitor if bot is alone in voice channel
 */
function startAloneMonitoring(guildId, client) {
	const queue = queueMap.get(guildId);
	if (!queue || !queue.voiceChannel) return;

	const checkAlone = () => {
		const queue = queueMap.get(guildId);
		if (!queue || !queue.voiceChannel) return;

		const members = queue.voiceChannel.members.filter(m => !m.user.bot);
		
		if (members.size === 0) {
			// Bot is alone, start timer
			if (!queue.aloneTimer) {
				queue.aloneTimer = setTimeout(() => {
					const q = queueMap.get(guildId);
					if (q) {
						q.textChannel?.send("⏹️ Left voice channel due to inactivity.").catch(() => {});
						q.tracks = [];
						q.playing = false;
						if (q.player) q.player.stop();
						safeDestroy(q);
						queueMap.delete(guildId);
					}
				}, 60000); // 1 minute
			}
		} else {
			// Users present, clear timer
			if (queue.aloneTimer) {
				clearTimeout(queue.aloneTimer);
				queue.aloneTimer = null;
			}
		}
	};

	// Check immediately
	checkAlone();

	// Monitor voice state updates
	const voiceStateHandler = (oldState, newState) => {
		if (oldState.channelId === queue.voiceChannel?.id || newState.channelId === queue.voiceChannel?.id) {
			checkAlone();
		}
	};

	client.on('voiceStateUpdate', voiceStateHandler);
}

/**
 * Stop playback without leaving
 */
function stopPlayback(guildId) {
	const queue = queueMap.get(guildId);
	if (!queue) return false;

	console.log(`[${new Date().toLocaleTimeString()}] Stopping playback for guild ${guildId}`);
	
	queue.tracks = [];
	queue.playing = false;
	queue.intentionalStop = true;
	queue.cleanupInProgress = true; // Prevent any error handlers from firing
	
	if (queue.player) {
		queue.player.stop();
	}
	
	// Reset flags after a short delay
	setTimeout(() => {
		const q = queueMap.get(guildId);
		if (q && q.intentionalStop) {
			q.intentionalStop = false;
			q.cleanupInProgress = false;
		}
	}, 500);
	
	return true;
}

module.exports = {
	enqueueTrack,
	queueMap,
	stopPlayback,
};
