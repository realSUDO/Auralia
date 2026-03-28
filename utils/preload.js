const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { ytdlpArgs } = require("./ytdlp");

const CACHE_DIR = path.join(__dirname, "../.cache");

// guildId → { process, filePath, url }
const eagerPreloads = new Map();

// Ensure cache directory exists and wipe stale files from previous run
if (!fs.existsSync(CACHE_DIR)) {
	fs.mkdirSync(CACHE_DIR, { recursive: true });
} else {
	// Clean up any leftover preload files from a previous crash/restart
	try {
		for (const file of fs.readdirSync(CACHE_DIR)) {
			fs.unlinkSync(path.join(CACHE_DIR, file));
		}
	} catch (e) {
		console.error("Cache cleanup on startup failed:", e.message);
	}
}

/**
 * Preload current track (for instant replay/seek)
 */
function preloadCurrentTrack(guildId, currentTrack, queue) {
	if (!currentTrack) return;

	// Cancel existing current preload if any
	if (queue.preloadCurrentProcess) {
		queue.preloadCurrentProcess.kill();
		queue.preloadCurrentProcess = null;
	}

	// Clean up old preloaded current file (async to not block)
	if (queue.preloadedCurrent && queue.preloadedCurrent.url !== currentTrack.url) {
		const oldFile = queue.preloadedCurrent.filePath;
		queue.preloadedCurrent = null;
		fs.unlink(oldFile, (err) => {
			if (err && err.code !== 'ENOENT') {
				console.error("Error cleaning current preload:", err.message);
			}
		});
	}

	// Skip if already preloaded
	if (queue.preloadedCurrent && queue.preloadedCurrent.url === currentTrack.url) {
		return;
	}

	const filePath = path.join(CACHE_DIR, `${guildId}_current.webm`);
	const tmpPath = filePath + '.tmp';

	const ytdlp = spawn('yt-dlp', ytdlpArgs([
		'-f', 'bestaudio',
		'-o', tmpPath,
		'--no-playlist',
		'--quiet',
		currentTrack.url
	]));

	queue.preloadCurrentProcess = ytdlp;

	ytdlp.on('close', (code) => {
		if (code === 0 && fs.existsSync(tmpPath)) {
			try { fs.renameSync(tmpPath, filePath); } catch (e) { queue.preloadCurrentProcess = null; return; }
			queue.preloadedCurrent = { url: currentTrack.url, filePath };
			fetchDuration(currentTrack.url).then(duration => {
				if (queue.preloadedCurrent?.url === currentTrack.url) queue.preloadedCurrent.duration = duration;
				// Also patch queue.duration live if this is still the playing track
				const { queueMap } = require('../player/musicPlayer');
				const guildQueue = queueMap.get(guildId);
				if (guildQueue && guildQueue.currentTrack?.url === currentTrack.url && !guildQueue.duration) {
					guildQueue.duration = duration;
				}
			});
		} else {
			fs.unlink(tmpPath, () => {});
		}
		queue.preloadCurrentProcess = null;
	});

	ytdlp.on('error', (error) => {
		console.error("Current preload error:", error.message);
		fs.unlink(tmpPath, () => {});
		queue.preloadCurrentProcess = null;
	});
}

/**
 * Preload next track in queue
 */
