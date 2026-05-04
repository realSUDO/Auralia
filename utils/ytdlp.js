const path = require('path');

const YTDLP_EXTRA = [
  '--cookies', path.join(require('os').homedir(), 'yt-cookies.txt'),
  '--js-runtimes', 'node',
  '--remote-components', 'ejs:github',
];

function ytdlpArgs(args) {
  return [...args, ...YTDLP_EXTRA];
}

module.exports = { ytdlpArgs };
