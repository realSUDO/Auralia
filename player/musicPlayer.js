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
const { getSimilarTracks } = require("../utils/lastfm");
const { updatePlayerUI, disablePlayerUI } = require("../utils/playerUI");
const { cleanupPreload, isTrackPreloaded, preloadCurrentTrack, preloadNextTrack, preloadPreviousTrack, preloadAutoplaySuggestion } = require("../utils/preload");
const { fetchAutoplaySuggestion, getMoodPlaylist, getVibeShiftGenre } = require("../recommendation-engine");

const queueMap = new Map();
const queueHistory = new Map(); // Store last 10 songs per guild

/**
 * Enqueue a track and start playing if idle
 */
function enqueueTrack(guildId, track, client, textChannel) {
	setImmediate(() => {
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
				preloadCurrentProcess: null,
				preloadNextProcess: null,
				preloadPrevProcess: null,
				preloadAutoplayProcess: null,
				preloadedCurrent: null,
				preloadedNext: null,
				preloadedPrev: null,
				preloadedAutoplay: null,
				currentTrack: null,
				playbackStartTime: null,
				playbackOffset: 0,
				audioUrl: null,
				duration: 0,
				isPaused: false,
				playerMessage: null,
				isSeeking: false,
				voiceStateHandler: null,
				volume: 100,
				autoplay: false,
				autoplaySuggestion: null,
				autoplayHistory: new Set(),
				moodActive: false,
				moodGenre: null,
				moodStrict: false,
				moodSongsPlayed: 0,
				vibeShiftCount: 0,
				drift: false,
			};
			queueMap.set(guildId, queue);
		} else {
			queue.textChannel = textChannel || queue.textChannel;
		}

		// User track: remove all pending autoplay songs, insert user track at end of user songs
		if (!track.isAutoPlaySong && queue.playing) {
			// Strip all autoplay songs from queue (keep tracks[0] = currently playing)
			queue.tracks = queue.tracks.filter((t, i) => i === 0 || !t.isAutoPlaySong);
			// Clear stale autoplay suggestion/preload
			queue.autoplaySuggestion = null;
			if (queue.preloadAutoplayProcess) { queue.preloadAutoplayProcess.kill(); queue.preloadAutoplayProcess = null; }
			queue.preloadedAutoplay = null;
			queue.vibeShiftCount = 0;
			// User took manual control — reset mood state
			queue.moodActive = false;
			queue.moodGenre = null;
			queue.moodSongsPlayed = 0;
			queue.tracks.push(track);
		} else {
			queue.tracks.push(track);
		}
		if (queue.aloneTimer) { clearTimeout(queue.aloneTimer); queue.aloneTimer = null; }

		if (!queue.playing) {
			queue.playing = true;
			startPlaying(guildId, client).catch(err => {
				console.error("Error starting playback:", err);
				queue.playing = false;
				queue.tracks = [];
			});
		} else {
			console.log(`[${new Date().toLocaleTimeString()}] Queued: ${track.title} (${queue.tracks.length} in queue)`);
			if (queue.tracks.length === 2) {
				setImmediate(() => {
					const q = queueMap.get(guildId);
					if (q && q.tracks.length >= 2) preloadNextTrack(guildId, q.tracks[1], q);
				});
			}
		}
	});
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

	console.log(`[${new Date().toLocaleTimeString()}] ▶ Now playing: ${track.title}`);

	// Store current track and duration if available
	queue.currentTrack = track;
	queue.duration = track.duration || 0;
	queue.playbackOffset = 0;
	
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
			queue.textChannel?.send("You need to be in a voice channel to play music!");
			return;
		}

		console.log(`[${new Date().toLocaleTimeString()}] Joining VC: ${member.voice.channel.name}`);
		queue.voiceChannel = member.voice.channel;
		
		queue.connection = joinVoiceChannel({
			channelId: queue.voiceChannel.id,
			guildId: guildId,
			adapterCreator: guild.voiceAdapterCreator,
			selfDeaf: false,
			selfMute: false,
		});

		queue.connection.on('stateChange', (oldState, newState) => {
			if (oldState.status !== newState.status)
				console.log(`[${new Date().toLocaleTimeString()}] Voice: ${oldState.status} → ${newState.status}`);
		});
		
		try {
			await entersState(queue.connection, VoiceConnectionStatus.Ready, 45_000);
			console.log(`[${new Date().toLocaleTimeString()}] Voice connected`);
		} catch (err) {
			console.error(`[${new Date().toLocaleTimeString()}] Voice connection failed: ${err.message}`);
			
			for (let attempt = 1; attempt <= 3; attempt++) {
				try {
					console.log(`[${new Date().toLocaleTimeString()}] Reconnect attempt ${attempt}/3...`);
					queue.connection.destroy();
					await new Promise(resolve => setTimeout(resolve, 2000));
					queue.connection = joinVoiceChannel({
						channelId: queue.voiceChannel.id,
						guildId: guildId,
						adapterCreator: guild.voiceAdapterCreator,
						selfDeaf: false,
						selfMute: false,
					});
					await entersState(queue.connection, VoiceConnectionStatus.Ready, 30_000);
					console.log(`[${new Date().toLocaleTimeString()}] Reconnected on attempt ${attempt}`);
					break;
				} catch (retryErr) {
					if (attempt === 3) {
						console.error(`[${new Date().toLocaleTimeString()}] All reconnect attempts failed`);
						queue.textChannel?.send("❌ Voice connection failed. Try again in a few minutes.").catch(() => {});
						safeDestroy(queue);
						queueMap.delete(guildId);
						return;
					}
				}
			}
		}
		
		// Handle disconnection (kicked/moved)
		queue.connection.on(VoiceConnectionStatus.Disconnected, async () => {
			try {
				await Promise.race([
					entersState(queue.connection, VoiceConnectionStatus.Signalling, 5_000),
					entersState(queue.connection, VoiceConnectionStatus.Connecting, 5_000),
				]);
			} catch {
				console.log(`[${new Date().toLocaleTimeString()}] Disconnected from voice channel`);
				
				const q = queueMap.get(guildId);
				if (q) {
					const { createInfoEmbed } = require("../utils/embeds");
					q.textChannel?.send({ embeds: [createInfoEmbed("Disconnected from voice channel.")] }).catch(() => {});
					
					// Clear player message
					if (q.playerMessage) {
						q.playerMessage.delete().catch(() => {});
						q.playerMessage = null;
					}
					
					// Clear progress interval
					if (q.progressInterval) {
						clearInterval(q.progressInterval);
						q.progressInterval = null;
					}
					
					// Remove voice state listener
					if (q.voiceStateHandler) {
						client.off('voiceStateUpdate', q.voiceStateHandler);
						q.voiceStateHandler = null;
					}
					
					q.tracks = [];
					q.playing = false;
					if (q.player) q.player.stop();
					safeDestroy(q);
					queueMap.delete(guildId);
					queueHistory.delete(guildId);
				}
			}
		});

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
			if (queue.isSeeking) return;
			
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

			// Kill direct stream ffmpeg process if any
			if (queue.directStreamProcess) {
				queue.directStreamProcess.kill();
				queue.directStreamProcess = null;
			}

			// Livestream ended (skipped or dropped) — no autoplay/drift, but continue queue normally
			if (queue.currentTrack?.livestream) {
				queue.tracks.shift();
				cleanupPreload(queue);
				if (queue.tracks.length > 0) {
					startPlaying(guildId, client);
				} else {
					queue.playing = false;
					const { createSuccessEmbed } = require("../utils/embeds");
					queue.textChannel?.send({ embeds: [createSuccessEmbed("All songs played.")] }).catch(() => {});
				}
				return;
			}
			
			if (queue.isReplaying) {
				queue.isReplaying = false;
				startPlaying(guildId, client);
				return;
			}
			
			if (queue.isPrevious) {
				queue.isPrevious = false;
				startPlaying(guildId, client);
				return;
			}
			
			if (queue.isLooping && queue.currentTrack) {
				queue.tracks.unshift(queue.currentTrack);
				startPlaying(guildId, client);
				return;
			}
			
			queue.tracks.shift();

			// Mood drift: non-strict, after 4-5 songs mid-playlist
			if (queue.moodActive && !queue.moodStrict) {
				queue.moodSongsPlayed++;
				const driftAfter = 4 + Math.round(Math.random()); // 4 or 5
				if (queue.moodSongsPlayed >= driftAfter) {
					const newMood = getVibeShiftGenre(queue.moodGenre);
					queue.moodGenre = newMood;
					queue.moodSongsPlayed = 0;
					const { createInfoEmbed } = require("../utils/embeds");
					queue.textChannel?.send({ embeds: [createInfoEmbed(`🎵 Mood shift → **${newMood}**`)] }).catch(() => {});
					// Clear remaining mood tracks, enqueue new mood
					queue.tracks = [];
					const playlist = getMoodPlaylist(newMood);
					for (const t of playlist) {
						queue.tracks.push({ title: t.label, url: t.url, requester: queue.currentTrack?.requester, isAutoPlaySong: true });
					}
					startPlaying(guildId, client);
					return;
				}
			}

			// Vibe shift in autoplay: every 4 songs
			if (queue.autoplay && queue.drift && !queue.moodActive) {
				queue.vibeShiftCount = (queue.vibeShiftCount || 0) + 1;
				if (queue.vibeShiftCount >= 4) {
					queue.vibeShiftCount = 0;
					const newGenre = getVibeShiftGenre(queue.moodGenre || "happy");
					queue.moodGenre = newGenre;
					const { createInfoEmbed } = require("../utils/embeds");
					queue.textChannel?.send({ embeds: [createInfoEmbed(`🎵 Vibe shift → **${newGenre}**`)] }).catch(() => {});
					// Inject a few tracks from the new genre then let autoplay continue
					const playlist = getMoodPlaylist(newGenre);
					const inject = playlist.slice(0, 2);
					for (const t of inject.reverse()) {
						queue.tracks.unshift({ title: t.label, url: t.url, requester: queue.currentTrack?.requester, isAutoPlaySong: true });
					}
				}
			}

			if (queue.tracks.length > 0) {
				startPlaying(guildId, client);
			} else if (queue.autoplay && queue.currentTrack) {
				const lastTrack = queue.currentTrack;
				// Don't cleanupPreload here — preloadedAutoplay file needs to survive for startPlaying
				// Only clean up current/next/prev slots, keep autoplay preload intact
				if (queue.preloadCurrentProcess) { queue.preloadCurrentProcess.kill(); queue.preloadCurrentProcess = null; }
				if (queue.preloadedCurrent) { fs.unlink(queue.preloadedCurrent.filePath, () => {}); queue.preloadedCurrent = null; }
				if (queue.preloadNextProcess) { queue.preloadNextProcess.kill(); queue.preloadNextProcess = null; }
				if (queue.preloadedNext) { fs.unlink(queue.preloadedNext.filePath, () => {}); queue.preloadedNext = null; }
				if (queue.preloadPrevProcess) { queue.preloadPrevProcess.kill(); queue.preloadPrevProcess = null; }
				if (queue.preloadedPrev) { fs.unlink(queue.preloadedPrev.filePath, () => {}); queue.preloadedPrev = null; }
				queue.playing = false;

				const enqueueSuggestion = (suggestion) => {
					if (!suggestion) {
						queue.textChannel?.send("🎵 Autoplay: couldn't find a suggestion.").catch(() => {});
						return;
					}
					const { createInfoEmbed } = require("../utils/embeds");
					queue.autoplayHistory.add(suggestion.url);
					if (queue.autoplayHistory.size > 50) {
						const first = queue.autoplayHistory.values().next().value;
						queue.autoplayHistory.delete(first);
					}
					enqueueTrack(guildId, { ...suggestion, requester: lastTrack.requester, isAutoPlaySong: true }, client, queue.textChannel);
				};

				if (queue.autoplaySuggestion) {
					// Already fetched while song was playing — instant
					enqueueSuggestion(queue.autoplaySuggestion);
					queue.autoplaySuggestion = null;
				} else {
					// Still fetching — wait up to 5s
					console.log(`[${new Date().toLocaleTimeString()}] Autoplay: waiting for suggestion...`);
					let waited = 0;
					const poll = setInterval(() => {
						waited += 500;
						if (queue.autoplaySuggestion) {
							clearInterval(poll);
							const s = queue.autoplaySuggestion;
							queue.autoplaySuggestion = null;
							enqueueSuggestion(s);
						} else if (waited >= 5000) {
							clearInterval(poll);
							enqueueSuggestion(null);
						}
					}, 500);
				}
			} else {
				console.log(`[${new Date().toLocaleTimeString()}] Queue finished`);
				cleanupPreload(queue);
				queue.playing = false;
				
				// Clear player message when queue is empty
				if (queue.playerMessage) {
					queue.playerMessage.delete().catch(() => {});
					queue.playerMessage = null;
				}
				
				const { createSuccessEmbed } = require("../utils/embeds");
				queue.textChannel?.send({ embeds: [createSuccessEmbed("All songs played.")] }).catch(() => {});
			}
		});
		
		queue.player.on(AudioPlayerStatus.Playing, () => {
			if (queue.isPaused) queue.playbackStartTime = Date.now();
			queue.isPaused = false;
			if (queue.currentTrack && queue.playerMessage) {
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
			}
		});
		
		queue.player.on(AudioPlayerStatus.Paused, () => {
			if (queue.playbackStartTime) {
				queue.playbackOffset += (Date.now() - queue.playbackStartTime) / 1000;
				queue.playbackStartTime = null;
			}
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
	const preloaded = isTrackPreloaded(queue, track.url);
	console.log(`[Preload] Check for "${track.title}" → ${preloaded ? preloaded.direction : 'MISS'} | preloadedAutoplay=${queue.preloadedAutoplay?.url?.slice(-11)}`);
	if (preloaded) {
		console.log(`[${new Date().toLocaleTimeString()}] Using preloaded: ${track.title}`);
		stream = fs.createReadStream(preloaded.data.filePath);
		queue.currentStream = stream;

		if (preloaded.data.duration) queue.duration = preloaded.data.duration;

		const resource = createAudioResource(stream, { inlineVolume: true });
		resource.volume.setVolume((queue.volume || 100) / 100);
		queue.player.play(resource);
		queue.playbackStartTime = Date.now();
		queue.playbackOffset = 0;
		
		// Update player UI
		updatePlayerUI(queue, track, queue.textChannel).catch(console.error);
		
		// Clean up used preloaded slot reference
		if (preloaded.direction === 'next') {
			queue.preloadedNext = null;
		} else if (preloaded.direction === 'prev') {
			queue.preloadedPrev = null;
		} else if (preloaded.direction === 'autoplay') {
			// Don't null preloadedAutoplay yet — file is still streaming.
			// preloadAutoplaySuggestion will overwrite the slot when next suggestion is ready.
		} else if (preloaded.direction === 'eager') {
			const { eagerPreloads } = require('../utils/preload');
			eagerPreloads.delete(guildId);
		} else {
			queue.preloadedCurrent = null;
		}

		// Delete file after a short delay — but NOT for autoplay/eager slots
		// (those files get overwritten by the next preload naturally)
		if (preloaded.direction !== 'autoplay' && preloaded.direction !== 'eager') {
			const fileToDelete = preloaded.data.filePath;
			setTimeout(() => {
				try {
					if (fs.existsSync(fileToDelete)) fs.unlinkSync(fileToDelete);
				} catch (e) {
					console.error("Error cleaning preload file:", e.message);
				}
			}, 2000);
		}
		
		if (queue.tracks.length > 1) preloadNextTrack(guildId, queue.tracks[1], queue);
		const history = queueHistory.get(guildId);
		if (history && history.length >= 2) preloadPreviousTrack(guildId, history[history.length - 2], queue);

		// Kick off autoplay suggestion fetch in background
		if (queue.autoplay && !queue.tracks.slice(1).some(t => !t.isAutoPlaySong)) {
			queue.autoplaySuggestion = null;
			const excludeUrls = new Set([
				...Array.from(queue.autoplayHistory),
				...(queueHistory.get(guildId) || []).map(t => t.url),
			]);
			console.log(`[Autoplay] Starting background fetch for: "${track.title}"`);
			fetchAutoplaySuggestion(track, excludeUrls).then(suggestion => {
				console.log(`[Autoplay] Fetch complete → ${suggestion ? `"${suggestion.title}"` : 'null'}`);
				if (suggestion) {
					queue.autoplaySuggestion = suggestion;
					preloadAutoplaySuggestion(guildId, suggestion, queue);
					console.log(`[Autoplay] Preloading suggestion: "${suggestion.title}"`);
					if (queue.currentTrack) updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(() => {});
				}
			}).catch(e => console.log(`[Autoplay] Fetch threw: ${e.message}`));
		}
		
		return;
	}
	
	// Stream directly if not preloaded
	const isLivestream = !!track.livestream;
	const isDirectStream = !!track.directStream;
	try {
		if (isDirectStream) {
			const https = require('https');
			const http = require('http');

			function fetchStream(url, redirects = 0) {
				if (redirects > 5) {
					queue.textChannel?.send('⚠ Stream redirect loop.').catch(() => {});
					queue.playing = false;
					return;
				}
				const lib = url.startsWith('https') ? https : http;
				lib.get(url, (res) => {
					if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
						res.resume();
						return fetchStream(res.headers.location, redirects + 1);
					}
					const ffmpeg = spawn('ffmpeg', ['-i', 'pipe:0', '-f', 's16le', '-ar', '48000', '-ac', '2', 'pipe:1']);
					res.pipe(ffmpeg.stdin);
					stream = ffmpeg.stdout;
					queue.currentStream = stream;
					queue.directStreamProcess = ffmpeg;
					queue.playbackOffset = 0;

					const { StreamType } = require('@discordjs/voice');
					const resource = createAudioResource(stream, { inputType: StreamType.Raw, inlineVolume: true });
					resource.volume.setVolume((queue.volume || 100) / 100);
					queue.player.play(resource);
					queue.playbackStartTime = Date.now();
					updatePlayerUI(queue, track, queue.textChannel).catch(console.error);

					ffmpeg.on('error', err => console.error(`[DirectStream] ffmpeg: ${err.message}`));
					res.on('error', err => { console.error(`[DirectStream] res: ${err.message}`); queue.playing = false; });
				}).on('error', (err) => {
					console.error(`[DirectStream] connect: ${err.message}`);
					queue.textChannel?.send(`⚠ Couldn't connect to stream: ${err.message}`).catch(() => {});
					queue.tracks.shift();
					queue.playing = false;
				});
			}

			fetchStream(track.url);
			return;
		}

		ytdlpProcess = spawn('yt-dlp', [
			'-f', 'bestaudio',
			'-o', '-',
			'--quiet',
			...(isLivestream ? [] : ['--no-playlist']),
			track.url
		]);
		stream = ytdlpProcess.stdout;
		queue.currentStream = stream;
		queue.playbackOffset = 0;

		ytdlpProcess.stderr.on('data', d => console.error(`[yt-dlp stderr] ${d.toString().trim()}`));
		ytdlpProcess.on('close', code => console.log(`[yt-dlp] exited with code ${code} for: ${track.title}`));

		if (!isLivestream) {
			preloadCurrentTrack(guildId, track, queue);
		}
		
		let streamStarted = false;
		stream.once('readable', () => {
			if (streamStarted || queue.intentionalStop) return;
			streamStarted = true;
			const resource = createAudioResource(stream, { inlineVolume: true });
			resource.volume.setVolume((queue.volume || 100) / 100);
			queue.player.play(resource);
			queue.playbackStartTime = Date.now();

			if (isLivestream) {
				// Show player UI with snake bar — updatePlayerUI + interval handles the animation
				updatePlayerUI(queue, track, queue.textChannel).catch(console.error);
				return;
			}

			updatePlayerUI(queue, track, queue.textChannel).catch(console.error);
			if (queue.tracks.length > 1) preloadNextTrack(guildId, queue.tracks[1], queue);
			const history = queueHistory.get(guildId);
			if (history && history.length >= 2) preloadPreviousTrack(guildId, history[history.length - 2], queue);

			// Kick off autoplay suggestion fetch in background
			if (queue.autoplay && !queue.tracks.slice(1).some(t => !t.isAutoPlaySong)) {
				queue.autoplaySuggestion = null;
				const excludeUrls = new Set([
					...Array.from(queue.autoplayHistory),
					...(queueHistory.get(guildId) || []).map(t => t.url),
				]);
				console.log(`[Autoplay] Starting background fetch for: "${track.title}"`);
				fetchAutoplaySuggestion(track, excludeUrls).then(suggestion => {
					console.log(`[Autoplay] Fetch complete → ${suggestion ? `"${suggestion.title}"` : 'null'}`);
					if (suggestion) {
						queue.autoplaySuggestion = suggestion;
						preloadAutoplaySuggestion(guildId, suggestion, queue);
						console.log(`[Autoplay] Preloading suggestion: "${suggestion.title}"`);
						if (queue.currentTrack) updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(() => {});
					}
				}).catch(e => console.log(`[Autoplay] Fetch threw: ${e.message}`));
			}
		});
		
		stream.once("error", (error) => {
			if (queue.cleanupInProgress || queue.intentionalStop || queue.currentStream !== stream) return;
			if (error.message.includes("Premature close") && streamStarted) return;
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
		
		// Remove voice state listener
		if (queue.voiceStateHandler) {
			client.off('voiceStateUpdate', queue.voiceStateHandler);
			queue.voiceStateHandler = null;
		}
		
		safeDestroy(queue);
		queueMap.delete(guildId);
		queueHistory.delete(guildId);
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
		queue.connection = null;
	}
}

/**
 * Monitor if bot is alone in voice channel or inactive
 */
function startAloneMonitoring(guildId, client) {
	const queue = queueMap.get(guildId);
	if (!queue || !queue.voiceChannel) return;
	
	// Remove existing handler if any to prevent duplicates
	if (queue.voiceStateHandler) {
		client.off('voiceStateUpdate', queue.voiceStateHandler);
	}

	const checkAlone = () => {
		const queue = queueMap.get(guildId);
		if (!queue || !queue.voiceChannel) return;

		const members = queue.voiceChannel.members.filter(m => !m.user.bot);
		const isInactive = !queue.playing || queue.tracks.length === 0;
		
		if (members.size === 0 || isInactive) {
			// Bot is alone or inactive, start timer
			if (!queue.aloneTimer) {
				queue.aloneTimer = setTimeout(() => {
					const q = queueMap.get(guildId);
					if (q) {
						const { createInfoEmbed } = require("../utils/embeds");
						q.textChannel?.send({ embeds: [createInfoEmbed("Left voice channel due to inactivity.")] }).catch(() => {});
						
						// Clear player message
						if (q.playerMessage) {
							q.playerMessage.delete().catch(() => {});
							q.playerMessage = null;
						}
						
						// Clear progress interval
						if (q.progressInterval) {
							clearInterval(q.progressInterval);
							q.progressInterval = null;
						}
						
						// Remove voice state listener
						if (q.voiceStateHandler) {
							client.off('voiceStateUpdate', q.voiceStateHandler);
							q.voiceStateHandler = null;
						}
						
						q.tracks = [];
						q.playing = false;
						if (q.player) q.player.stop();
						safeDestroy(q);
						queueMap.delete(guildId);
						queueHistory.delete(guildId);
					}
				}, 60000); // 1 minute
			}
		} else {
			// Users present and playing, clear timer
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
	
	// Store handler reference and attach listener
	queue.voiceStateHandler = voiceStateHandler;
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
	
	console.log(`[${new Date().toLocaleTimeString()}] Seek: ${currentPosition.toFixed(1)}s → ${newPosition.toFixed(1)}s`);
	
	// Set seeking flag BEFORE stopping current playback
	queue.isSeeking = true;
	
	// Create new stream at new position
	const stream = createSeekableStream(queue.audioUrl, newPosition);
	queue.currentStream = stream;
	queue.playbackOffset = newPosition;
	queue.playbackStartTime = Date.now();
	
	// Create and play resource immediately
	const resource = createAudioResource(stream, { inlineVolume: true });
	resource.volume.setVolume((queue.volume || 100) / 100);
	queue.player.play(resource);
	
	// Reset flag after player stabilizes
	setTimeout(() => {
		queue.isSeeking = false;
	}, 1500);
	
	return true;
}

/**
 * Replay current song
 */
function replayCurrentSong(guildId) {
	const queue = queueMap.get(guildId);
	if (!queue || !queue.currentTrack) return false;

	// Ensure current track is at tracks[0]
	if (queue.tracks[0]?.url !== queue.currentTrack.url) {
		queue.tracks[0] = queue.currentTrack;
	}

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
			voiceStateHandler: null,
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
	
	// Clear player message
	if (queue.playerMessage) {
		queue.playerMessage.delete().catch(() => {});
		queue.playerMessage = null;
	}
	
	// Clear progress interval
	if (queue.progressInterval) {
		clearInterval(queue.progressInterval);
		queue.progressInterval = null;
	}
	
	queue.tracks = [];
	queue.playing = false;
	queue.intentionalStop = true;
	queue.cleanupInProgress = true;
	queue.autoplay = false;
	queue.autoplaySuggestion = null;
	if (queue.directStreamProcess) { queue.directStreamProcess.kill(); queue.directStreamProcess = null; }
	queue.moodActive = false;
	queue.moodGenre = null;
	queue.moodSongsPlayed = 0;
	queue.vibeShiftCount = 0;
	
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

function triggerAutoplayFetch(guildId) {
	const queue = queueMap.get(guildId);
	if (!queue?.currentTrack || queue.autoplaySuggestion) return;
	const excludeUrls = new Set([
		...Array.from(queue.autoplayHistory),
		...(queueHistory.get(guildId) || []).map(t => t.url),
	]);
	console.log(`[Autoplay] Starting background fetch for: "${queue.currentTrack.title}"`);
	fetchAutoplaySuggestion(queue.currentTrack, excludeUrls).then(suggestion => {
		console.log(`[Autoplay] Fetch complete → ${suggestion ? `"${suggestion.title}"` : 'null'}`);
		if (suggestion) {
			queue.autoplaySuggestion = suggestion;
			preloadAutoplaySuggestion(guildId, suggestion, queue);
			console.log(`[Autoplay] Preloading suggestion: "${suggestion.title}"`);
			if (queue.currentTrack) updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(() => {});
		}
	}).catch(e => console.log(`[Autoplay] Fetch threw: ${e.message}`));
}

module.exports = {
	enqueueTrack,
	queueMap,
	queueHistory,
	stopPlayback,
	replayCurrentSong,
	replayLastQueue,
	shuffleQueue,
	triggerAutoplayFetch,
};