function preloadNextTrack(guildId, nextTrack, queue) {
	if (!nextTrack) return;

	// Cancel existing next preload if any
	if (queue.preloadNextProcess) {
		queue.preloadNextProcess.kill();
		queue.preloadNextProcess = null;
	}

	// Clean up old preloaded next file (async to not block)
	if (queue.preloadedNext && queue.preloadedNext.url !== nextTrack.url) {
		const oldFile = queue.preloadedNext.filePath;
		queue.preloadedNext = null;
		fs.unlink(oldFile, (err) => {
			if (err && err.code !== 'ENOENT') {
				console.error("Error cleaning next preload:", err.message);
			}
		});
	}

	// Skip if already preloaded
	if (queue.preloadedNext && queue.preloadedNext.url === nextTrack.url) {
		return;
	}

	const filePath = path.join(CACHE_DIR, `${guildId}_next.webm`);
	const tmpPath = filePath + '.tmp';

	const ytdlp = spawn('yt-dlp', ytdlpArgs([
		'-f', 'bestaudio',
		'-o', tmpPath,
		'--no-playlist',
		'--quiet',
		nextTrack.url
	]));

	queue.preloadNextProcess = ytdlp;

	ytdlp.on('close', (code) => {
		if (code === 0 && fs.existsSync(tmpPath)) {
			try { fs.renameSync(tmpPath, filePath); } catch (e) { queue.preloadNextProcess = null; return; }
			queue.preloadedNext = { url: nextTrack.url, filePath };
			fetchDuration(nextTrack.url).then(duration => {
				if (queue.preloadedNext?.url === nextTrack.url) queue.preloadedNext.duration = duration;
			});
		} else {
			fs.unlink(tmpPath, () => {});
		}
		queue.preloadNextProcess = null;
	});

	ytdlp.on('error', (error) => {
		console.error("Next preload error:", error.message);
		fs.unlink(tmpPath, () => {});
		queue.preloadNextProcess = null;
	});
}

/**
 * Preload previous track (from history)
 */
function preloadPreviousTrack(guildId, previousTrack, queue) {
	if (!previousTrack) return;

	// Cancel existing previous preload if any
	if (queue.preloadPrevProcess) {
		queue.preloadPrevProcess.kill();
		queue.preloadPrevProcess = null;
	}

	// Clean up old preloaded previous file (async to not block)
	if (queue.preloadedPrev && queue.preloadedPrev.url !== previousTrack.url) {
		const oldFile = queue.preloadedPrev.filePath;
		queue.preloadedPrev = null;
		fs.unlink(oldFile, (err) => {
			if (err && err.code !== 'ENOENT') {
				console.error("Error cleaning prev preload:", err.message);
			}
		});
	}

	// Skip if already preloaded
	if (queue.preloadedPrev && queue.preloadedPrev.url === previousTrack.url) {
		return;
	}

	const filePath = path.join(CACHE_DIR, `${guildId}_prev.webm`);
	const tmpPath = filePath + '.tmp';

	const ytdlp = spawn('yt-dlp', ytdlpArgs([
		'-f', 'bestaudio',
		'-o', tmpPath,
		'--no-playlist',
		'--quiet',
		previousTrack.url
	]));

	queue.preloadPrevProcess = ytdlp;

	ytdlp.on('close', (code) => {
		if (code === 0 && fs.existsSync(tmpPath)) {
			try { fs.renameSync(tmpPath, filePath); } catch (e) { queue.preloadPrevProcess = null; return; }
			queue.preloadedPrev = { url: previousTrack.url, filePath };
			fetchDuration(previousTrack.url).then(duration => {
				if (queue.preloadedPrev?.url === previousTrack.url) queue.preloadedPrev.duration = duration;
			});
		} else {
			fs.unlink(tmpPath, () => {});
		}
		queue.preloadPrevProcess = null;
	});

	ytdlp.on('error', (error) => {
		console.error("Previous preload error:", error.message);
		fs.unlink(tmpPath, () => {});
		queue.preloadPrevProcess = null;
	});
}

function fetchDuration(url) {
	return new Promise((resolve) => {
		const proc = spawn('yt-dlp', ytdlpArgs(['--print', 'duration', '--no-playlist', '--quiet', url]));
		let out = '';
		proc.stdout.on('data', d => (out += d));
		proc.on('close', () => resolve(parseFloat(out.trim()) || 0));
		proc.on('error', () => resolve(0));
	});
}

/**
 * Preload autoplay suggestion (dedicated slot, won't conflict with current/next/prev)
 */
