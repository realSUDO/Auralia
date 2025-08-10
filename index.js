// loads the fs module to read files used for command loading 
const fs = require('fs');

//Imorting discord.js so we can interact with the Discord API
const Discord = require('discord.js');
const { prefix , token } = require('./config.json'); // Importing the prefix and token from config.json


//Creating the bot client

const client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds, //Allows the bot to see in which server it is
		Discord.GatewayIntentBits.GuildMessages, //Allows the bot to see messages in the server
		Discord.GatewayIntentBits.MessageContent, //Allows the bot to see the content of the messages
	],
});


//Make a collection to store the commands
client.commands = new Discord.Collection();
//Reading the commands folder and loading the commands
const commandFiles = fs.readdirSync('./commands').filter(file => file.endsWith('.js'));

//Dynamically loading the each command file into the commands collection

for (const file of commandFiles) {
	const command = require(`./commands/${file}`);
	client.commands.set(command.name, command);
}
// This makes it easy to run a command by name without using a bunch of if statements

//Bot ready event
client.once('ready', () => {
	console.log(`$(client.user.tag) is online! and ready to go!`);
});

//Listen for messages
client.on('messageCreate', message => {
	//If the message does not start with the prefix or if the message is from a bot, return
	if (!message.content.startsWith(prefix) || message.author.bot) return;

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
		message.reply('There was an error trying to execute that command!');
	}
});
    
//Login to Discord with the bot token
client.login(token)
	.then(() => console.log('Bot is logged in successfully!'))
	.catch(err => console.error('Failed to log in:', err));



