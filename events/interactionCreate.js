const { queueMap, stopPlayback, shuffleQueue, replayCurrentSong, queueHistory } = require("../player/musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");
const { updatePlayerUI } = require("../utils/playerUI");
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require("../utils/embeds");

module.exports = {
	name: "interactionCreate",
	async execute(interaction, client) {
		if (!interaction.isButton()) return;
		
		// Extract guild ID from custom ID
		const [action, guildId] = interaction.customId.split('_');
		
		const queue = queueMap.get(interaction.guildId);
		if (!queue) {
			return interaction.reply({ embeds: [createErrorEmbed("No music playing!")], ephemeral: true });
		}
		
		switch (action) {
			case "previous":
				const history = queueHistory.get(interaction.guildId);
				if (!history || history.length < 2) {
					await interaction.reply({ embeds: [createErrorEmbed("No previous song!")], ephemeral: true });
				} else {
					const previousSong = history[history.length - 2];
					if (queue.currentTrack) {
						queue.tracks.unshift(queue.currentTrack);
					}
					queue.tracks.unshift(previousSong);
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
					await interaction.reply({ embeds: [createErrorEmbed("Nothing to replay!")], ephemeral: true });
				}
				break;
			
			case "shuffle":
				const shuffled = shuffleQueue(interaction.guildId);
				if (shuffled) {
					await interaction.update({});
					updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				} else {
					await interaction.reply({ embeds: [createErrorEmbed("Nothing to shuffle!")], ephemeral: true });
				}
				break;
			
			case "queue":
				if (queue.tracks.length === 0) {
					await interaction.reply({ embeds: [createInfoEmbed("Queue is empty!")], ephemeral: true });
				} else {
					const queueList = queue.tracks.slice(0, 10).map((t, i) => `${i + 1}. ${t.title}`).join('\n');
					const more = queue.tracks.length > 10 ? `\n...and ${queue.tracks.length - 10} more` : '';
					await interaction.reply({ embeds: [createInfoEmbed(`**Queue:**\n${queueList}${more}`)], ephemeral: true });
				}
				break;
			
			case "queue_prev":
			case "queue_next":
				const [, direction, currentPage] = interaction.customId.split('_');
				const page = direction === 'next' ? parseInt(currentPage) + 1 : parseInt(currentPage) - 1;
				const perPage = 10;
				const start = (page - 1) * perPage;
				const end = start + perPage;
				const totalPages = Math.ceil(queue.tracks.length / perPage);
				
				const upcoming = queue.tracks.slice(start + 1, end + 1);
				let queueMessage = page === 1 ? `🎵 **Now Playing:**\n${queue.tracks[0].title}\n\n` : '';
				
				if (upcoming.length > 0) {
					queueMessage += `**Up Next (Page ${page}/${totalPages}):**\n`;
					upcoming.forEach((track, index) => {
						queueMessage += `${start + index + 1}. ${track.title}\n`;
					});
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
				break;
			
			case "stop":
				stopPlayback(interaction.guildId);
				await interaction.update({});
				break;
			
			default:
				await interaction.reply({ embeds: [createErrorEmbed("Unknown button")], ephemeral: true });
		}
	},
};
