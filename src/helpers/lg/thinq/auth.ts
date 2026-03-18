/* eslint-disable @typescript-eslint/no-explicit-any */
import crypto from "crypto";
import axios from "axios";
import fs from "fs";
import path from "path";
import os from "os";
import {
  GATEWAY_URL,
  GATEWAY_HEADERS,
  EMP_HEADERS,
  APPLICATION_KEY,
  CLIENT_ID,
  OAUTH_CLIENT_KEY,
  OAUTH_SECRET_KEY,
  SVC_CODE,
} from "./constants";

const TOKEN_FILE = path.join(os.homedir(), ".copyai", "lg-thinq-tokens.json");

interface GatewayInfo {
  empUri: string;
  empSpxUri: string;
  empOauthBaseUri: string;
  loginBaseUrl: string;
  thinq1Uri: string;
  thinq2Uri: string;
  countryCode: string;
  languageCode: string;
}

interface StoredAuth {
  accessToken: string;
  refreshToken: string;
  userNumber: string;
  expiresAt: number;
  country: string;
  language: string;
  gateway: GatewayInfo;
}

let authCache: StoredAuth | null = null;

const ensureDir = (): void => {
  const dir = path.dirname(TOKEN_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
};

export const loadStoredAuth = (): StoredAuth | null => {
  if (authCache) return authCache;
  try {
    if (!fs.existsSync(TOKEN_FILE)) return null;
    const data = JSON.parse(fs.readFileSync(TOKEN_FILE, "utf8"));
    authCache = data;
    return data;
  } catch {
    return null;
  }
};

const saveAuth = (data: StoredAuth): void => {
  ensureDir();
  fs.writeFileSync(TOKEN_FILE, JSON.stringify(data, null, 2));
  authCache = data;
};

export const hasTokens = (): boolean => loadStoredAuth() !== null;

const hmacSign = (message: string, secret: string): string =>
  crypto.createHmac("sha1", Buffer.from(secret)).update(message).digest("base64");

/**
 * Fetch gateway URLs from LG
 */
const getGateway = async (country: string, language: string): Promise<GatewayInfo> => {
  const msgId = crypto.randomUUID().replace(/-/g, "").substring(0, 22);

  const response = await axios.get(GATEWAY_URL, {
    headers: {
      ...GATEWAY_HEADERS,
      "x-country-code": country,
      "x-language-code": language,
      "x-message-id": msgId,
    },
  });

  const r = response.data?.result;
  if (!r) throw new Error("Failed to get gateway info from LG");

  return {
    empUri: r.empTermsUri || r.empUri,
    empSpxUri: r.empSpxUri,
    empOauthBaseUri: r.uris?.empOauthBaseUri || `https://${country.toLowerCase()}.lgeapi.com`,
    loginBaseUrl: r.empSpxUri + "/",
    thinq1Uri: r.thinq1Uri,
    thinq2Uri: r.thinq2Uri,
    countryCode: country,
    languageCode: language,
  };
};

/**
 * Login with username/password via EMP (same flow as homebridge-lg-thinq).
 * No browser needed.
 */
export const setupThinQ = async (
  username: string,
  password: string,
  country: string = "GB",
  language: string = "en-GB"
): Promise<string> => {
  console.log("[ThinQ] Setup with user:", username, "country:", country, "password length:", password.length);
  console.log("[ThinQ] Fetching gateway...");
  const gateway = await getGateway(country, language);
  console.log("[ThinQ] Gateway OK");

  // Step 1: Hash password
  const hashedPassword = crypto.createHash("sha512").update(password).digest("hex");

  // Step 2: Pre-login to get encrypted password
  const empHeaders = {
    ...EMP_HEADERS,
    "X-Device-Country": country,
    "X-Device-Language": language,
  };

  const preLoginData = new URLSearchParams({
    user_auth2: hashedPassword,
    log_param: `login request / user_id : ${username} / third_party : null / svc_list : SVC202,SVC710 / 3rd_service : `,
  });

  console.log("[ThinQ] Pre-login...");
  const preLogin = await axios
    .post(`${gateway.loginBaseUrl}preLogin`, preLoginData.toString(), { headers: empHeaders, timeout: 15000 })
    .then((res) => res.data);
  console.log("[ThinQ] Pre-login response keys:", Object.keys(preLogin).join(", "));

  // Step 3: EMP account session
  const sessionHeaders = {
    ...empHeaders,
    "X-Signature": preLogin.signature,
    "X-Timestamp": preLogin.tStamp,
  };

  const sessionData = new URLSearchParams({
    user_auth2: preLogin.encrypted_pw,
    password_hash_prameter_flag: "Y",
    svc_list: "SVC202,SVC710",
  });

  const loginUrl = `${gateway.empUri}/emp/v2.0/account/session/${encodeURIComponent(username)}`;
  console.log("[ThinQ] Logging in to:", loginUrl);
  const account = await axios
    .post(loginUrl, sessionData.toString(), { headers: sessionHeaders, timeout: 15000 })
    .then((res) => {
      console.log("[ThinQ] Login response status:", res.status);
      return res.data.account;
    })
    .catch((err) => {
      const code = err.response?.status || err.code || "unknown";
      const data = err.response?.data;
      console.error("[ThinQ] Login failed:", code, JSON.stringify(data));
      const msg = data?.error?.message || data?.message || err.message;
      throw new Error(`LG login failed (${code}): ${msg}`);
    });
  console.log("[ThinQ] Login OK");

  // Step 4: Get secret key for signature
  console.log("[ThinQ] Getting secret key...");
  const secretKeyUrl = `${gateway.loginBaseUrl}searchKey?key_name=OAUTH_SECRETKEY&sever_type=OP`;
  const secretKey = await axios.get(secretKeyUrl, { timeout: 15000 }).then((res) => res.data.returnData);
  console.log("[ThinQ] Secret key OK");

  // Step 5: EMP OAuth authorize
  const timestamp = new Date().toUTCString();
  const empOauthParams = new URLSearchParams({
    account_type: account.userIDType,
    client_id: CLIENT_ID,
    country_code: account.country,
    redirect_uri: "lgaccount.lgsmartthinq:/",
    response_type: "code",
    state: "12345",
    username: account.userID,
  });

  const empOauthUrl = `https://emp-oauth.lgecloud.com/emp/oauth2/authorize/empsession?${empOauthParams.toString()}`;
  const empOauthPath = new URL(empOauthUrl);
  const signMessage = `${empOauthPath.pathname}${empOauthPath.search}\n${timestamp}`;
  const signature = hmacSign(signMessage, secretKey);

  const empOauthHeaders = {
    "lgemp-x-app-key": OAUTH_CLIENT_KEY,
    "lgemp-x-date": timestamp,
    "lgemp-x-session-key": account.loginSessionID,
    "lgemp-x-signature": signature,
    Accept: "application/json",
    "X-Device-Type": "M01",
    "X-Device-Platform": "ADR",
    "Content-Type": "application/x-www-form-urlencoded",
  };

  console.log("[ThinQ] EMP OAuth authorize...");
  const empOauthRes = await axios.get(empOauthUrl, {
    headers: empOauthHeaders,
    maxRedirects: 0,
    timeout: 15000,
    validateStatus: (s) => s === 302 || s === 200,
  });
  console.log("[ThinQ] EMP OAuth OK");

  // Extract auth code from redirect_uri in response
  const authorizeData = empOauthRes.data;
  if (authorizeData.status !== 1) {
    throw new Error(`EMP OAuth failed: ${authorizeData.message || JSON.stringify(authorizeData)}`);
  }

  const redirectUri = new URL(authorizeData.redirect_uri);
  const authCode = redirectUri.searchParams.get("code");
  const oauth2BackendUrl = redirectUri.searchParams.get("oauth2_backend_url") || gateway.empOauthBaseUri;
  if (!authCode) throw new Error("No auth code in EMP OAuth response");

  // Step 6: Exchange code for access token
  const tokenTimestamp = new Date().toUTCString();
  const tokenQueryData = new URLSearchParams({
    code: authCode,
    grant_type: "authorization_code",
    redirect_uri: "lgaccount.lgsmartthinq:/",
  });

  const requestUrl = `/oauth/1.0/oauth2/token?${tokenQueryData.toString()}`;
  const tokenSignature = hmacSign(`${requestUrl}\n${tokenTimestamp}`, OAUTH_SECRET_KEY);

  const tokenUrl = `${oauth2BackendUrl}oauth/1.0/oauth2/token`;

  console.log("[ThinQ] Exchanging code for token...");
  const tokenRes = await axios.post(tokenUrl, tokenQueryData.toString(), {
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      "x-lge-app-os": "ADR",
      "x-lge-appkey": CLIENT_ID,
      "x-lge-oauth-signature": tokenSignature,
      "x-lge-oauth-date": tokenTimestamp,
      Accept: "application/json",
    },
    timeout: 15000,
  });

  const { access_token, refresh_token, expires_in } = tokenRes.data;
  if (!access_token) throw new Error("Token exchange failed");

  // Step 7: Get user number
  const userNumber = await getUserNumber(access_token, gateway);

  const authData: StoredAuth = {
    accessToken: access_token,
    refreshToken: refresh_token,
    userNumber,
    expiresAt: Date.now() + (expires_in || 3600) * 1000,
    country,
    language,
    gateway,
  };

  saveAuth(authData);
  return "ThinQ authorized! Credentials saved. You can now use tv.on to turn on the TV via cloud.";
};

