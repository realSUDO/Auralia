module.exports = {
	name: "messageCreate",
	async execute(message , client) {
		if (!message.guild || !message.content || message.author.bot) return;
		
		const startTime = process.hrtime.bigint();
		console.log(`[${new Date().toLocaleTimeString()}] Message: ${message.content}`);
		
		//If the message does not start with the prefix or if the message is from a bot, return
		if (!message.content.startsWith(client.prefix)) return;

		//Split the message into arguments
		const args = message.content.slice(client.prefix.length).trim().split(/ +/);
		const commandName = args.shift().toLowerCase();

		//Check if the command exists in the collection
		if (!client.commands.has(commandName)) return;

		const command = client.commands.get(commandName);
		
		console.log(`[${new Date().toLocaleTimeString()}] Executing command: ${commandName}`);

		try {
			// Execute command without blocking
			const result = command.execute(message, args, client);
			if (result && typeof result.catch === 'function') {
				result.catch(error => {
					console.error(error);
					message.reply("There was an error trying to execute that command!");
				});
			}
		} catch (error) {
			console.error(error);
			message.reply("There was an error trying to execute that command!");
		}
		
		const endTime = process.hrtime.bigint();
		const duration = Number(endTime - startTime) / 1000000; // Convert to ms
		console.log(`[${new Date().toLocaleTimeString()}] Command handler took: ${duration.toFixed(2)}ms`);
	},
}
