const { queueMap, stopPlayback, shuffleQueue, replayCurrentSong, queueHistory } = require("../player/musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");
const { updatePlayerUI } = require("../utils/playerUI");
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require("../utils/embeds");

module.exports = {
	name: "interactionCreate",
	async execute(interaction, client) {
		if (!interaction.isButton()) return;
		
		// Determine action type
		const customId = interaction.customId;
		let action;
		
		// Check if it's a queue pagination button
		if (customId.startsWith('queue_prev_') || customId.startsWith('queue_next_')) {
			action = customId.startsWith('queue_prev_') ? 'queue_prev' : 'queue_next';
		} else if (customId.startsWith('volume_')) {
			// Extract volume action
			action = customId.startsWith('volume_up_') ? 'volume_up' : 'volume_down';
		} else {
			// Extract action from custom ID for other buttons
			action = customId.split('_')[0];
		}
		
		const queue = queueMap.get(interaction.guildId);
		if (!queue) {
			return interaction.reply({ embeds: [createErrorEmbed("No music playing!")], flags: 64 });
		}
		
		switch (action) {
			case "previous":
				const history = queueHistory.get(interaction.guildId);
				if (!history || history.length < 2) {
					await interaction.reply({ embeds: [createErrorEmbed("No previous song!")], flags: 64 });
				} else {
					const previousSong = history[history.length - 2];
					const currentSong = queue.currentTrack;
					
					// Insert previous song at position 0, push current to position 1
					queue.tracks[0] = previousSong;
					if (currentSong && queue.tracks.length > 0) {
						// Insert current song at position 1 if not already there
						if (queue.tracks[1]?.url !== currentSong.url) {
							queue.tracks.splice(1, 0, currentSong);
						}
					}
					queue.isPrevious = true;
					
					// Remove last 2 from history (current and previous will be re-added when playing)
					history.splice(history.length - 2, 2);
					
					if (queue.playerMessage) {
						queue.playerMessage.delete().catch(() => {});
						queue.playerMessage = null;
					}
					
					queue.intentionalStop = true;
					queue.player.stop();
					await interaction.update({});
				}
				break;
			
			case "pause":
				if (queue.player.state.status === AudioPlayerStatus.Playing) {
					queue.player.pause();
					queue.isPaused = true;
				} else if (queue.player.state.status === AudioPlayerStatus.Paused) {
					queue.player.unpause();
					queue.isPaused = false;
				}
				await interaction.update({});
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				break;
			
			case "skip":
				queue.intentionalStop = true;
				queue.player.stop();
				await interaction.update({});
				break;
			
			case "loop":
				queue.isLooping = !queue.isLooping;
				await interaction.update({});
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				break;
			
			case "replay":
				const replayed = replayCurrentSong(interaction.guildId);
				if (replayed) {
					await interaction.update({});
					queue.textChannel?.send({ embeds: [createSuccessEmbed("🔁 Replaying current song...")] }).catch(() => {});
				} else {
					await interaction.reply({ embeds: [createErrorEmbed("Nothing to replay!")], flags: 64 });
				}
				break;
			
			case "shuffle":
				const shuffled = shuffleQueue(interaction.guildId);
				if (shuffled) {
					await interaction.update({});
					updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				} else {
					await interaction.reply({ embeds: [createErrorEmbed("Nothing to shuffle!")], flags: 64 });
				}
				break;
			
			case "queue":
				if (queue.tracks.length === 0) {
					await interaction.reply({ embeds: [createInfoEmbed("Queue is empty!")], flags: 64 });
				} else {
					const page = 1;
					const perPage = 10;
					const totalPages = Math.ceil(queue.tracks.length / perPage);
					
					const current = queue.tracks[0];
					const upcoming = queue.tracks.slice(1, perPage + 1);
					
					let queueMessage = `🎵 **Now Playing:**\n${current.title}\n\n`;
					
					if (upcoming.length > 0) {
						queueMessage += `**Up Next (Page ${page}/${totalPages}):**\n`;
						upcoming.forEach((track, index) => {
							queueMessage += `${index + 1}. ${track.title}\n`;
						});
					} else {
						queueMessage += `No upcoming songs.`;
					}
					
					const components = [];
					if (totalPages > 1) {
						const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
						const row = new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setCustomId(`queue_prev_${page}_${interaction.guildId}`)
								.setLabel("Previous")
								.setStyle(ButtonStyle.Secondary)
								.setDisabled(true),
							
							new ButtonBuilder()
								.setCustomId(`queue_next_${page}_${interaction.guildId}`)
								.setLabel("Next")
								.setStyle(ButtonStyle.Secondary)
								.setDisabled(false)
						);
						components.push(row);
					}
					
					await interaction.reply({ 
						embeds: [createInfoEmbed(queueMessage)],
						components,
						flags: 64
					});
				}
				break;
			
			case "queue_prev":
			case "queue_next":
				try {
					const [, direction, currentPage] = interaction.customId.split('_');
					const page = direction === 'next' ? parseInt(currentPage) + 1 : parseInt(currentPage) - 1;
					const perPage = 10;
					const start = (page - 1) * perPage;
					const end = start + perPage;
					const totalPages = Math.ceil(queue.tracks.length / perPage);
					
					const current = queue.tracks[0];
					const upcoming = queue.tracks.slice(start + 1, end + 1);
					
					let queueMessage = page === 1 ? `🎵 **Now Playing:**\n${current.title}\n\n` : '';
					
					if (upcoming.length > 0) {
						queueMessage += `**Up Next (Page ${page}/${totalPages}):**\n`;
						upcoming.forEach((track, index) => {
							queueMessage += `${start + index + 1}. ${track.title}\n`;
						});
					} else if (page === 1) {
						queueMessage += `No upcoming songs.`;
					}
					
					const components = [];
					if (totalPages > 1) {
						const { ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");
						const row = new ActionRowBuilder().addComponents(
							new ButtonBuilder()
								.setCustomId(`queue_prev_${page}_${interaction.guildId}`)
								.setLabel("Previous")
								.setStyle(ButtonStyle.Secondary)
								.setDisabled(page === 1),
							
							new ButtonBuilder()
								.setCustomId(`queue_next_${page}_${interaction.guildId}`)
								.setLabel("Next")
								.setStyle(ButtonStyle.Secondary)
								.setDisabled(page === totalPages)
						);
						components.push(row);
					}
					
					await interaction.update({ 
						embeds: [createInfoEmbed(queueMessage)],
						components 
					});
				} catch (error) {
					console.error("Queue pagination error:", error);
					await interaction.reply({ embeds: [createErrorEmbed("Failed to update queue page.")], flags: 64 }).catch(() => {});
				}
				break;
			
			case "stop":
				stopPlayback(interaction.guildId);
				await interaction.update({});
				break;
			
			case "volume_up":
				let newVolumeUp = Math.min(100, (queue.volume || 100) + 10);
				queue.volume = newVolumeUp;
				if (queue.player.state.resource) {
					queue.player.state.resource.volume.setVolume(newVolumeUp / 100);
				}
				await interaction.update({});
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				break;
			
			case "volume_down":
				let newVolumeDown = Math.max(0, (queue.volume || 100) - 10);
				queue.volume = newVolumeDown;
				if (queue.player.state.resource) {
					queue.player.state.resource.volume.setVolume(newVolumeDown / 100);
				}
				await interaction.update({});
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				break;
			
			default:
				await interaction.reply({ embeds: [createErrorEmbed("Unknown button")], flags: 64 });
		}
	},
};
