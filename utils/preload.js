const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const CACHE_DIR = path.join(__dirname, "../.cache");

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

	const ytdlp = spawn('yt-dlp', [
		'-f', 'bestaudio',
		'-o', tmpPath,
		'--no-playlist',
		'--quiet',
		currentTrack.url
	]);

	queue.preloadCurrentProcess = ytdlp;

	ytdlp.on('close', (code) => {
		if (code === 0 && fs.existsSync(tmpPath)) {
			try { fs.renameSync(tmpPath, filePath); } catch (e) { queue.preloadCurrentProcess = null; return; }
			queue.preloadedCurrent = { url: currentTrack.url, filePath };
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

	const ytdlp = spawn('yt-dlp', [
		'-f', 'bestaudio',
		'-o', tmpPath,
		'--no-playlist',
		'--quiet',
		nextTrack.url
	]);

	queue.preloadNextProcess = ytdlp;

	ytdlp.on('close', (code) => {
		if (code === 0 && fs.existsSync(tmpPath)) {
			try { fs.renameSync(tmpPath, filePath); } catch (e) { queue.preloadNextProcess = null; return; }
			queue.preloadedNext = { url: nextTrack.url, filePath };
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

	const ytdlp = spawn('yt-dlp', [
		'-f', 'bestaudio',
		'-o', tmpPath,
		'--no-playlist',
		'--quiet',
		previousTrack.url
	]);

	queue.preloadPrevProcess = ytdlp;

	ytdlp.on('close', (code) => {
		if (code === 0 && fs.existsSync(tmpPath)) {
			try { fs.renameSync(tmpPath, filePath); } catch (e) { queue.preloadPrevProcess = null; return; }
			queue.preloadedPrev = { url: previousTrack.url, filePath };
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
	
	return false;
}

module.exports = {
	preloadCurrentTrack,
	preloadNextTrack,
	preloadPreviousTrack,
	cleanupPreload,
	isTrackPreloaded,
};
