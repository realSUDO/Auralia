module.exports = {
	name: "messageCreate",
	async execute(message, client) {
		if (!message.guild || !message.content || message.author.bot) return;
		if (!message.content.startsWith(client.prefix)) return;

		const args = message.content.slice(client.prefix.length).trim().split(/ +/);
		const commandName = args.shift().toLowerCase();
		if (!client.commands.has(commandName)) return;

		const command = client.commands.get(commandName);
		console.log(`[${new Date().toLocaleTimeString()}] ${message.author.tag} → !${commandName}${args.length ? ' ' + args.join(' ') : ''}`);

		try {
			const result = command.execute(message, args, client);
			if (result?.catch) result.catch(err => {
				console.error(`Command error [${commandName}]:`, err);
				message.reply("There was an error executing that command!");
			});
		} catch (err) {
			console.error(`Command error [${commandName}]:`, err);
			message.reply("There was an error executing that command!");
		}
	},
};
