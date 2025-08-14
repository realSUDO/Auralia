// utils/spotify.js
const SpotifyWebApi = require('spotify-web-api-node');
const { spotifyClientId, spotifyClientSecret } = require('../config.json');

const spotifyApi = new SpotifyWebApi({
  clientId: spotifyClientId,
  clientSecret: spotifyClientSecret
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

    // Ensure refresh interval is never negative
    const refreshInterval = Math.max(data.body.expires_in - 60, 1) * 1000;
    setTimeout(authorizeSpotify, refreshInterval);
  } catch (error) {
    spotifyReady = false;
    console.error('Error authorizing Spotify API:', error);
    setTimeout(authorizeSpotify, 30 * 1000);
  }
}



async function getSpotifyTracks(spotifyUrl) {
  if (!spotifyReady) throw new Error('Spotify API not authorized yet');

  const regex = /https?:\/\/open\.spotify\.com\/(track|album|playlist)\/([a-zA-Z0-9]+)/;
  const match = spotifyUrl.match(regex);
  if (!match) throw new Error('Invalid Spotify URL');
  const [, type, id] = match;

  if (type === 'track') {
    const { body } = await spotifyApi.getTrack(id);
    return [`${body.name} ${body.artists[0].name}`];
  } else if (type === 'album') {
    const { body } = await spotifyApi.getAlbum(id);
    return body.tracks.items.map(track => `${track.name} ${track.artists[0].name}`);
  } else if (type === 'playlist') {
    const { body } = await spotifyApi.getPlaylist(id);
    return body.tracks.items.map(item => `${item.track.name} ${item.track.artists[0].name}`);
  }

  return [];
}

module.exports = { authorizeSpotify, getSpotifyTracks, isSpotifyReady};

