module.exports = {
	name : 'ping',
	description: 'Replies with Pong!',
	execute(message, args) {
		const { createSuccessEmbed } = require("../utils/embeds");
		message.channel.send({ embeds: [createSuccessEmbed('Pong! 🏓')] });
	}
};
