// Simple room-code multiplayer via PeerJS (a free public WebRTC signalling
// broker). The host picks a short room code; the guest just types that code to
// connect — no copy-pasting of SDP. Data still flows peer-to-peer.
//
// PeerJS is loaded from a CDN in index.html (window.Peer).

const PREFIX = "PNVS-"; // namespace the public broker so codes don't collide

export function createNet() {
  let peer = null;
  let conn = null;
  const handlers = { message: null, open: null, close: null, error: null };

  function wire(c) {
    conn = c;
    c.on("open", () => handlers.open && handlers.open());
    c.on("data", (d) => handlers.message && handlers.message(d));
    c.on("close", () => handlers.close && handlers.close());
  }

  return {
    on(ev, cb) { handlers[ev] = cb; },
    // HOST: create a room with the given short code; resolves when ready.
    host(code) {
      return new Promise((resolve, reject) => {
        if (!window.Peer) return reject(new Error("PeerJS 未加载（需要联网）"));
        peer = new window.Peer(PREFIX + code, { debug: 1 });
        peer.on("open", () => resolve(code));
        peer.on("connection", (c) => wire(c));
        peer.on("error", (e) => { if (handlers.error) handlers.error(e); reject(e); });
      });
    },
    // GUEST: connect to a room code.
    join(code) {
      return new Promise((resolve, reject) => {
        if (!window.Peer) return reject(new Error("PeerJS 未加载（需要联网）"));
        peer = new window.Peer({ debug: 1 }); // random id
        peer.on("open", () => {
          const c = peer.connect(PREFIX + code, { reliable: true });
          if (!c) return reject(new Error("无法连接该房间"));
          wire(c);
          resolve();
        });
        peer.on("error", (e) => { if (handlers.error) handlers.error(e); reject(e); });
      });
    },
    send(obj) { if (conn && conn.open) conn.send(obj); },
    isOpen() { return conn && conn.open; },
  };
}
