const fs = require('fs');
const path = require('path');

// Load config from environment variables or config.json
let config;

if (process.env.DISCORD_TOKEN) {
  // Production: Use environment variables
  config = {
    token: process.env.DISCORD_TOKEN,
    prefix: process.env.PREFIX || '!',
    spotifyClientId: process.env.SPOTIFY_CLIENT_ID,
    spotifyClientSecret: process.env.SPOTIFY_CLIENT_SECRET
  };
} else {
  // Development: Use config.json
  const configPath = path.join(__dirname, 'config.json');
  if (fs.existsSync(configPath)) {
    config = require('./config.json');
  } else {
    console.error('Error: No config.json found and no environment variables set!');
    process.exit(1);
  }
}

module.exports = config;
