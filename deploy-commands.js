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
  new SlashCommandBuilder().setName("autoplay").setDescription("Toggle autoplay. Use action:off to disable.")
    .addStringOption(o => o.setName("action").setDescription("off to disable").setRequired(false)),
  new SlashCommandBuilder().setName("moodskip").setDescription("Skip current song and shift to a new mood"),
  new SlashCommandBuilder().setName("lofiradio").setDescription("Start the lofi radio livestream"),
  new SlashCommandBuilder().setName("mood").setDescription("Play a mood-based playlist")
    .addStringOption(o => o.setName("mood").setDescription(`Mood type: happy, sad, energetic, hiphop, lofi, lofiradio, metal, strict`).setRequired(true))
    .addBooleanOption(o => o.setName("strict").setDescription("Stay in this mood without drifting")),
  new SlashCommandBuilder().setName("drift").setDescription("Toggle genre drift during autoplay")
    .addStringOption(o => o.setName("enabled").setDescription("on or off").setRequired(true).addChoices({ name: "on", value: "on" }, { name: "off", value: "off" })),
  new SlashCommandBuilder().setName("commands").setDescription("Show all available commands"),
].map(c => c.toJSON());

const rest = new REST().setToken(token);

(async () => {
  console.log("Registering slash commands...");
  await rest.put(Routes.applicationCommands(clientId), { body: commands });
  console.log(`Done! Registered ${commands.length} commands.`);
})().catch(console.error);
