import SpotifyWebApi from "spotify-web-api-node";
import playlists from "../lg/spotify.json";

let spotifyApi: SpotifyWebApi | null = null;

const initSpotifyApi = () => {
  if (!spotifyApi) {
    if (!process.env.SPOTIFY_CLIENT_ID || !process.env.SPOTIFY_CLIENT_SECRET) {
      throw new Error(
        "Spotify credentials not found. Set SPOTIFY_CLIENT_ID and SPOTIFY_CLIENT_SECRET env variables."
      );
    }
    
    spotifyApi = new SpotifyWebApi({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
      redirectUri: process.env.SPOTIFY_REDIRECT_URI || "http://localhost:8888/callback",
    });
  }
  return spotifyApi;
};

/**
 * Authenticate with Spotify API using client credentials
 */
export const authenticateSpotify = async (): Promise<void> => {
  const api = initSpotifyApi();
  
  try {
    const data = await api.clientCredentialsGrant();
    api.setAccessToken(data.body.access_token);
    console.log("Spotify API authenticated");
  } catch (error) {
    console.error("Failed to authenticate with Spotify:", error);
    throw new Error("Failed to authenticate with Spotify API");
  }
};

/**
 * Search for a track on Spotify
 */
export const searchTrack = async (query: string): Promise<string | null> => {
  const api = initSpotifyApi();
  
  try {
    await authenticateSpotify();
    const result = await api.searchTracks(query, { limit: 1 });
    
    if (result.body.tracks?.items.length) {
      return result.body.tracks.items[0].uri;
    }
    return null;
  } catch (error) {
    console.error("Failed to search track:", error);
    return null;
  }
};

/**
 * Play a track or playlist on Spotify
 * @param keyword - Playlist keyword (mood/liked) or song name
 * @param random - Play random track from playlist
 * @param trackIndex - Specific track index to play
 */
export const playSpotify = async (
  keyword: string,
  random?: boolean,
  trackIndex?: number
): Promise<string> => {
  const api = initSpotifyApi();
  
  try {
    await authenticateSpotify();
    
    // Check if keyword is a predefined playlist
    const playlistId = playlists[keyword as keyof typeof playlists];
    
    if (playlistId) {
      // Play playlist
      const playOptions: any = {};
      
      if (playlistId === "collection:tracks") {
        // Play liked songs
        playOptions.context_uri = "spotify:user:spotify:playlist:collection";
      } else {
        playOptions.context_uri = `spotify:playlist:${playlistId}`;
      }
      
      // Handle random or specific track
      if (random) {
        // Get playlist tracks to select random
        const tracks = await api.getPlaylistTracks(playlistId, { limit: 50 });
        const totalTracks = tracks.body.total;
        const randomOffset = Math.floor(Math.random() * totalTracks);
        playOptions.offset = { position: randomOffset };
      } else if (trackIndex !== undefined) {
        playOptions.offset = { position: trackIndex };
      }
      
      await api.play(playOptions);
      
      let message = `Playing ${keyword} playlist`;
      if (random) message += " (random track)";
      if (trackIndex !== undefined) message += ` (track #${trackIndex})`;
      
      return message;
    } else {
      // Search for song and play it
      const trackUri = await searchTrack(keyword);
      
      if (!trackUri) {
        return `No track found for: ${keyword}`;
      }
      
      await api.play({
        uris: [trackUri],
      });
      
      return `Playing: ${keyword}`;
    }
  } catch (error) {
    console.error("Failed to play on Spotify:", error);
    return `Failed to play on Spotify: ${error instanceof Error ? error.message : String(error)}`;
  }
};

