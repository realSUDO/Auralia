const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

/**
 * Format seconds to MM:SS
 */
function formatTime(seconds) {
	const mins = Math.floor(seconds / 60);
	const secs = Math.floor(seconds % 60);
	return `${mins}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Create progress bar
 */
function createProgressBar(current, total, length = 15) {
	const progress = Math.min(current / total, 1);
	const filled = Math.floor(progress * length);
	const empty = length - filled;
	return '▰'.repeat(filled) + '▱'.repeat(empty);
}

/**
 * Create now playing embed with progress
 */
function createNowPlayingEmbed(track, queue) {
	const embed = new EmbedBuilder()
		.setTitle("🎵 Now Playing")
		.setDescription(`**${track.title}**`)
		.setColor(queue.isPaused ? 0xff9900 : 0x00ffcc);
	
	// Add progress bar if we have duration
	if (queue.duration > 0 && queue.playbackStartTime) {
		const elapsed = queue.isPaused 
			? queue.playbackOffset 
			: queue.playbackOffset + (Date.now() - queue.playbackStartTime) / 1000;
		const progressBar = createProgressBar(elapsed, queue.duration);
		embed.addFields({
			name: "Progress",
			value: `${progressBar} ${formatTime(elapsed)} / ${formatTime(queue.duration)}`,
			inline: false
		});
	}
	
	embed.addFields(
		{ name: "Requested by", value: track.requester.username, inline: true },
		{ name: "Queue", value: `${queue.tracks.length} song(s)`, inline: true }
	);
	
	if (queue.isPaused) {
		embed.setFooter({ text: "⏸️ Paused" });
	}
	
	embed.setTimestamp();
	
	return embed;
}

/**
 * Create player control buttons (Row 1: Playback)
 */
function createPlaybackButtons(queue) {
	const guildId = queue.connection?.joinConfig?.guildId || '';
	
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`previous_${guildId}`)
			.setEmoji("⏮️")
			.setStyle(ButtonStyle.Secondary),
		
		new ButtonBuilder()
			.setCustomId(`pause_${guildId}`)
			.setEmoji(queue.isPaused ? "▶️" : "⏸️")
			.setStyle(ButtonStyle.Primary),
		
		new ButtonBuilder()
			.setCustomId(`skip_${guildId}`)
			.setEmoji("⏭️")
			.setStyle(ButtonStyle.Secondary),
		
		new ButtonBuilder()
			.setCustomId(`loop_${guildId}`)
			.setEmoji("🔂")
			.setStyle(queue.isLooping ? ButtonStyle.Success : ButtonStyle.Secondary)
	);
}

/**
 * Create system control buttons (Row 2: System)
 */
function createSystemButtons(queue) {
	const guildId = queue.connection?.joinConfig?.guildId || '';
	
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`replay_${guildId}`)
			.setEmoji("🔁")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(!queue.currentTrack),
		
		new ButtonBuilder()
			.setCustomId(`shuffle_${guildId}`)
			.setEmoji("🔀")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(queue.tracks.length <= 1),
		
		new ButtonBuilder()
			.setCustomId(`queue_${guildId}`)
			.setEmoji("📜")
			.setStyle(ButtonStyle.Secondary),
		
		new ButtonBuilder()
			.setCustomId(`stop_${guildId}`)
			.setEmoji("⏹️")
			.setStyle(ButtonStyle.Danger)
	);
}

/**
 * Send or update player UI
 */
async function updatePlayerUI(queue, track, channel) {
	const embed = createNowPlayingEmbed(track, queue);
	const playbackRow = createPlaybackButtons(queue);
	const systemRow = createSystemButtons(queue);
	
	if (queue.playerMessage) {
		// Update existing message
		try {
			await queue.playerMessage.edit({ 
				embeds: [embed], 
				components: [playbackRow, systemRow] 
			});
		} catch (error) {
			// Message deleted or doesn't exist, send new one
			try {
				queue.playerMessage = await channel.send({ 
					embeds: [embed], 
					components: [playbackRow, systemRow] 
				});
				startProgressUpdates(queue, track, channel);
			} catch (e) {
				console.error("Failed to send player UI:", e.message);
			}
		}
	} else {
		// Send new message
		try {
			queue.playerMessage = await channel.send({ 
				embeds: [embed], 
				components: [playbackRow, systemRow] 
			});
			startProgressUpdates(queue, track, channel);
		} catch (error) {
			console.error("Failed to send player UI:", error.message);
		}
	}
}

/**
 * Start updating progress bar every 10 seconds
 */
function startProgressUpdates(queue, track, channel) {
	// Clear existing interval
	if (queue.progressInterval) {
		clearInterval(queue.progressInterval);
	}
	
	// Update every 10 seconds
	queue.progressInterval = setInterval(() => {
		if (queue.playerMessage && queue.duration > 0 && !queue.isPaused) {
			const embed = createNowPlayingEmbed(track, queue);
			const playbackRow = createPlaybackButtons(queue);
			const systemRow = createSystemButtons(queue);
			
			queue.playerMessage.edit({ 
				embeds: [embed], 
				components: [playbackRow, systemRow] 
			}).catch(() => {
				// Message deleted, clear interval
				if (queue.progressInterval) {
					clearInterval(queue.progressInterval);
					queue.progressInterval = null;
				}
			});
		}
	}, 10000);
}

/**
 * Disable all buttons
 */
async function disablePlayerUI(queue) {
	if (!queue.playerMessage) return;
	
	const guildId = queue.connection?.joinConfig?.guildId || '';
	
	const playbackRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`previous_${guildId}`)
			.setEmoji("⏮️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(true),
		
		new ButtonBuilder()
			.setCustomId(`pause_${guildId}`)
			.setEmoji("⏸️")
			.setStyle(ButtonStyle.Primary)
			.setDisabled(true),
		
		new ButtonBuilder()
			.setCustomId(`skip_${guildId}`)
			.setEmoji("⏭️")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(true),
		
		new ButtonBuilder()
			.setCustomId(`loop_${guildId}`)
			.setEmoji("🔂")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(true)
	);
	
	const systemRow = new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`replay_${guildId}`)
			.setEmoji("🔁")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(true),
		
		new ButtonBuilder()
			.setCustomId(`shuffle_${guildId}`)
			.setEmoji("🔀")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(true),
		
		new ButtonBuilder()
			.setCustomId(`queue_${guildId}`)
			.setEmoji("📜")
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(true),
		
		new ButtonBuilder()
			.setCustomId(`stop_${guildId}`)
			.setEmoji("⏹️")
			.setStyle(ButtonStyle.Danger)
			.setDisabled(true)
	);
	
	try {
		await queue.playerMessage.edit({ components: [playbackRow, systemRow] });
	} catch (error) {
		// Message deleted, ignore
	}
}

module.exports = {
	createNowPlayingEmbed,
	createPlaybackButtons,
	createSystemButtons,
	updatePlayerUI,
	disablePlayerUI,
	startProgressUpdates,
};
