/// <reference types="spotify-api" />

declare module "spotify-web-api-node" {
  interface Credentials {
    clientId?: string;
    clientSecret?: string;
    redirectUri?: string;
    accessToken?: string;
    refreshToken?: string;
  }

  interface Response<T> {
    body: T;
    headers: Record<string, string>;
    statusCode: number;
  }

  interface PaginationOptions {
    limit?: number;
    offset?: number;
  }

  interface DeviceOptions {
    device_id?: string;
  }

  export interface PlayOptions extends DeviceOptions {
    context_uri?: string;
    uris?: string[];
    offset?: { position: number } | { uri: string };
    position_ms?: number;
  }

  export default class SpotifyWebApi {
    constructor(credentials?: Credentials);

    setAccessToken(accessToken: string): void;
    setRefreshToken(refreshToken: string): void;
    getAccessToken(): string | undefined;
    getRefreshToken(): string | undefined;

    createAuthorizeURL(scopes: string[], state: string): string;

    authorizationCodeGrant(
      code: string
    ): Promise<Response<{ access_token: string; refresh_token: string; expires_in: number }>>;

    refreshAccessToken(): Promise<
      Response<{ access_token: string; expires_in: number }>
    >;

    clientCredentialsGrant(): Promise<
      Response<{ access_token: string; token_type: string; expires_in: number }>
    >;

    getMyDevices(): Promise<Response<SpotifyApi.UserDevicesResponse>>;

    transferMyPlayback(
      deviceIds: string[],
      options?: { play?: boolean }
    ): Promise<Response<void>>;

    play(options?: PlayOptions): Promise<Response<void>>;
    pause(options?: DeviceOptions): Promise<Response<void>>;
    setShuffle(state: boolean, options?: DeviceOptions): Promise<Response<void>>;

    searchTracks(
      query: string,
      options?: PaginationOptions
    ): Promise<Response<SpotifyApi.SearchResponse>>;

    getMySavedTracks(
      options?: PaginationOptions
    ): Promise<Response<SpotifyApi.UsersSavedTracksResponse>>;

    getUserPlaylists(
      options?: PaginationOptions
    ): Promise<Response<SpotifyApi.ListOfUsersPlaylistsResponse>>;

    getPlaylistTracks(
      playlistId: string,
      options?: PaginationOptions
    ): Promise<Response<SpotifyApi.PlaylistTrackResponse>>;
  }
}
