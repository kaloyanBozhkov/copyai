/* eslint-disable @typescript-eslint/no-explicit-any */
import http from "http";
import SpotifyWebApi from "spotify-web-api-node";
import { setApiKey } from "../../kitchen/grimoireSettings";

// In-memory access token cache (short-lived, no need to persist)
let cachedAccessToken: string | null = null;
let cacheExpiresAt = 0;

const makeApi = (): any => {
  const clientId = process.env.SPOTIFY_CLIENT_ID;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing SPOTIFY_CLIENT_ID or SPOTIFY_CLIENT_SECRET. Set them in Grimoire Settings."
    );
  }
  return new SpotifyWebApi({
    clientId,
    clientSecret,
    redirectUri: "http://127.0.0.1:8888/callback",
  });
};

const SCOPES = [
  "user-modify-playback-state",
  "user-read-playback-state",
  "playlist-read-private",
  "user-library-read",
];

const getAuthorizationUrlSpotify = (): string => {
  const api = makeApi();
  return api.createAuthorizeURL(SCOPES, "copyai-spotify-auth");
};

/**
 * Opens Spotify OAuth in the browser, starts a temporary server on :8888 to
 * catch the redirect, exchanges the code automatically, and saves the refresh
 * token to Grimoire Settings.
 */
export const authorizeSpotify = (openUrl: (url: string) => void): Promise<string> =>
  new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const url = new URL(req.url ?? "/", "http://127.0.0.1:8888");
      if (url.pathname !== "/callback") {
        res.end();
        return;
      }

      const code = url.searchParams.get("code");
      const error = url.searchParams.get("error");

      if (error || !code) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Spotify auth failed. You can close this tab.</h2>");
        server.close();
        reject(new Error(`Spotify auth error: ${error ?? "no code returned"}`));
        return;
      }

      try {
        await exchangeCodeForTokens(code);
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Spotify authorized! You can close this tab and return to Grimoire.</h2>");
        server.close();
        resolve("Spotify authorized! Refresh token saved to Grimoire Settings.");
      } catch (err) {
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end("<h2>Token exchange failed. Check Grimoire logs.</h2>");
        server.close();
        reject(err);
      }
    });

    server.listen(8888, "127.0.0.1", () => {
      openUrl(getAuthorizationUrlSpotify());
    });

    server.on("error", (err) => reject(err));

    // Safety timeout — close server after 5 minutes if user never completes auth
    setTimeout(() => {
      server.close();
      reject(new Error("Spotify auth timed out after 5 minutes"));
    }, 5 * 60 * 1000);
  });

export const exchangeCodeForTokens = async (code: string): Promise<void> => {
  const api = makeApi();
  const data = await api.authorizationCodeGrant(code);
  const { access_token, refresh_token, expires_in } = data.body;

  // Persist refresh token to Grimoire settings (shows up in UI)
  setApiKey("SPOTIFY_REFRESH_TOKEN", refresh_token);
  // Also apply immediately to current process
  process.env.SPOTIFY_REFRESH_TOKEN = refresh_token;

  // Cache access token in memory
  cachedAccessToken = access_token;
  cacheExpiresAt = Date.now() + expires_in * 1000 - 60000;
};

export const getAccessToken = async (): Promise<string> => {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < cacheExpiresAt) {
    return cachedAccessToken;
  }

  const refreshToken = process.env.SPOTIFY_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error(
      "No Spotify auth found. Run: spotify.authorize, open the URL, then spotify.code <code>"
    );
  }

  const api = makeApi();
  api.setRefreshToken(refreshToken);
  const data = await api.refreshAccessToken();
  const { access_token, expires_in } = data.body;

  cachedAccessToken = access_token;
  cacheExpiresAt = Date.now() + expires_in * 1000 - 60000;

  return access_token;
};
