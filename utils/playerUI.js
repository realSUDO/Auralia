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
 * Snake-style bouncing bar for livestreams.
 * Single ▰ bounces left→right→left across ▱▱▱▱▱
 */
function createLivestreamBar(tick, length = 15) {
	const filled = 3;
	const pos = tick % length;
	let bar = '▱'.repeat(length);
	let arr = bar.split('');
	for (let i = 0; i < filled; i++) {
		arr[(pos + i) % length] = '▰';
	}
	return arr.join('');
}

/**
 * Create now playing embed with progress
 */
function createNowPlayingEmbed(track, queue) {
	const embed = new EmbedBuilder()
		.setTitle(track.isAutoPlaySong ? "<:music:1487409848126668971> Now Playing (autoplay)" : "<:music:1487409848126668971> Now Playing")
		.setDescription(`**${track.title}**`)
		.setColor(queue.isPaused ? 0xff9900 : 0x00ffcc);

	if (track.livestream) {
		const tick = Math.floor((Date.now() - (queue.playbackStartTime || Date.now())) / 1000);
		embed.addFields({ name: "📻 Live", value: createLivestreamBar(tick), inline: false });
	} else if (queue.duration > 0 && queue.playbackStartTime) {
		const elapsed = queue.isPaused
			? queue.playbackOffset
			: queue.playbackOffset + (Date.now() - queue.playbackStartTime) / 1000;
		embed.addFields({
			name: "Progress",
			value: `${createProgressBar(elapsed, queue.duration)} ${formatTime(elapsed)} / ${formatTime(queue.duration)}`,
			inline: false
		});
	}
	
	embed.addFields(
		{ name: "Requested by", value: track.requester?.username || 'Unknown', inline: true },
		{ name: "Queue", value: `${Math.max(0, queue.tracks.length - 1) + (queue.autoplaySuggestion ? 1 : 0)} song(s)`, inline: true }
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
			.setEmoji({ id: '1486986486309195797' })
			.setStyle(ButtonStyle.Secondary),
		
		new ButtonBuilder()
			.setCustomId(`pause_${guildId}`)
			.setEmoji({ id: queue.isPaused ? '1486988423280722061' : '1486988421158404236' })
			.setStyle(ButtonStyle.Primary),
		
		new ButtonBuilder()
			.setCustomId(`skip_${guildId}`)
			.setEmoji({ id: '1486986864333164615' })
			.setStyle(ButtonStyle.Secondary),
		
		new ButtonBuilder()
			.setCustomId(`loop_${guildId}`)
			.setEmoji({ id: '1486988419052732458' })
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
			.setEmoji({ id: '1486988430864027759' })
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(!queue.currentTrack),
		
		new ButtonBuilder()
			.setCustomId(`shuffle_${guildId}`)
			.setEmoji({ id: '1486988433175089372' })
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(queue.tracks.length <= 1),
		
		new ButtonBuilder()
			.setCustomId(`queue_${guildId}`)
			.setEmoji({ id: '1486988425398583336' })
			.setStyle(ButtonStyle.Secondary),
		
		new ButtonBuilder()
			.setCustomId(`stop_${guildId}`)
			.setEmoji({ id: '1486988434969985034' })
			.setStyle(ButtonStyle.Danger)
	);
}

/**
 * Create volume + autoplay buttons (Row 3)
 */
function createVolumeButtons(queue) {
	const guildId = queue.connection?.joinConfig?.guildId || '';
	const currentVolume = queue.volume || 100;

	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`volume_down_${guildId}`)
			.setEmoji({ id: '1486988437822242919' })
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(currentVolume <= 0),

		new ButtonBuilder()
			.setCustomId(`volume_up_${guildId}`)
			.setEmoji({ id: '1486988442901544971' })
			.setStyle(ButtonStyle.Secondary)
			.setDisabled(currentVolume >= 100),

		new ButtonBuilder()
			.setCustomId(`autoplay_${guildId}`)
			.setEmoji({ id: '1487342669595414580' })
			.setLabel(queue.autoplay ? 'Autoplay: ON' : 'Autoplay: OFF')
			.setStyle(queue.autoplay ? ButtonStyle.Success : ButtonStyle.Secondary)
	);
}

