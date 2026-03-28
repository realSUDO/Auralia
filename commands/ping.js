const { createSuccessEmbed } = require("../utils/embeds");

module.exports = {
  name: "ping",
  description: "Check bot latency",
  execute(message) {
    message.channel.send({ embeds: [createSuccessEmbed("Pong! 🏓")] });
  },
  async slashExecute(interaction) {
    await interaction.reply({ embeds: [createSuccessEmbed("Pong! 🏓")], flags: 64 });
  },
};
