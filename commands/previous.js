const { queueMap, queueHistory, enqueueTrack } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

module.exports = {
  name: "previous",
  description: "Play the previous song",
  execute(message, args, client) {
    const queue = queueMap.get(message.guild.id);
    const history = queueHistory.get(message.guild.id);
    
    // Check if user is in voice channel
    if (!message.member.voice.channel) {
      return message.reply({ embeds: [createErrorEmbed("You need to be in a voice channel!")] }).catch(() => {});
    }
    
    // If no history, can't go back
    if (!history || history.length === 0) {
      return message.reply({ embeds: [createErrorEmbed("No previous song to play!")] }).catch(() => {});
    }
    
    // If queue exists and is playing
    if (queue && queue.player && queue.playing) {
      // Normal case: go back in history
      if (history.length >= 2) {
        const previousSong = { ...history[history.length - 2], requester: message.author };
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
        
        // Remove last 2 from history (will be re-added when playing)
        history.splice(history.length - 2, 2);
        
        if (queue.playerMessage) {
          queue.playerMessage.delete().catch(() => {});
          queue.playerMessage = null;
        }
        
        queue.intentionalStop = true;
        queue.player.stop();
        
        message.channel.send({ embeds: [createSuccessEmbed(`⏮️ Playing previous: **${previousSong.title}**`)] }).catch(() => {});
      } else {
        // Only 1 song in history - replay it
        const lastSong = { ...history[0], requester: message.author };
        const currentSong = queue.currentTrack;
        
        queue.tracks[0] = lastSong;
        if (currentSong && queue.tracks.length > 0) {
          if (queue.tracks[1]?.url !== currentSong.url) {
            queue.tracks.splice(1, 0, currentSong);
          }
        }
        queue.isPrevious = true;
        history.length = 0; // Clear history
        
        if (queue.playerMessage) {
          queue.playerMessage.delete().catch(() => {});
          queue.playerMessage = null;
        }
        
        queue.intentionalStop = true;
        queue.player.stop();
        
        message.channel.send({ embeds: [createSuccessEmbed(`⏮️ Playing previous: **${lastSong.title}**`)] }).catch(() => {});
      }
    } else {
      // Queue stopped, restart with last song from history
      const lastSong = { ...history[history.length - 1], requester: message.author };
      enqueueTrack(message.guild.id, lastSong, client, message.channel);
      message.channel.send({ embeds: [createSuccessEmbed(`⏮️ Playing previous: **${lastSong.title}**`)] }).catch(() => {});
    }
  },
};
