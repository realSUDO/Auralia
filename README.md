# Auralia - Discord Music Bot

A feature-rich Discord music bot with YouTube and Spotify support.

## Features
- Play music from YouTube and Spotify
- Queue management with pagination
- Loop mode
- Previous/Next track navigation
- Interactive player UI with buttons
- Auto-leave when alone in voice channel
- Progress bar with auto-updates

## Deployment on a VPS/VM

### Prerequisites
- Ubuntu 24.04 VM (1GB RAM minimum)
- Node.js 20, ffmpeg, docker.io, pipx

### Setup

1. **Swap (required on 1GB VM)**
   ```bash
   sudo fallocate -l 1G /swapfile && sudo chmod 600 /swapfile
   sudo mkswap /swapfile && sudo swapon /swapfile
   echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
   ```

2. **Install dependencies**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs ffmpeg docker.io
   sudo systemctl enable --now docker
   sudo apt install -y pipx && pipx install yt-dlp && pipx ensurepath
   ```

3. **YouTube bot detection fix (required for VPS IPs)**
   ```bash
   # Start PO Token provider
   sudo docker run -d --name bgutil-pot -p 4416:4416 --restart always jim60105/bgutil-pot
   # Install yt-dlp plugin
   pip3 install --break-system-packages bgutil-ytdlp-pot-provider
   ```

4. **Clone and configure**
   ```bash
   git clone https://github.com/realSUDO/Auralia.git && cd Auralia
   npm install
   cp config.json.example config.json && nano config.json
   ```

5. **Run with PM2**
   ```bash
   sudo npm install -g pm2
   pm2 start index.js --name auralia
   pm2 save && pm2 startup
   ```

### config.json fields
| Key | Where to get |
|-----|-------------|
| `token` | [Discord Developer Portal](https://discord.com/developers/applications) → Bot → Token |
| `clientId` | Discord Developer Portal → General Information → Application ID |
| `lastfmApiKey` | [last.fm/api](https://www.last.fm/api/account/create) |
| `spotifyClientId` / `spotifyClientSecret` | [Spotify Dashboard](https://developer.spotify.com/dashboard) |

## Commands

### Playback
- `!play <query>` - Play a song
- `!pause` - Pause/resume
- `!skip` / `!next` - Skip to next song
- `!previous` / `!prev` - Play previous song
- `!loop` - Toggle loop mode
- `!stop` - Stop and clear queue

### Queue
- `!queue` / `!q` - Show queue
- `!clear` - Clear upcoming songs
- `!shuffle` - Shuffle queue
- `!replay` - Replay current song
- `!replayq` - Replay last queue

### Voice
- `!join` - Join voice channel
- `!leave` - Leave voice channel

### Info
- `!ping` - Check latency
- `!commands` - Show all commands

## License
ISC
