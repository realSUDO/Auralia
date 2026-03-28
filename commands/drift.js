const { queueMap } = require("../player/musicPlayer");
const { createSuccessEmbed, createErrorEmbed } = require("../utils/embeds");

function handleDrift(guildId, arg, send) {
  const queue = queueMap.get(guildId);
  if (!queue?.player) return send({ embeds: [createErrorEmbed("No music playing!")] });

  const on = ["on", "true"].includes(arg);
  const off = ["off", "false"].includes(arg);
  if (!on && !off) return send({ embeds: [createErrorEmbed("Usage: `!drift on/off`")] });

  queue.drift = on;
  queue.vibeShiftCount = 0;
  send({ embeds: [createSuccessEmbed(on ? "🌊 Drift enabled — autoplay will shift genres every 4 songs." : "🔒 Drift disabled — autoplay stays on the same vibe.")] });
}

module.exports = {
  name: "drift",
  description: "Toggle genre drift during autoplay",
  execute(message, args) {
    handleDrift(message.guild.id, args[0]?.toLowerCase(), msg => message.channel.send(msg).catch(() => {}));
  },
  async slashExecute(interaction) {
    await interaction.deferReply({ flags: 64 });
    const val = interaction.options.getString("enabled");
    handleDrift(interaction.guildId, val, msg => interaction.editReply(msg).catch(() => {}));
  },
};
