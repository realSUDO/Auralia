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

## Deployment on Render

### Prerequisites
1. Discord Bot Token
2. Spotify Client ID and Secret

### Steps

1. **Fork/Clone this repository**

2. **Create a new Web Service on Render**
   - Connect your GitHub repository
   - Select "Node" as the environment

3. **Configure Build & Start Commands**
   - Build Command: `npm install`
   - Start Command: `npm start`

4. **Add Environment Variables**
   ```
   DISCORD_TOKEN=your_discord_bot_token
   PREFIX=!
   SPOTIFY_CLIENT_ID=your_spotify_client_id
   SPOTIFY_CLIENT_SECRET=your_spotify_client_secret
   ```

5. **Install System Dependencies**
   Add this to your Render service settings under "Build Command":
   ```bash
   apt-get update && apt-get install -y ffmpeg python3 && npm install
   ```

6. **Deploy**
   - Click "Create Web Service"
   - Wait for deployment to complete

### Required System Packages
- `ffmpeg` - For audio processing
- `python3` - Required by yt-dlp
- `yt-dlp` - Installed via npm (youtube-dl-exec)

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
