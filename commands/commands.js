const { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } = require("discord.js");

const PAGES = [
  {
    title: "🎵 Auralia Commands (1/3) — Playback & Queue",
    fields: [
      {
        name: "🎶 Playback",
        value:
          "`!play <query>` — Play from YouTube/Spotify\n" +
          "`!pause` — Pause/resume\n" +
          "`!skip` / `!next` — Skip to next\n" +
          "`!previous` / `!prev` — Play previous\n" +
          "`!loop` — Toggle loop\n" +
          "`!stop` — Stop & clear queue\n" +
          "`!replay` — Replay current song",
      },
      {
        name: "📜 Queue",
        value:
          "`!queue` / `!q` — Show queue\n" +
          "`!clear` — Clear upcoming songs\n" +
          "`!shuffle` — Shuffle queue\n" +
          "`!replayq` — Replay last queue",
      },
    ],
  },
  {
    title: "🎵 Auralia Commands (2/3) — Mood & Autoplay",
    fields: [
      {
        name: "🎭 Mood",
        value:
          "`!mood <type> [strict]` — Play a mood playlist\n" +
          "  Types: `happy` `sad` `energetic` `hiphop` `lofi` `metal`\n" +
          "`!lofiradio` — Start lofi radio livestream\n" +
          "`!moodskip` — Skip song + shift to new mood",
      },
      {
        name: "🔁 Autoplay & Drift",
        value:
          "`!autoplay` — Enable autoplay\n" +
          "`!autoplay off` — Disable autoplay\n" +
          "`!drift on/off` — Toggle genre drift every 4 songs (default: off)\n" +
          "  Autoplay uses Last.fm → YouTube RD mix → mood fallback",
      },
    ],
  },
  {
    title: "🎵 Auralia Commands (3/3) — Audio, Voice & Info",
    fields: [
      {
        name: "🔊 Audio",
        value: "`!volume <0-100>` — Set volume (or use player buttons)",
      },
      {
        name: "🔧 Voice",
        value:
          "`!join` — Join your voice channel\n" +
          "`!leave` — Leave voice channel",
      },
      {
        name: "ℹ️ Info",
        value:
          "`!ping` — Check latency\n" +
          "`!commands` — Show this help",
      },
    ],
    footer: "All commands also available as slash commands (/play, /mood, /autoplay, etc.)",
  },
];

function buildPage(page) {
  const p = PAGES[page - 1];
  const embed = new EmbedBuilder().setTitle(p.title).setColor(0x00ffcc);
  for (const f of p.fields) embed.addFields({ name: f.name, value: f.value, inline: false });
  if (p.footer) embed.setFooter({ text: p.footer });

  const row = new ActionRowBuilder().addComponents(
    new ButtonBuilder().setCustomId(`cmd_prev_${page}`).setLabel("◀ Previous").setStyle(ButtonStyle.Secondary).setDisabled(page === 1),
    new ButtonBuilder().setCustomId(`cmd_next_${page}`).setLabel("Next ▶").setStyle(ButtonStyle.Secondary).setDisabled(page === PAGES.length)
  );

  return { embeds: [embed], components: [row] };
}

module.exports = {
  name: "commands",
  description: "Show all available commands",
  execute(message) {
    message.channel.send(buildPage(1)).catch(() => {});
  },
  async slashExecute(interaction) {
    await interaction.reply({ ...buildPage(1), flags: 64 });
  },
  buildPage, // exported for interactionCreate handler
};
