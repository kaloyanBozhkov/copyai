import SpotifyWebApi, { type PlayOptions } from "spotify-web-api-node";
import playlists from "../lg/spotify.json";
import {
  getAccessToken,
  authorizeSpotify,
  exchangeCodeForTokens,
} from "./auth";

export { authorizeSpotify, exchangeCodeForTokens };

const getApi = async () => {
  const clientId = process.env.SPOTIFY_CLIENT_ID!;
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!;
  const api = new SpotifyWebApi({ clientId, clientSecret });
  api.setAccessToken(await getAccessToken());
  return api;
};

type SpotifyClient = Awaited<ReturnType<typeof getApi>>;

const resolveDevice = async (
  api: SpotifyClient,
  deviceName?: string
): Promise<{ id: string | null; name: string | undefined }> => {
  const result = await api.getMyDevices();
  const devices = result.body.devices;

  if (deviceName) {
    // Match by exact ID or partial name
    const match = devices.find(
      (d) =>
        d.id === deviceName ||
        d.name?.toLowerCase().includes(deviceName.toLowerCase())
    );
    if (match) return { id: match.id, name: match.name };
  }

  // Fall back to currently active device
  const active = devices.find((d) => d.is_active);
  return { id: active?.id ?? null, name: active?.name ?? undefined };
};

/** Search user's own playlists by name (case-insensitive partial match). */
const findUserPlaylist = async (
  api: SpotifyClient,
  name: string
): Promise<{ id: string; name: string } | null> => {
  let offset = 0;
  const limit = 50;
  while (true) {
    const result = await api.getUserPlaylists({ limit, offset });
    const items = result.body.items;
    if (!items.length) return null;
    const match = items.find((p) =>
      p.name?.toLowerCase().includes(name.toLowerCase())
    );
    if (match) return { id: match.id, name: match.name };
    if (items.length < limit) return null;
    offset += limit;
  }
};

export const pauseSpotify = async (): Promise<string> => {
  try {
    const api = await getApi();
    await api.pause();
    return "Spotify paused";
  } catch (error) {
    return `Failed to pause Spotify: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
};

export const resumeSpotify = async (): Promise<string> => {
  try {
    const api = await getApi();
    await api.play();
    return "Spotify resumed";
  } catch (error) {
    return `Failed to resume Spotify: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
};

export const switchSpotifyDevice = async (keyword: string): Promise<string> => {
  try {
    const api = await getApi();
    const result = await api.getMyDevices();
    const devices = result.body.devices;

    const match = devices.find(
      (d) =>
        d.id === keyword ||
        d.name?.toLowerCase().includes(keyword.toLowerCase())
    );

    if (!match) {
      const names = devices.map((d) => d.name).join(", ");
      return `No device matching "${keyword}" found. Available: ${names || "none"}`;
    }

    await api.transferMyPlayback([match.id!], { play: true });
    return `Switched playback to ${match.name}`;
  } catch (error) {
    return `Failed to switch device: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
};

export const listSpotifyDevices = async (): Promise<string> => {
  try {
    const api = await getApi();
    const result = await api.getMyDevices();
    const devices = result.body.devices;
    if (!devices.length)
      return "No active Spotify devices found. Open Spotify on any device first.";
    return devices
      .map(
        (d) =>
          `${d.is_active ? "[active] " : ""}${d.name} (${d.type}) id:${d.id}`
      )
      .join("\n");
  } catch (error) {
    return `Failed to list devices: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
};

/**
 * Play a track or playlist on Spotify.
 * Resolution order:
 *   1. Predefined shortcuts (mood / liked) from lg/spotify.json
 *   2. User's own playlists — searched by name
 *   3. Track search — first result
 *
 * @param keyword  - Playlist name or song name
 * @param random   - Enable Spotify shuffle for playlists
 * @param trackIndex - Start at a specific track index (playlists only)
 * @param deviceName - Target device name or ID. Falls back to active device.
 */
export const playSpotify = async (
  keyword: string,
  random?: boolean,
  trackIndex?: number,
  deviceName?: string
): Promise<string> => {
  try {
    const api = await getApi();

    // Resolve device: prefer named target, fall back to active device
    const { id: deviceId, name: resolvedDeviceName } = await resolveDevice(api, deviceName);
    if (deviceName && !deviceId) {
      return `Device "${deviceName}" not found and no active device available. Open Spotify on any device first.`;
    }

    const deviceOpts = deviceId ? { device_id: deviceId } : {};
    const suffix = resolvedDeviceName ? ` on ${resolvedDeviceName}` : "";

    // ── 1. Predefined shortcuts ──────────────────────────────────────────
    const predefinedId = playlists[keyword.toLowerCase() as keyof typeof playlists];

    if (predefinedId) {
      if (predefinedId === "collection:tracks") {
        // Liked songs — fetch up to 50 and pick one
        const saved = await api.getMySavedTracks({ limit: 50 });
        const uris = saved.body.items.map((i) => i.track.uri);
        if (!uris.length) return "No liked songs found";
        const idx = random ? Math.floor(Math.random() * uris.length) : (trackIndex ?? 0);
        await api.play({ ...deviceOpts, uris: [uris[idx]] });
        return `Playing liked songs${suffix}`;
      }

      await api.setShuffle(!!random, deviceOpts);
      const playOpts: PlayOptions = { ...deviceOpts, context_uri: `spotify:playlist:${predefinedId}` };
      if (!random && trackIndex !== undefined) playOpts.offset = { position: trackIndex };
      await api.play(playOpts);
      return `Playing ${keyword} playlist${random ? " (shuffled)" : ""}${suffix}`;
    }

    // ── 2. User's own playlists ──────────────────────────────────────────
    const userPlaylist = await findUserPlaylist(api, keyword);

    if (userPlaylist) {
      await api.setShuffle(!!random, deviceOpts);
      const playOpts: PlayOptions = { ...deviceOpts, context_uri: `spotify:playlist:${userPlaylist.id}` };
      if (!random && trackIndex !== undefined) playOpts.offset = { position: trackIndex };
      await api.play(playOpts);
      return `Playing "${userPlaylist.name}" playlist${random ? " (shuffled)" : ""}${suffix}`;
    }

    // ── 3. Track search ──────────────────────────────────────────────────
    const search = await api.searchTracks(keyword, { limit: 1 });
    const track = search.body.tracks?.items[0];
    if (!track) return `No track or playlist found for: ${keyword}`;

    // Play within album context so Spotify continues with related tracks after
    if (track.album?.uri) {
      await api.play({
        ...deviceOpts,
        context_uri: track.album.uri,
        offset: { uri: track.uri },
      });
    } else {
      await api.play({ ...deviceOpts, uris: [track.uri] });
    }
    return `Playing "${track.name}" by ${track.artists.map((a) => a.name).join(", ")}${suffix}`;
  } catch (error) {
    return `Failed to play on Spotify: ${
      error instanceof Error ? error.message : String(error)
    }`;
  }
};
