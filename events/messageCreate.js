module.exports = {
	name: "messageCreate",
	async execute(client, message) {
		// Ignore messages from bots
		if (message.author.bot) return;

		// Ignore messages that do not start with the prefix
		if (!message.content.startsWith(client.prefix)) return;

		// Split the message into command and arguments
		const args = message.content.slice(client.prefix.length).trim().split(/ +/);
		const commandName = args.shift().toLowerCase();

		// Check if the command exists in the collection
		const command = client.commands.get(commandName);
		if (!command) return;

		// Execute the command
		try {
			await command.execute(client, message, args);
		} catch (error) {
			console.error(`Error executing command ${commandName}:`, error);
			message.reply("There was an error trying to execute that command!");
		}
	}