/**
 * Get user number from profile
 */
const getUserNumber = async (
  accessToken: string,
  gateway: GatewayInfo
): Promise<string> => {
  const timestamp = new Date().toUTCString();
  const reqPath = "/users/profile";
  const sig = hmacSign(`${reqPath}\n${timestamp}`, OAUTH_SECRET_KEY);

  const profileUrl = `${gateway.empOauthBaseUri}/users/profile`;
  console.log("[ThinQ] Getting user profile from:", profileUrl);

  try {
    const res = await axios.get(profileUrl, {
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessToken}`,
        "X-Lge-Svccode": "SVC202",
        "X-Application-Key": APPLICATION_KEY,
        "lgemp-x-app-key": CLIENT_ID,
        "X-Device-Type": "M01",
        "X-Device-Platform": "ADR",
        "x-lge-oauth-date": timestamp,
        "x-lge-oauth-signature": sig,
      },
      timeout: 15000,
    });
    const userNo = res.data?.account?.userNo;
    console.log("[ThinQ] Got user number:", userNo ? "yes" : "no");
    if (!userNo) {
      console.error("[ThinQ] Profile response:", JSON.stringify(res.data));
      throw new Error("No userNo in profile response");
    }
    return userNo;
  } catch (err: any) {
    console.error("[ThinQ] getUserNumber failed:", err.response?.status, JSON.stringify(err.response?.data || err.message));
    throw new Error(`Failed to get user profile: ${err.response?.status || err.message}`);
  }
};

/**
 * Refresh access token
 */
const refreshAccessToken = async (): Promise<string> => {
  const stored = loadStoredAuth();
  if (!stored) throw new Error("No ThinQ auth. Run tv.thinq_setup first.");

  const secretKeyUrl = `${stored.gateway.loginBaseUrl}searchKey?key_name=OAUTH_SECRETKEY&sever_type=OP`;
  const secretKey = await axios.get(secretKeyUrl).then((res) => res.data.returnData);

  const timestamp = new Date().toUTCString();
  const tokenPath = "/oauth/1.0/oauth2/token";
  const sig = hmacSign(`${tokenPath}\n${timestamp}`, secretKey);

  const res = await axios.post(
    `${stored.gateway.empOauthBaseUri}${tokenPath}`,
    new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: stored.refreshToken,
    }).toString(),
    {
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "x-lge-appkey": CLIENT_ID,
        "x-lge-oauth-signature": sig,
        "x-lge-oauth-date": timestamp,
        Accept: "application/json",
      },
    }
  );

  const { access_token, expires_in } = res.data;
  if (!access_token) throw new Error("Token refresh failed");

  stored.accessToken = access_token;
  stored.expiresAt = Date.now() + (expires_in || 3600) * 1000;
  saveAuth(stored);

  return access_token;
};

/**
 * Get valid access token + metadata
 */
export const getAccessToken = async (): Promise<{
  token: string;
  userNumber: string;
  gateway: GatewayInfo;
}> => {
  const stored = loadStoredAuth();
  if (!stored) throw new Error("No ThinQ auth. Run tv.thinq_setup first.");

  let token = stored.accessToken;
  if (Date.now() >= stored.expiresAt - 60000) {
    token = await refreshAccessToken();
  }

  return {
    token,
    userNumber: stored.userNumber,
    gateway: stored.gateway,
  };
};

export const getStoredRegion = (): { country: string; language: string } | null => {
  const stored = loadStoredAuth();
  if (!stored) return null;
  return { country: stored.country, language: stored.language };
};
