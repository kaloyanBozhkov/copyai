declare module "lgtv2" {
  interface LGTVConfig {
    url: string;
    timeout?: number;
    reconnect?: boolean | number;
    keyFile?: string;
    wsOptions?: {
      rejectUnauthorized?: boolean;
      [key: string]: any;
    };
  }

  interface LGTV {
    on(event: "connect", callback: () => void): void;
    on(event: "error", callback: (error: Error) => void): void;
    on(event: "close", callback: () => void): void;
    on(event: "prompt", callback: () => void): void;
    on(event: "connecting", callback: (host: string) => void): void;

    request(
      uri: string,
      callback: (error: Error | null, response: any) => void
    ): void;
    request(
      uri: string,
      payload: any,
      callback: (error: Error | null, response: any) => void
    ): void;

    disconnect(): void;
    getSocket(
      callback: (error: Error | null, socket: any) => void
    ): void;
  }

  function lgtv(config: LGTVConfig): LGTV;

  export = lgtv;
}

