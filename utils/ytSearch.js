const yts = require('yt-search');

async function searchYouTube(query) {
    const result = await yts(query);
    if (result && result.videos.length > 0) {
        const video = result.videos[0];
        return {
            title: video.title,
            url: video.url,
            duration: video.timestamp
        };
    } else {
        throw new Error('No results found on YouTube.');
    }
}

module.exports = { searchYouTube };

