const { queueMap, stopPlayback, shuffleQueue, replayCurrentSong, queueHistory } = require("../player/musicPlayer");
const { AudioPlayerStatus } = require("@discordjs/voice");
const { updatePlayerUI } = require("../utils/playerUI");
const { createSuccessEmbed, createErrorEmbed, createInfoEmbed } = require("../utils/embeds");

module.exports = {
	name: "interactionCreate",
	async execute(interaction, client) {
		// Handle slash commands
		if (interaction.isChatInputCommand()) {
			const command = client.commands.get(interaction.commandName);
			if (!command?.slashExecute) return interaction.reply({ embeds: [createErrorEmbed("Command not found.")], flags: 64 });
			try {
				await command.slashExecute(interaction, client);
			} catch (err) {
				console.error(err);
				const msg = { embeds: [createErrorEmbed("Something went wrong.")], flags: 64 };
				interaction.replied || interaction.deferred ? interaction.editReply(msg).catch(() => {}) : interaction.reply(msg).catch(() => {});
			}
			return;
		}

		if (!interaction.isButton()) return;

		const customId = interaction.customId;

		// Handle commands pagination — no queue needed
		if (customId.startsWith('cmd_prev_') || customId.startsWith('cmd_next_')) {
			const dir = customId.startsWith('cmd_next_') ? 1 : -1;
			const currentPage = parseInt(customId.split('_')[2]);
			const { buildPage } = require('../commands/commands');
			await interaction.update(buildPage(currentPage + dir)).catch(() => {});
			return;
		}

		// Handle mood pick — no queue check needed for the reply
		if (customId.startsWith('moodpick_')) {
			const parts = customId.split('_'); // moodpick_<mood>_<guildId>
			const moodType = parts[1];
			const { handleMoodFromButton } = require('../commands/mood');
			await interaction.deferReply({ flags: 64 });
			handleMoodFromButton(moodType, interaction.user, interaction.guild, interaction.channel, client,
				msg => interaction.editReply(msg).catch(() => {}));
			return;
		}

		// Determine action type
		let action;
		
		// Check if it's a queue pagination button
		if (customId.startsWith('queue_prev_') || customId.startsWith('queue_next_')) {
			action = customId.startsWith('queue_prev_') ? 'queue_prev' : 'queue_next';
		} else if (customId.startsWith('volume_')) {
			action = customId.startsWith('volume_up_') ? 'volume_up' : 'volume_down';
		} else if (customId.startsWith('autoplay_')) {
			action = 'autoplay';
		} else if (customId.startsWith('moodmenu_')) {
			action = 'moodmenu';
		} else {
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
					await interaction.update({}).catch(() => {});
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
				await interaction.update({}).catch(() => {});
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				break;
			
			case "skip":
				queue.intentionalStop = true;
				queue.player.stop();
				await interaction.update({}).catch(() => {});
				break;
			
			case "loop":
				queue.isLooping = !queue.isLooping;
				await interaction.update({}).catch(() => {});
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				break;
			
			case "replay":
				const replayed = replayCurrentSong(interaction.guildId);
				if (replayed) {
					await interaction.update({}).catch(() => {});
					queue.textChannel?.send({ embeds: [createSuccessEmbed("🔁 Replaying current song...")] }).catch(() => {});
				} else {
					await interaction.reply({ embeds: [createErrorEmbed("Nothing to replay!")], flags: 64 });
				}
				break;
			
			case "shuffle":
				const shuffled = shuffleQueue(interaction.guildId);
				if (shuffled) {
					await interaction.update({}).catch(() => {});
					updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				} else {
					await interaction.reply({ embeds: [createErrorEmbed("Nothing to shuffle!")], flags: 64 });
				}
				break;
			
			case "queue": {
				const { buildQueueEmbed } = require('../commands/queue');
				await interaction.reply({ ...buildQueueEmbed(queue, 1, interaction.guildId), flags: 64 });
				break;
			}

			case "queue_prev":
			case "queue_next": {
				try {
					const parts = interaction.customId.split('_');
					const currentPage = parseInt(parts[2]);
					const newPage = action === 'queue_next' ? currentPage + 1 : currentPage - 1;
					const { buildQueueEmbed } = require('../commands/queue');
					await interaction.update(buildQueueEmbed(queue, newPage, interaction.guildId));
				} catch (error) {
					console.error("Queue pagination error:", error);
					await interaction.reply({ embeds: [createErrorEmbed("Failed to update queue page.")], flags: 64 }).catch(() => {});
				}
				break;
			}
			
			case "cmd_prev":
		case "cmd_next": {
			const currentPage = parseInt(customId.split('_')[2]);
			const newPage = action === 'cmd_next' ? currentPage + 1 : currentPage - 1;
			const { buildPage } = require('../commands/commands');
			await interaction.update(buildPage(newPage)).catch(() => {});
			break;
		}

		case "autoplay": {
			const { triggerAutoplayFetch } = require('../player/musicPlayer');
			queue.autoplay = !queue.autoplay;
			queue.autoplaySuggestion = null;
			if (!queue.autoplay) {
				queue.tracks = queue.tracks.filter((t, i) => i === 0 || !t.isAutoPlaySong);
			}
			if (queue.autoplay) {
				const hasUserSongsAhead = queue.tracks.slice(1).some(t => !t.isAutoPlaySong);
				if (!hasUserSongsAhead && queue.currentTrack) triggerAutoplayFetch(interaction.guildId);
			}
			await interaction.update({}).catch(() => {});
			updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
			break;
		}

		case "moodmenu": {
			const { createMoodSelectionRows } = require('../utils/playerUI');
			const rows = createMoodSelectionRows(interaction.guildId);
			await interaction.reply({ content: '🎭 Pick a mood:', components: rows, flags: 64 }).catch(() => {});
			break;
		}

		case "stop":
				stopPlayback(interaction.guildId);
				await interaction.update({}).catch(() => {});
				break;
			
			case "volume_up":
				let newVolumeUp = Math.min(100, (queue.volume || 100) + 10);
				queue.volume = newVolumeUp;
				if (queue.player.state.resource) {
					queue.player.state.resource.volume.setVolume(newVolumeUp / 100);
				}
				await interaction.update({}).catch(() => {});
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				break;
			
			case "volume_down":
				let newVolumeDown = Math.max(0, (queue.volume || 100) - 10);
				queue.volume = newVolumeDown;
				if (queue.player.state.resource) {
					queue.player.state.resource.volume.setVolume(newVolumeDown / 100);
				}
				await interaction.update({}).catch(() => {});
				updatePlayerUI(queue, queue.currentTrack, queue.textChannel).catch(console.error);
				break;
			
			default:
				await interaction.reply({ embeds: [createErrorEmbed("Unknown button")], flags: 64 });
		}
	},
};
