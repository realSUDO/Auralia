// utils/spotify.js
const SpotifyWebApi = require('spotify-web-api-node');
const https = require('https');
const config = require('../config');

const spotifyApi = new SpotifyWebApi({
  clientId: config.spotifyClientId,
  clientSecret: config.spotifyClientSecret
});

let spotifyReady = false; // ✅ GLOBAL readiness flag

function isSpotifyReady() {
	  return spotifyReady; // ✅ Check readiness status
}

async function authorizeSpotify() {
  try {
    const data = await spotifyApi.clientCredentialsGrant();
    spotifyApi.setAccessToken(data.body.access_token);
    spotifyReady = true;
    console.log('Spotify API authorized successfully');

    // Refresh before expiry - if token expires in less than 60s, refresh at 50% of remaining time
    const expiresIn = data.body.expires_in || 3600;
    const refreshInterval = expiresIn < 60 
      ? Math.max(Math.floor(expiresIn * 0.5), 1) * 1000
      : (expiresIn - 60) * 1000;
    setTimeout(authorizeSpotify, refreshInterval);
  } catch (error) {
    spotifyReady = false;
    console.error('Error authorizing Spotify API:', error);
    setTimeout(authorizeSpotify, 30 * 1000);
  }
}

/**
 * Scrape track metadata from Spotify's Open Graph title tag (no API key needed)
 * Title format: "Track - song and lyrics by Artist1, Artist2 | Spotify"
 */
function scrapeSpotifyTrack(url) {
  return new Promise((resolve, reject) => {
    https.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const match = data.match(/<title>([^<]+)<\/title>/);
        if (!match) return reject(new Error('No title tag found'));
        // "Lena Mera Naam - song and lyrics by Karma, Deep Kalsi | Spotify"
        const title = match[1];
        const m = title.match(/^(.+?) - song and lyrics by (.+?) \| Spotify$/i);
        if (!m) return reject(new Error(`Unexpected title format: ${title}`));
        resolve({ artist: m[2].split(',')[0].trim(), trackName: m[1].trim(), searchQuery: `${m[1].trim()} ${m[2].split(',')[0].trim()}` });
      });
    }).on('error', reject);
  });
}

async function getSpotifyTracks(spotifyUrl) {
  if (!spotifyReady) {
    // API not ready — try scraping for single tracks
    const type = spotifyUrl.match(/open\.spotify\.com\/(track|album|playlist)\//)?.[1];
    if (type === 'track') return [await scrapeSpotifyTrack(spotifyUrl)];
    throw new Error('Spotify API not authorized yet');
  }

  const regex = /https?:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/;
  const match = spotifyUrl.match(regex);
  if (!match) throw new Error('Invalid Spotify URL');
  const [, type, id] = match;

  const toTrackObj = (name, artists) => ({
    artist: artists[0].name,
    trackName: name,
    searchQuery: `${name} ${artists[0].name}`,
  });

  try {
    if (type === 'track') {
      const { body } = await spotifyApi.getTrack(id);
      return [toTrackObj(body.name, body.artists)];
    } else if (type === 'album') {
      const { body } = await spotifyApi.getAlbum(id);
      return body.tracks.items.map(t => toTrackObj(t.name, t.artists));
    } else if (type === 'playlist') {
      const { body } = await spotifyApi.getPlaylist(id);
      return body.tracks.items.filter(i => i.track).map(i => toTrackObj(i.track.name, i.track.artists));
    }
  } catch (err) {
    // API failed (e.g. premium required) — fallback to scraping for single tracks
    if (type === 'track') return [await scrapeSpotifyTrack(spotifyUrl)];
    throw err;
  }

  return [];
}

module.exports = { authorizeSpotify, getSpotifyTracks, isSpotifyReady};

