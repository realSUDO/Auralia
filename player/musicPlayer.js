// player/musicPlayer.js
const {
	joinVoiceChannel,
	createAudioPlayer,
	createAudioResource,
	AudioPlayerStatus,
	VoiceConnectionStatus,
	entersState,
} = require("@discordjs/voice");
const fs = require("fs");
const { spawn } = require("child_process");
const { getDirectAudioUrl, createSeekableStream } = require("../utils/seek");
const { preloadNextTrack, cleanupPreload, isTrackPreloaded } = require("../utils/preload");
const { updatePlayerUI, disablePlayerUI } = require("../utils/playerUI");

const queueMap = new Map();
const queueHistory = new Map(); // Store last 10 songs per guild

/**
 * Enqueue a track and start playing if idle
 */
function enqueueTrack(guildId, track, client, textChannel) {
	const enqueueStartTime = process.hrtime.bigint();
	console.log(`[${new Date().toLocaleTimeString()}] enqueueTrack called for: ${track.title}`);
	
	// Defer ALL operations to not block current playback
	setImmediate(() => {
		const deferredStartTime = process.hrtime.bigint();
		const deferDelay = Number(deferredStartTime - enqueueStartTime) / 1000000;
		console.log(`[${new Date().toLocaleTimeString()}] enqueueTrack deferred execution started (delay: ${deferDelay.toFixed(2)}ms)`);
		
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
				preloadProcess: null,
				preloadedTrack: null,
				currentTrack: null,
				playbackStartTime: null,
				playbackOffset: 0,
				audioUrl: null,
				duration: 0,
				isPaused: false,
				playerMessage: null,
				isSeeking: false,
			};
			queueMap.set(guildId, queue);
		} else {
			queue.textChannel = textChannel || queue.textChannel;
		}

		queue.tracks.push(track);
		console.log(`[${new Date().toLocaleTimeString()}] Track added to queue. Queue length: ${queue.tracks.length}`);

		if (!queue.playing) {
			queue.playing = true;
			console.log(`[${new Date().toLocaleTimeString()}] Starting playback...`);
			startPlaying(guildId, client).catch(err => {
				console.error("Error starting playback:", err);
				queue.playing = false;
				queue.tracks = [];
			});
		} else {
			console.log(`[${new Date().toLocaleTimeString()}] Already playing, track queued`);
			// If already playing and this is the next song, start preloading
			if (queue.tracks.length === 2) {
				setImmediate(() => {
					const q = queueMap.get(guildId);
					if (q && q.tracks.length >= 2) {
						console.log(`[${new Date().toLocaleTimeString()}] Starting preload for next track`);
						preloadNextTrack(guildId, q.tracks[1], q);
					}
				});
			}
		}
		
		const deferredEndTime = process.hrtime.bigint();
		const deferredDuration = Number(deferredEndTime - deferredStartTime) / 1000000;
		console.log(`[${new Date().toLocaleTimeString()}] enqueueTrack deferred execution completed (took: ${deferredDuration.toFixed(2)}ms)`);
	});
	
	const enqueueEndTime = process.hrtime.bigint();
	const enqueueDuration = Number(enqueueEndTime - enqueueStartTime) / 1000000;
	console.log(`[${new Date().toLocaleTimeString()}] enqueueTrack returned (took: ${enqueueDuration.toFixed(2)}ms)`);
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

	// Store current track
	queue.currentTrack = track;
	
	// Add to history (avoid duplicates of same URL)
	if (!queueHistory.has(guildId)) {
		queueHistory.set(guildId, []);
	}
	const history = queueHistory.get(guildId);
	// Only add if it's not the same as the last song in history
	if (history.length === 0 || history[history.length - 1].url !== track.url) {
		history.push(track);
		if (history.length > 10) {
			history.shift(); // Keep only last 10
		}
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
			// Ignore Idle if we're seeking
			if (queue.isSeeking) {
				console.log(`[${new Date().toLocaleTimeString()}] Ignoring Idle - seeking in progress`);
				return;
			}
			
			console.log(`[${new Date().toLocaleTimeString()}] Player status: Idle (song ended)`);
			
			// Clear progress interval
			if (queue.progressInterval) {
				clearInterval(queue.progressInterval);
				queue.progressInterval = null;
			}
			
			// Delete previous player message
			if (queue.playerMessage) {
				queue.playerMessage.delete().catch(() => {});
				queue.playerMessage = null;
			}
			
			queue.intentionalStop = false;
			
			// Handle replay mode
			if (queue.isReplaying) {
				console.log(`[${new Date().toLocaleTimeString()}] Replaying current track`);
				queue.isReplaying = false;
				startPlaying(guildId, client);
				return;
			}
			
			// Handle loop mode
			if (queue.isLooping && queue.currentTrack) {
				console.log(`[${new Date().toLocaleTimeString()}] Looping current track`);
				queue.tracks.unshift(queue.currentTrack);
				startPlaying(guildId, client);
				return;
			}
			
			queue.tracks.shift();
			// Don't cleanup here - let startPlaying handle it
			if (queue.tracks.length > 0) {
				console.log(`[${new Date().toLocaleTimeString()}] Playing next track from queue`);
				startPlaying(guildId, client);
			} else {
				console.log(`[${new Date().toLocaleTimeString()}] Queue empty, playback stopped`);
				cleanupPreload(queue);
				queue.playing = false;
				const { createSuccessEmbed } = require("../utils/embeds");
				queue.textChannel?.send({ embeds: [createSuccessEmbed("All songs played.")] }).catch(() => {});
				// Don't leave VC, just stop playing - alone monitoring will handle leaving if needed
			}
		});
		
		queue.player.on(AudioPlayerStatus.Playing, () => {
			console.log(`[${new Date().toLocaleTimeString()}] Player status: Playing`);
			queue.isPaused = false;
			// Only update UI if we already have a player message (for pause/resume)
			if (queue.currentTrack && queue.playerMessage) {
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
			}
		});
		
		queue.player.on(AudioPlayerStatus.Paused, () => {
			console.log(`[${new Date().toLocaleTimeString()}] Player status: Paused`);
			queue.isPaused = true;
			if (queue.currentTrack && queue.playerMessage) {
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
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
	
	// Check if this track is preloaded
	if (isTrackPreloaded(queue, track.url)) {
		console.log(`[${new Date().toLocaleTimeString()}] Using preloaded file for: ${track.title}`);
		stream = fs.createReadStream(queue.preloadedTrack.filePath);
		queue.currentStream = stream;
		
		const resource = createAudioResource(stream);
		queue.player.play(resource);
		queue.playbackStartTime = Date.now();
		queue.playbackOffset = 0;
		
		// Update player UI
		updatePlayerUI(queue, track, queue.textChannel).catch(console.error);
		
		// Clean up preloaded file after playback starts
		const fileToDelete = queue.preloadedTrack.filePath;
		queue.preloadedTrack = null;
		
		// Delete file after a short delay to ensure stream has started
		setTimeout(() => {
			try {
				if (fs.existsSync(fileToDelete)) {
					fs.unlinkSync(fileToDelete);
					console.log(`[${new Date().toLocaleTimeString()}] Cleaned up preload file`);
				}
			} catch (e) {
				console.error("Error cleaning preload file:", e.message);
			}
		}, 2000);
		
		// Preload next track if available
		if (queue.tracks.length > 1) {
			preloadNextTrack(guildId, queue.tracks[1], queue);
		}
		
		return;
	}
	
	// Stream directly if not preloaded
	try {
		ytdlpProcess = spawn('yt-dlp', [
			'-f', 'bestaudio',
			'-o', '-',
			'--no-playlist',
			'--quiet',
			track.url
		]);
		stream = ytdlpProcess.stdout;
		queue.currentStream = stream;
		queue.playbackOffset = 0;
		
		// Fetch audio info in background for seeking support (non-blocking)
		getDirectAudioUrl(track.url).then(audioInfo => {
			if (audioInfo && queue.currentStream === stream) {
				queue.audioUrl = audioInfo.url;
				queue.duration = audioInfo.duration;
			}
		}).catch(() => {});
		
		let streamStarted = false;
		
		// Wait for stream to actually start before playing
		stream.once('readable', () => {
			if (streamStarted || queue.intentionalStop) return;
			streamStarted = true;
			
			console.log(`[${new Date().toLocaleTimeString()}] Stream readable, creating audio resource`);
			const resource = createAudioResource(stream);
			
			console.log(`[${new Date().toLocaleTimeString()}] Starting audio player`);
			queue.player.play(resource);
			queue.playbackStartTime = Date.now();
			
			console.log(`[${new Date().toLocaleTimeString()}] Audio player started successfully`);
			
			// Update player UI
			updatePlayerUI(queue, track, queue.textChannel).catch(console.error);
			
			// Start preloading next track
			if (queue.tracks.length > 1) {
				console.log(`[${new Date().toLocaleTimeString()}] Triggering preload for next track`);
				preloadNextTrack(guildId, queue.tracks[1], queue);
			}
		});
		
		stream.once("error", (error) => {
			if (queue.cleanupInProgress || queue.intentionalStop || queue.currentStream !== stream) return;
			
			console.error("ytdl stream error:", error.message);

			// Ignore premature close if playback already started successfully
			if (error.message.includes("Premature close") && streamStarted) {
				console.log(`[${new Date().toLocaleTimeString()}] Ignoring premature close - playback already started`);
				return;
			}
			
			queue.cleanupInProgress = true;

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
		console.error("ytdl stream error:", error.message);
		queue.textChannel?.send(`❌ Error loading **${track.title}**, skipping...`).catch(() => {});
		skipTrack(queue, guildId, client);
		return;
	}
}

/**
 * Skip current track and continue or clean up
 */
function skipTrack(queue, guildId, client) {
	queue.tracks.shift();
	// Don't cleanup preload here - let startPlaying use it if available
	if (queue.tracks.length > 0) {
		queue.cleanupInProgress = false; // Reset for next track
		startPlaying(guildId, client);
	} else {
		cleanupPreload(queue);
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
	cleanupPreload(queue);
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
						const { createInfoEmbed } = require("../utils/embeds");
						q.textChannel?.send({ embeds: [createInfoEmbed("Left voice channel due to inactivity.")] }).catch(() => {});
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
 * Seek forward/backward in current track
 */
async function seekTrack(guildId, offsetSeconds, client) {
	const queue = queueMap.get(guildId);
	if (!queue || !queue.currentTrack || !queue.audioUrl) return false;

	// Calculate current position
	const now = Date.now();
	const elapsed = queue.playbackStartTime ? (now - queue.playbackStartTime) / 1000 : 0;
	const currentPosition = queue.playbackOffset + elapsed;
	
	// Calculate new position
	let newPosition = currentPosition + offsetSeconds;
	newPosition = Math.max(0, Math.min(newPosition, queue.duration));
	
	console.log(`[${new Date().toLocaleTimeString()}] Seeking from ${currentPosition.toFixed(1)}s to ${newPosition.toFixed(1)}s`);
	
	// Set seeking flag BEFORE stopping current playback
	queue.isSeeking = true;
	
	// Create new stream at new position
	const stream = createSeekableStream(queue.audioUrl, newPosition);
	queue.currentStream = stream;
	queue.playbackOffset = newPosition;
	queue.playbackStartTime = Date.now();
	
	// Create and play resource immediately
	const resource = createAudioResource(stream);
	queue.player.play(resource);
	
	// Reset flag after player stabilizes
	setTimeout(() => {
		queue.isSeeking = false;
		console.log(`[${new Date().toLocaleTimeString()}] Seek completed`);
	}, 1500);
	
	return true;
}

/**
 * Replay current song
 */
function replayCurrentSong(guildId) {
	const queue = queueMap.get(guildId);
	if (!queue || !queue.currentTrack) return false;

	// Mark as replay so Idle handler doesn't shift the queue
	queue.isReplaying = true;
	queue.intentionalStop = true;
	
	// Delete current player message
	if (queue.playerMessage) {
		queue.playerMessage.delete().catch(() => {});
		queue.playerMessage = null;
	}
	
	// Clear progress interval
	if (queue.progressInterval) {
		clearInterval(queue.progressInterval);
		queue.progressInterval = null;
	}
	
	if (queue.player) {
		queue.player.stop();
	}
	
	return true;
}

/**
 * Replay last queue
 */
function replayLastQueue(guildId, client, textChannel, requester) {
	const history = queueHistory.get(guildId);
	if (!history || history.length === 0) return 0;

	let queue = queueMap.get(guildId);
	
	// If no queue exists, create one
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
			preloadProcess: null,
			preloadedTrack: null,
			currentTrack: null,
			playbackStartTime: null,
			playbackOffset: 0,
			audioUrl: null,
			duration: 0,
			isPaused: false,
			playerMessage: null,
			isSeeking: false,
			isLooping: false,
			isReplaying: false,
			progressInterval: null,
		};
		queueMap.set(guildId, queue);
	}

	// Add all history songs to queue with updated requester
	history.forEach(track => {
		queue.tracks.push({
			...track,
			requester: requester || track.requester
		});
	});

	// Start playing if not already playing
	if (!queue.playing && queue.tracks.length > 0) {
		queue.playing = true;
		startPlaying(guildId, client).catch(err => {
			console.error("Error starting playback:", err);
			queue.playing = false;
		});
	} else if (queue.tracks.length >= 2) {
		// Trigger preload for next song if already playing
		setImmediate(() => {
			const q = queueMap.get(guildId);
			if (q && q.tracks.length >= 2) {
				preloadNextTrack(guildId, q.tracks[1], q);
			}
		});
	}

	return history.length;
}

/**
 * Shuffle queue
 */
function shuffleQueue(guildId) {
	const queue = queueMap.get(guildId);
	if (!queue || queue.tracks.length <= 1) return false;

	// Keep first track (currently playing), shuffle the rest
	const firstTrack = queue.tracks[0];
	const restTracks = queue.tracks.slice(1);
	
	// Fisher-Yates shuffle
	for (let i = restTracks.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[restTracks[i], restTracks[j]] = [restTracks[j], restTracks[i]];
	}
	
	queue.tracks = [firstTrack, ...restTracks];
	
	// Update preload for new next track
	cleanupPreload(queue);
	if (queue.tracks.length >= 2) {
		setImmediate(() => {
			const q = queueMap.get(guildId);
			if (q && q.tracks.length >= 2) {
				preloadNextTrack(guildId, q.tracks[1], q);
			}
		});
	}
	
	return true;
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
	queue.cleanupInProgress = true;
	
	cleanupPreload(queue);
	
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
	queueHistory,
	stopPlayback,
	replayCurrentSong,
	replayLastQueue,
	shuffleQueue,
};
