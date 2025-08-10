module.exports = {
	name: "messageCreate",
	async execute(client,prefix , message) {
		if (!message.guild || !message.content || message.author.bot) return;
		//If the message does not start with the prefix or if the message is from a bot, return
		if (!message.content.startsWith(prefix)) return;

		//Split the message into arguments
		const args = message.content.slice(prefix.length).trim().split(/ +/);
		const commandName = args.shift().toLowerCase();

		//Check if the command exists in the collection
		if (!client.commands.has(commandName)) return;

		const command = client.commands.get(commandName);

		try {
			command.execute(message, args);
		} catch (error) {
			console.error(error);
			message.reply("There was an error trying to execute that command!");
		}
	},
};
