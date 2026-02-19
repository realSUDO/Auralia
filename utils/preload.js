const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");

const CACHE_DIR = path.join(__dirname, "../.cache");

// Ensure cache directory exists
if (!fs.existsSync(CACHE_DIR)) {
	fs.mkdirSync(CACHE_DIR, { recursive: true });
}

/**
 * Preload next track in queue
 */
function preloadNextTrack(guildId, nextTrack, queue) {
	if (!nextTrack) return;

	// Cancel existing preload if any
	if (queue.preloadProcess) {
		queue.preloadProcess.kill();
		queue.preloadProcess = null;
	}

	// Clean up old preloaded file (async to not block)
	if (queue.preloadedTrack && queue.preloadedTrack.url !== nextTrack.url) {
		const oldFile = queue.preloadedTrack.filePath;
		queue.preloadedTrack = null;
		fs.unlink(oldFile, (err) => {
			if (err && err.code !== 'ENOENT') {
				console.error("Error cleaning preload:", err.message);
			}
		});
	}

	// Skip if already preloaded
	if (queue.preloadedTrack && queue.preloadedTrack.url === nextTrack.url) {
		return;
	}

	const filePath = path.join(CACHE_DIR, `${guildId}_next.webm`);
	console.log(`[${new Date().toLocaleTimeString()}] Preloading: ${nextTrack.title}`);

	const ytdlp = spawn('yt-dlp', [
		'-f', 'bestaudio',
		'-o', filePath,
		'--no-playlist',
		'--quiet',
		nextTrack.url
	]);

	queue.preloadProcess = ytdlp;

	ytdlp.on('close', (code) => {
		if (code === 0 && fs.existsSync(filePath)) {
			queue.preloadedTrack = {
				url: nextTrack.url,
				filePath: filePath,
			};
			console.log(`[${new Date().toLocaleTimeString()}] Preloaded: ${nextTrack.title}`);
		}
		queue.preloadProcess = null;
	});

	ytdlp.on('error', (error) => {
		console.error("Preload error:", error.message);
		queue.preloadProcess = null;
	});
}

/**
 * Clean up preload resources
 */
function cleanupPreload(queue) {
	if (queue.preloadProcess) {
		queue.preloadProcess.kill();
		queue.preloadProcess = null;
	}
	if (queue.preloadedTrack) {
		const fileToDelete = queue.preloadedTrack.filePath;
		queue.preloadedTrack = null;
		// Async delete to not block
		fs.unlink(fileToDelete, (err) => {
			if (err && err.code !== 'ENOENT') {
				console.error("Error cleaning preload:", err.message);
			}
		});
	}
}

/**
 * Check if track is preloaded and ready
 */
function isTrackPreloaded(queue, trackUrl) {
	if (!queue.preloadedTrack || queue.preloadedTrack.url !== trackUrl) {
		return false;
	}
	// Quick sync check is OK here since it's only called when starting playback
	try {
		return fs.existsSync(queue.preloadedTrack.filePath);
	} catch {
		return false;
	}
}

module.exports = {
	preloadNextTrack,
	cleanupPreload,
	isTrackPreloaded,
};
