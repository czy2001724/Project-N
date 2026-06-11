// Serverless WebRTC peer-to-peer for the 1v1 mode. Signalling is done by hand:
// the host generates an "offer code", the guest pastes it and returns an
// "answer code", the host pastes that back. Works on a LAN with no server, and
// over the internet via a public STUN server (for most NATs). One reliable,
// ordered DataChannel carries the game state.

export function createNet() {
  let pc = null;
  let dc = null;
  const handlers = { message: null, open: null, close: null };
  const config = { iceServers: [{ urls: "stun:stun.l.google.com:19302" }] };

  function waitIce() {
    return new Promise((resolve) => {
      if (pc.iceGatheringState === "complete") return resolve();
      const done = () => { pc.removeEventListener("icegatheringstatechange", check); resolve(); };
      const check = () => { if (pc.iceGatheringState === "complete") done(); };
      pc.addEventListener("icegatheringstatechange", check);
      setTimeout(resolve, 2500); // fall back to whatever candidates we have
    });
  }
  function wireChannel() {
    dc.onopen = () => handlers.open && handlers.open();
    dc.onclose = () => handlers.close && handlers.close();
    dc.onmessage = (e) => { if (handlers.message) { try { handlers.message(JSON.parse(e.data)); } catch (_) {} } };
  }
  function setup() {
    pc = new RTCPeerConnection(config);
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === "failed" || pc.connectionState === "disconnected") handlers.close && handlers.close();
    };
  }
  const enc = (sdp) => btoa(unescape(encodeURIComponent(JSON.stringify(sdp))));
  const dec = (code) => JSON.parse(decodeURIComponent(escape(atob(code.trim()))));

  return {
    on(ev, cb) { handlers[ev] = cb; },
    // HOST: create the offer code to send to the friend.
    async host() {
      setup();
      dc = pc.createDataChannel("game");
      wireChannel();
      await pc.setLocalDescription(await pc.createOffer());
      await waitIce();
      return enc(pc.localDescription);
    },
    // HOST: apply the friend's answer code -> connected.
    async accept(answerCode) {
      await pc.setRemoteDescription(dec(answerCode));
    },
    // GUEST: paste the host's offer code, get back the answer code to send.
    async join(offerCode) {
      setup();
      pc.ondatachannel = (e) => { dc = e.channel; wireChannel(); };
      await pc.setRemoteDescription(dec(offerCode));
      await pc.setLocalDescription(await pc.createAnswer());
      await waitIce();
      return enc(pc.localDescription);
    },
    send(obj) { if (dc && dc.readyState === "open") dc.send(JSON.stringify(obj)); },
    isOpen() { return dc && dc.readyState === "open"; },
  };
}