/**
 * Mood button (Row 4 — full width single button)
 */
function createAutoplayMoodButtons(queue) {
	const guildId = queue.connection?.joinConfig?.guildId || '';
	return new ActionRowBuilder().addComponents(
		new ButtonBuilder()
			.setCustomId(`moodmenu_${guildId}`)
			.setEmoji({ id: '1487343068733509683' })
			.setLabel(queue.moodActive ? `Mood: ${queue.moodGenre}  —  click to change` : 'Mood  —  pick a vibe')
			.setStyle(queue.moodActive ? ButtonStyle.Success : ButtonStyle.Secondary)
	);
}

/**
 * Mood selection row (ephemeral reply when mood button clicked)
 */
function createMoodSelectionRows(guildId) {
	const moods = [
		{ id: 'happy', label: '😄 Happy' },
		{ id: 'sad', label: '😢 Sad' },
		{ id: 'energetic', label: '⚡ Energetic' },
		{ id: 'hiphop', label: '🎤 Hip-Hop' },
		{ id: 'lofi', label: '🌙 Lofi' },
	];
	const moods2 = [
		{ id: 'metal', label: '🤘 Metal' },
		{ id: 'lofiradio', label: '📻 Lofi Radio' },
	];
	const makeRow = (list) => new ActionRowBuilder().addComponents(
		list.map(m => new ButtonBuilder()
			.setCustomId(`moodpick_${m.id}_${guildId}`)
			.setLabel(m.label)
			.setStyle(ButtonStyle.Secondary)
		)
	);
	return [makeRow(moods), makeRow(moods2)];
}

/**
 * Send or update player UI
 */
async function updatePlayerUI(queue, track, channel) {
	const embed = createNowPlayingEmbed(track, queue);
	const playbackRow = createPlaybackButtons(queue);
	const systemRow = createSystemButtons(queue);
	const volumeRow = createVolumeButtons(queue);
	const autoplayMoodRow = createAutoplayMoodButtons(queue);

	const components = [playbackRow, systemRow, volumeRow, autoplayMoodRow];

	if (queue.playerMessage) {
		try {
			await queue.playerMessage.edit({ embeds: [embed], components });
		} catch {
			try {
				queue.playerMessage = await channel.send({ embeds: [embed], components });
				startProgressUpdates(queue, track, channel);
			} catch (e) {
				console.error("Failed to send player UI:", e.message);
			}
		}
	} else {
		try {
			queue.playerMessage = await channel.send({ embeds: [embed], components });
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
	
	// Update every 10 seconds (every 1s for livestreams)
	const intervalMs = 1000;
	queue.progressInterval = setInterval(() => {
		if (queue.playerMessage && queue.currentTrack && !queue.isPaused) {
			const embed = createNowPlayingEmbed(track, queue);
			const playbackRow = createPlaybackButtons(queue);
			const systemRow = createSystemButtons(queue);
			const volumeRow = createVolumeButtons(queue);
			const autoplayMoodRow = createAutoplayMoodButtons(queue);
			queue.playerMessage.edit({ 
				embeds: [embed], 
				components: [playbackRow, systemRow, volumeRow, autoplayMoodRow]
			}).catch(() => {
				if (queue.progressInterval) {
					clearInterval(queue.progressInterval);
					queue.progressInterval = null;
				}
			});
		}
	}, intervalMs);
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
	createVolumeButtons,
	createAutoplayMoodButtons,
	createMoodSelectionRows,
	updatePlayerUI,
	disablePlayerUI,
	startProgressUpdates,
};
