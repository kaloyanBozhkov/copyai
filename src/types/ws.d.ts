declare module "ws" {
  import { EventEmitter } from "events";

  export type RawData = Buffer | ArrayBuffer | Buffer[];

  interface WebSocketOptions {
    rejectUnauthorized?: boolean;
    handshakeTimeout?: number;
  }

  class WebSocket extends EventEmitter {
    constructor(url: string, options?: WebSocketOptions);
    send(data: string | Buffer): void;
    close(): void;
    on(event: "open", listener: () => void): this;
    on(event: "message", listener: (data: RawData) => void): this;
    on(event: "error", listener: (err: Error) => void): this;
    on(event: "close", listener: () => void): this;
  }

  export default WebSocket;
  export { WebSocket, RawData };
}
