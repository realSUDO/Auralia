const YTDLP_EXTRA = [
  '--js-runtimes', 'node',
  '--remote-components', 'ejs:github',
];

function ytdlpArgs(args) {
  return [...args, ...YTDLP_EXTRA];
}

module.exports = { ytdlpArgs };
