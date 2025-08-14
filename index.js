// loads the fs module to read files used for command loading
const fs = require("fs");

//Imorting discord.js so we can interact with the Discord API
const Discord = require("discord.js");
const { prefix, token } = require("./config.json"); // Importing the prefix and token from config.json

//Creating the bot client
const client = new Discord.Client({
	intents: [
		Discord.GatewayIntentBits.Guilds, //Allows the bot to see in which server it is
		Discord.GatewayIntentBits.GuildMessages, //Allows the bot to see messages in the server
		Discord.GatewayIntentBits.MessageContent, //Allows the bot to see the content of the messages
		Discord.GatewayIntentBits.GuildVoiceStates, //Allows the bot to see the voice states of the users in the server
	],
});

const { authorizeSpotify } = require("./utils/spotify"); // Importing the Spotify authorization function

client.prefix = prefix; // This will hold the prefix for the bot commands
client.commands = new Discord.Collection(); // This will hold the commands collection
client.queueMap = new Map(); // This will hold the queue for each server


//Reading the commands folder and loading the commands
	const commandFiles = fs
		.readdirSync("./commands")
		.filter((file) => file.endsWith(".js"));

	//Dynamically loading the each command file into the commands collection

	for (const file of commandFiles) {
		const command = require(`./commands/${file}`);
		client.commands.set(command.name, command);
	} // This makes it easy to run a command by name without using a bunch of if statements

// Load all the events dynamically from the events folder
const eventFiles = fs.readdirSync("./events").filter(f => f.endsWith(".js"));
	for (const file of eventFiles) {
		const event = require(`./events/${file}`);
		if (event.once) {
			client.once(event.name, (...args) => event.execute( ...args,client )); // If the event is a one-time event, use client.once
		}
		else {
			client.on(event.name, (...args) => event.execute( ...args,client )); // If the event is a recurring event, use client.on
		}
}

	//Login to Discord with the bot token
	client.login(token)
		.then(() => {
		console.log("Bot is logged in successfully!");
		authorizeSpotify().catch(console.error) // Authorize Spotify API on startup
	})
		.catch((err) => console.error("Failed to log in:", err));
