const { spawn } = require("child_process");

/**
 * Get direct audio URL from yt-dlp
 */
async function getDirectAudioUrl(videoUrl) {
	return new Promise((resolve) => {
		const proc = spawn('yt-dlp', [
			'--print', '%(url)s|||%(duration)s',
			'-f', 'bestaudio',
			'--no-playlist', '--quiet', videoUrl
		]);
		let out = '';
		proc.stdout.on('data', d => (out += d));
		proc.on('close', () => {
			const [url, dur] = out.trim().split('|||');
			if (!url) return resolve(null);
			resolve({ url: url.trim(), duration: parseFloat(dur) || 0 });
		});
		proc.on('error', () => resolve(null));
	});
}

/**
 * Create audio stream with ffmpeg starting at specific timestamp
 */
function createSeekableStream(audioUrl, startSeconds = 0) {
	const ffmpeg = spawn('ffmpeg', [
		'-reconnect', '1',
		'-reconnect_streamed', '1',
		'-reconnect_delay_max', '5',
		'-ss', startSeconds.toString(),
		'-i', audioUrl,
		'-f', 's16le',
		'-ar', '48000',
		'-ac', '2',
		'pipe:1'
	]);
	
	return ffmpeg.stdout;
}

module.exports = {
	getDirectAudioUrl,
	createSeekableStream,
};
