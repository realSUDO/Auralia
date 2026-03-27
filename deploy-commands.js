const { REST, Routes, SlashCommandBuilder } = require("discord.js");
const { token, clientId } = require("./config.json");

const commands = [
  new SlashCommandBuilder().setName("play").setDescription("Play a song").addStringOption(o => o.setName("query").setDescription("YouTube URL, Spotify link, or search term").setRequired(true)),
  new SlashCommandBuilder().setName("pause").setDescription("Pause or resume the current song"),
  new SlashCommandBuilder().setName("skip").setDescription("Skip the current song"),
  new SlashCommandBuilder().setName("stop").setDescription("Stop music and clear the queue"),
  new SlashCommandBuilder().setName("queue").setDescription("Show the current queue").addIntegerOption(o => o.setName("page").setDescription("Page number").setMinValue(1)),
  new SlashCommandBuilder().setName("loop").setDescription("Toggle loop mode"),
  new SlashCommandBuilder().setName("shuffle").setDescription("Shuffle the queue"),
  new SlashCommandBuilder().setName("volume").setDescription("Set or check volume").addIntegerOption(o => o.setName("level").setDescription("Volume level (0-100)").setMinValue(0).setMaxValue(100)),
  new SlashCommandBuilder().setName("join").setDescription("Join your voice channel"),
  new SlashCommandBuilder().setName("leave").setDescription("Leave the voice channel"),
  new SlashCommandBuilder().setName("clear").setDescription("Clear upcoming songs from queue"),
  new SlashCommandBuilder().setName("replay").setDescription("Replay the current song"),
  new SlashCommandBuilder().setName("replayq").setDescription("Replay the last queue"),
  new SlashCommandBuilder().setName("ping").setDescription("Check bot latency"),
].map(c => c.toJSON());

const rest = new REST().setToken(token);

(async () => {
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log(`Done! Registered ${commands.length} commands.`);
})().catch(console.error);