function preloadAutoplaySuggestion(guildId, track, queue) {
	if (!track) return;

	if (queue.preloadAutoplayProcess) {
		queue.preloadAutoplayProcess.kill();
		queue.preloadAutoplayProcess = null;
	}
	if (queue.preloadedAutoplay && queue.preloadedAutoplay.url === track.url) return;
	// Don't delete old file — it may still be streaming. It will be cleaned up by cleanupPreload or overwritten naturally.
	queue.preloadedAutoplay = null;

	const urlHash = Buffer.from(track.url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').slice(0, 20);
	const filePath = path.join(CACHE_DIR, `${guildId}_autoplay_${urlHash}.webm`);
	const tmpPath = filePath + '.tmp';

	const ytdlp = spawn('yt-dlp', ytdlpArgs(['-f', 'bestaudio', '-o', tmpPath, '--no-playlist', '--quiet', track.url]));
	queue.preloadAutoplayProcess = ytdlp;

	ytdlp.on('close', (code) => {
		if (code === 0 && fs.existsSync(tmpPath)) {
			try { fs.renameSync(tmpPath, filePath); } catch { queue.preloadAutoplayProcess = null; return; }
			// Only keep the file if the queue still exists (bot may have left mid-download)
			const { queueMap } = require('../player/musicPlayer');
			const guildQueue = queueMap.get(guildId);
			if (guildQueue && guildQueue === queue) {
				queue.preloadedAutoplay = { url: track.url, filePath };
				console.log(`[Autoplay] Preload ready: "${track.title}"`);
				fetchDuration(track.url).then(duration => {
					if (queue.preloadedAutoplay?.url === track.url) queue.preloadedAutoplay.duration = duration;
				});
			} else {
				fs.unlink(filePath, () => {});
			}
		} else {
			fs.unlink(tmpPath, () => {});
		}
		queue.preloadAutoplayProcess = null;
	});
	ytdlp.on('error', () => { fs.unlink(tmpPath, () => {}); queue.preloadAutoplayProcess = null; });
}

/**
 * Clean up preload resources
 */
function cleanupPreload(queue) {
	// Clean up current preload
	if (queue.preloadCurrentProcess) {
		queue.preloadCurrentProcess.kill();
		queue.preloadCurrentProcess = null;
	}
	if (queue.preloadedCurrent) {
		const fileToDelete = queue.preloadedCurrent.filePath;
		queue.preloadedCurrent = null;
		fs.unlink(fileToDelete, (err) => {
			if (err && err.code !== 'ENOENT') {
				console.error("Error cleaning current preload:", err.message);
			}
		});
	}
	
	// Clean up next preload
	if (queue.preloadNextProcess) {
		queue.preloadNextProcess.kill();
		queue.preloadNextProcess = null;
	}
	if (queue.preloadedNext) {
		const fileToDelete = queue.preloadedNext.filePath;
		queue.preloadedNext = null;
		fs.unlink(fileToDelete, (err) => {
			if (err && err.code !== 'ENOENT') {
				console.error("Error cleaning next preload:", err.message);
			}
		});
	}
	
	// Clean up previous preload
	if (queue.preloadPrevProcess) {
		queue.preloadPrevProcess.kill();
		queue.preloadPrevProcess = null;
	}
	if (queue.preloadedPrev) {
		const fileToDelete = queue.preloadedPrev.filePath;
		queue.preloadedPrev = null;
		fs.unlink(fileToDelete, (err) => {
			if (err && err.code !== 'ENOENT') {
				console.error("Error cleaning prev preload:", err.message);
			}
		});
	}

	// Clean up autoplay preload
	if (queue.preloadAutoplayProcess) {
		queue.preloadAutoplayProcess.kill();
		queue.preloadAutoplayProcess = null;
	}
	if (queue.preloadedAutoplay) {
		const fileToDelete = queue.preloadedAutoplay.filePath;
		queue.preloadedAutoplay = null;
		fs.unlink(fileToDelete, (err) => {
			if (err && err.code !== 'ENOENT') console.error("Error cleaning autoplay preload:", err.message);
		});
	}

	// Clean up eager preload
	const guildId = queue.connection?.joinConfig?.guildId;
	if (guildId) {
		const entry = eagerPreloads.get(guildId);
		if (entry) { entry.process?.kill(); fs.unlink(entry.filePath, () => {}); eagerPreloads.delete(guildId); }
	}
}

/**
 * Check if track is preloaded and ready (checks current, next and prev)
 */
function isTrackPreloaded(queue, trackUrl) {
	// Check current preload
	if (queue.preloadedCurrent && queue.preloadedCurrent.url === trackUrl) {
		try {
			if (fs.existsSync(queue.preloadedCurrent.filePath)) {
				return { direction: 'current', data: queue.preloadedCurrent };
			}
		} catch {}
	}
	
	// Check next preload
	if (queue.preloadedNext && queue.preloadedNext.url === trackUrl) {
		try {
			if (fs.existsSync(queue.preloadedNext.filePath)) {
				return { direction: 'next', data: queue.preloadedNext };
			}
		} catch {}
	}
	
	// Check previous preload
	if (queue.preloadedPrev && queue.preloadedPrev.url === trackUrl) {
		try {
			if (fs.existsSync(queue.preloadedPrev.filePath)) {
				return { direction: 'prev', data: queue.preloadedPrev };
			}
		} catch {}
	}
	
	// Check autoplay preload
	if (queue.preloadedAutoplay && queue.preloadedAutoplay.url === trackUrl) {
		try {
			if (fs.existsSync(queue.preloadedAutoplay.filePath)) {
				return { direction: 'autoplay', data: queue.preloadedAutoplay };
			}
		} catch {}
	}

	// Check eager preload (mood/autoplay first-track)
	const eager = eagerPreloads.get(queue.connection?.joinConfig?.guildId);
	if (eager && eager.url === trackUrl && !eager.process) {
		try {
			if (fs.existsSync(eager.filePath)) {
				return { direction: 'eager', data: eager };
			}
		} catch {}
	}
	
	return false;
}

/**
 * Eagerly preload a track before the queue exists (used by !mood, autoplay toggle).
 * isTrackPreloaded checks this slot too.
 */
function eagerPreloadTrack(guildId, track) {
	if (!track?.url) return;
	const existing = eagerPreloads.get(guildId);
	if (existing) { existing.process?.kill(); fs.unlink(existing.filePath, () => {}); }

	const filePath = path.join(CACHE_DIR, `${guildId}_eager.webm`);
	const tmpPath = filePath + '.tmp';
	const ytdlp = spawn('yt-dlp', ytdlpArgs(['-f', 'bestaudio', '-o', tmpPath, '--no-playlist', '--quiet', track.url]));
	eagerPreloads.set(guildId, { process: ytdlp, filePath, url: track.url });

	ytdlp.on('close', (code) => {
		const entry = eagerPreloads.get(guildId);
		if (!entry || entry.url !== track.url) { fs.unlink(tmpPath, () => {}); return; }
		if (code === 0 && fs.existsSync(tmpPath)) {
			try { fs.renameSync(tmpPath, filePath); entry.process = null; console.log(`[EagerPreload] Ready: "${track.title}"`); }
			catch { eagerPreloads.delete(guildId); }
		} else { fs.unlink(tmpPath, () => {}); eagerPreloads.delete(guildId); }
	});
	ytdlp.on('error', () => { fs.unlink(tmpPath, () => {}); eagerPreloads.delete(guildId); });
}

module.exports = {
	preloadCurrentTrack,
	preloadNextTrack,
	preloadPreviousTrack,
	preloadAutoplaySuggestion,
	cleanupPreload,
	isTrackPreloaded,
	eagerPreloadTrack,
};
