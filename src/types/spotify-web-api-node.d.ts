declare module "spotify-web-api-node" {
  export default class SpotifyWebApi {
    constructor(options?: {
      clientId?: string;
      clientSecret?: string;
      redirectUri?: string;
      accessToken?: string;
      refreshToken?: string;
    });

    setAccessToken(accessToken: string): void;
    setRefreshToken(refreshToken: string): void;
    
    clientCredentialsGrant(): Promise<{
      body: {
        access_token: string;
        token_type: string;
        expires_in: number;
      };
    }>;

    searchTracks(
      query: string,
      options?: { limit?: number; offset?: number; }
    ): Promise<{
      body: {
        tracks?: {
          items: Array<{
            uri: string;
            name: string;
            artists: Array<{ name: string }>;
          }>;
        };
      };
    }>;

    getPlaylistTracks(
      playlistId: string,
      options?: { limit?: number; offset?: number; }
    ): Promise<{
      body: {
        total: number;
        items: Array<any>;
      };
    }>;

    play(options?: {
      context_uri?: string;
      uris?: string[];
      offset?: { position: number };
    }): Promise<any>;
  }
}

