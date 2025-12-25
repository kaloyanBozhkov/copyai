declare module 'webtorrent' {
  export default class WebTorrent {
    add(
      torrentId: string,
      opts: { path: string },
      callback: (torrent: any) => void
    ): void;
    destroy(): void;
  }
}

