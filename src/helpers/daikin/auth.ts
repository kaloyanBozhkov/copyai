import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";

const TOKEN_FILE = path.join(os.homedir(), ".copyai", "daikin-tokens.json");
const AUTH_BASE = "https://idp.onecta.daikineurope.com/v1/oidc";

interface TokenData {
  access_token: string;
  refresh_token: string;
  expires_at: number;
}

/**
 * Load stored tokens
 */
export const loadTokens = (): TokenData | null => {
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    return data;
  } catch (error) {
    return null;
  }
};

/**
 * Save tokens to disk
 */
export const saveTokens = (
  accessToken: string,
  refreshToken: string,
  expiresIn: number
): void => {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const data: TokenData = {
    access_token: accessToken,
    refresh_token: refreshToken,
    expires_at: Date.now() + expiresIn * 1000,
  };

  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
};

/**
 * Check if access token is expired
 */
export const isTokenExpired = (tokens: TokenData): boolean => {
  return Date.now() >= tokens.expires_at - 60000; // 1 min buffer
};

/**
 * Refresh access token using refresh token
 */
export const refreshAccessToken = async (): Promise<string> => {
  const tokens = loadTokens();
  if (!tokens) {
    throw new Error("No tokens found. Please authorize first.");
  }

  const clientId = process.env.DAIKIN_CLIENT_ID;
  const clientSecret = process.env.DAIKIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing DAIKIN_CLIENT_ID or DAIKIN_CLIENT_SECRET environment variables"
    );
  }

  try {
    const response = await axios.post(`${AUTH_BASE}/token`, null, {
      params: {
        grant_type: "refresh_token",
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: tokens.refresh_token,
      },
    });

    const { access_token, refresh_token, expires_in } = response.data;
    saveTokens(access_token, refresh_token, expires_in);

    return access_token;
  } catch (error: any) {
    throw new Error(
      `Failed to refresh token: ${error.response?.data?.error_description || error.message}`
    );
  }
};

/**
 * Get valid access token (refreshes if needed)
 */
export const getAccessToken = async (): Promise<string> => {
  const tokens = loadTokens();

  if (!tokens) {
    throw new Error(
      "No authorization found. Run: home.aircon_authorize to set up OAuth"
    );
  }

  if (isTokenExpired(tokens)) {
    console.log("Access token expired, refreshing...");
    return await refreshAccessToken();
  }

  return tokens.access_token;
};

/**
 * Generate authorization URL for manual OAuth flow
 */
export const getAuthorizationUrl = (): string => {
  const clientId = process.env.DAIKIN_CLIENT_ID;
  if (!clientId) {
    throw new Error("Missing DAIKIN_CLIENT_ID environment variable");
  }

  const redirectUri =
    process.env.DAIKIN_REDIRECT_URI || "http://localhost:3000/callback";
  const scope = encodeURIComponent("openid onecta:basic.integration");

  return `${AUTH_BASE}/authorize?response_type=code&client_id=${clientId}&redirect_uri=${encodeURIComponent(
    redirectUri
  )}&scope=${scope}`;
};

/**
 * Exchange authorization code for tokens
 */
export const exchangeCodeForTokens = async (code: string): Promise<void> => {
  const clientId = process.env.DAIKIN_CLIENT_ID;
  const clientSecret = process.env.DAIKIN_CLIENT_SECRET;
  const redirectUri =
    process.env.DAIKIN_REDIRECT_URI || "http://localhost:3000/callback";

  if (!clientId || !clientSecret) {
    throw new Error(
      "Missing DAIKIN_CLIENT_ID or DAIKIN_CLIENT_SECRET environment variables"
    );
  }

  try {
    const response = await axios.post(`${AUTH_BASE}/token`, null, {
      params: {
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: redirectUri,
      },
    });

    const { access_token, refresh_token, expires_in } = response.data;
    saveTokens(access_token, refresh_token, expires_in);

    console.log("✓ Authorization successful! Tokens saved.");
  } catch (error: any) {
    throw new Error(
      `Failed to exchange code: ${error.response?.data?.error_description || error.message}`
    );
  }
};

