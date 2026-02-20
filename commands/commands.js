const { EmbedBuilder } = require("discord.js");

module.exports = {
  name: "commands",
  description: "Shows all available commands",
  execute(message) {
    const embed = new EmbedBuilder()
      .setTitle("🎵 Auralia Commands")
      .setColor(0x00ffcc)
      .setDescription("Here are all the available commands:")
      .addFields(
        {
          name: "🎶 Playback",
          value: 
            "`!play <query>` - Play a song from YouTube/Spotify\n" +
            "`!p <query>` - Smart play/pause toggle\n" +
            "`!pause` - Pause/resume the current song\n" +
            "`!skip` or `!next` - Skip to the next song\n" +
            "`!previous` or `!prev` - Play the previous song\n" +
            "`!loop` - Toggle loop mode\n" +
            "`!stop` - Stop playback and clear queue\n" +
            "`!replay` - Replay the current song",
          inline: false
        },
        {
          name: "📜 Queue Management",
          value:
            "`!queue` or `!q` - Show the current queue\n" +
            "`!clear` - Clear all upcoming songs\n" +
            "`!shuffle` - Shuffle the queue\n" +
            "`!replayq` - Replay the last queue",
          inline: false
        },
        {
          name: "🔊 Audio Controls",
          value:
            "`!volume <0-100>` - Set volume (multiples of 10)\n" +
            "Use volume buttons on player for quick adjustments",
          inline: false
        },
        {
          name: "🔧 Voice Channel",
          value:
            "`!join` - Join your voice channel\n" +
            "`!leave` - Leave the voice channel",
          inline: false
        },
        {
          name: "ℹ️ Info",
          value:
            "`!ping` - Check bot latency\n" +
            "`!commands` - Show this message",
          inline: false
        }
      )
      .setFooter({ text: "Use the interactive buttons on the player for quick controls!" })
      .setTimestamp();

    message.channel.send({ embeds: [embed] });
  },
};
