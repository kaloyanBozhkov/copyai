# LG ThinQ Cloud Integration (Currently Unused)

This module implements the LG ThinQ v2 cloud API for controlling LG devices remotely.
It was built to enable turning on the TV via LG's cloud, but it turned out the TV
is only locally registered (not cloud-registered), so the cloud API returns no devices.

The WOL (Wake-on-LAN) approach in `src/helpers/lg/index.ts` is used instead.

## Files

- `auth.ts` — Full EMP OAuth login flow (username/password → token exchange)
- `api.ts` — Device discovery and cloud control commands
- `constants.ts` — API keys, gateway headers, EMP headers
- `index.ts` — Public exports

## How to Re-enable

If your TV is registered in LG's ThinQ cloud (shows up in the API), you can
re-enable these commands in `src/kitchen/recipes/execs.ts`:

### 1. Add imports

```typescript
import {
  setupThinQ,
  listAllDevices as listThinQDevices,
  clearDeviceCache as clearThinQDeviceCache,
} from "../../helpers/lg/thinq";
```

### 2. Add commands inside the `tv` subcategory

```typescript
// tv.thinq_setup — Opens a form to enter LG account credentials
thinq_setup: [
  async () => {
    const values = await showCommandFormWindow("LG ThinQ Setup", [
      { name: "email", label: "LG Account Email", type: "text", placeholder: "you@email.com" },
      { name: "password", label: "Password", type: "password", placeholder: "Your LG password" },
      {
        name: "country", label: "Country", type: "select", defaultValue: "BG",
        options: [
          { label: "Bulgaria", value: "BG" },
          { label: "United Kingdom", value: "GB" },
          { label: "United States", value: "US" },
          // ... add more as needed
        ],
      },
    ]);
    if (!values) return "ThinQ setup cancelled.";
    const { email, password, country } = values;
    const langMap: Record<string, string> = {
      GB: "en-GB", US: "en-US", DE: "de-DE", BG: "bg-BG",
      // ... add more as needed
    };
    const language = langMap[country] || `en-${country}`;
    return setupThinQ(email, password, country, language);
  },
],

// tv.thinq_devices — Lists all devices on the ThinQ account
thinq_devices: [async () => listThinQDevices()],

// tv.thinq_reset — Clears the cached TV device ID (forces re-discovery)
thinq_reset: [
  () => {
    clearThinQDeviceCache();
    return "ThinQ TV device cache cleared.";
  },
],
```

### 3. Token storage

Tokens are saved to `~/.copyai/lg-thinq-tokens.json`.
Cached TV device info is saved to `~/.copyai/lg-thinq-tv-device.json`.

## Auth Flow

1. Hash password with SHA-512
2. Pre-login to `{empSpxUri}/preLogin` to get encrypted password + signature
3. Login to `{empTermsUri}/emp/v2.0/account/session/{email}` with encrypted password
4. Get dynamic secret key from `{empSpxUri}/searchKey`
5. EMP OAuth authorize at `emp-oauth.lgecloud.com` to get auth code
6. Exchange code for access/refresh tokens at `{empOauthBaseUri}/oauth/1.0/oauth2/token`
7. Get user number from `{empOauthBaseUri}/users/profile`
