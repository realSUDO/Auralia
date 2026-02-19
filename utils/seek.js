const { spawn } = require("child_process");
const youtubedl = require("youtube-dl-exec");

/**
 * Get direct audio URL from yt-dlp
 */
async function getDirectAudioUrl(videoUrl) {
	try {
		const info = await youtubedl(videoUrl, {
			dumpSingleJson: true,
			noCheckCertificates: true,
			noWarnings: true,
			preferFreeFormats: true,
			addHeader: ['referer:youtube.com', 'user-agent:googlebot']
		});
		
		// Get best audio format
		const audioFormat = info.formats.find(f => f.acodec !== 'none' && f.vcodec === 'none') || info.formats[0];
		return {
			url: audioFormat.url,
			duration: info.duration || 0,
			title: info.title
		};
	} catch (error) {
		console.error("Error getting direct audio URL:", error.message);
		return null;
	}
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
