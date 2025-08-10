const ytdl = require('ytdl-core');
const { enqueueTrack } = require('../player/musicPlayer');
const { searchYouTube } = require('../utils/ytSearch');

function isYouTubeUrl(url) {
    return /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be)\/.+$/.test(url);
}

module.exports = {
    name: 'play',
    description: 'Plays a song from YouTube by URL or search term.',
    async execute(message, args, client) {
        const voiceChannel = message.member.voice.channel;
        if (!voiceChannel) {
            return message.reply('You need to be in a voice channel to play music!');
        }

        if (args.length === 0) {
            return message.reply('Please provide a YouTube link or search term.');
        }

        let track;

        const query = args.join(' ');

        try {
            if (isYouTubeUrl(query)) {
                const info = await ytdl.getInfo(query);
                track = {
                    title: info.videoDetails.title,
                    url: query,
                    requester: message.author
                };
            } else {
                // Search YouTube for the term
                const searchResult = await searchYouTube(query);
                track = {
                    title: searchResult.title,
                    url: searchResult.url,
                    requester: message.author
                };
            }

            // Store text channel for sending playback messages
            const guildId = message.guild.id;
            const queue = client.queueMap.get(guildId) || { textChannel: message.channel };
            queue.textChannel = message.channel;
            client.queueMap.set(guildId, queue);

            await enqueueTrack(guildId, track, client , message.channel);

            // Optional: confirm enqueued
            message.channel.send(`✅ Added to queue: **${track.title}**`);

        } catch (error) {
            console.error(error);
            message.reply('Could not play the track, please try again later.');
        }
    }
};

