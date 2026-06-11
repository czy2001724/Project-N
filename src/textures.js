import * as THREE from "three";

// Procedural canvas textures — no external image assets, so the project
// stays a zero-dependency static site, but surfaces get real detail
// (panel seams, rivets, hazard stripes, holo screens) instead of flat color.

function makeCanvas(size) {
  const c = document.createElement("canvas");
  c.width = size;
  c.height = size;
  return c;
}

function toTexture(canvas, { repeat = 1, srgb = true } = {}) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.anisotropy = 4;
  if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function grain(ctx, size, alpha) {
  for (let i = 0; i < size * size * 0.05; i += 1) {
    const x = Math.random() * size;
    const y = Math.random() * size;
    ctx.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * alpha})`;
    ctx.fillRect(x, y, 1, 1);
  }
}

// Tech wall panel: base metal, sub-panel seams, rivets, accent strip.
export function techPanel({ base = "#28313d", seam = "#141a22", accent = "#39b6ff" } = {}) {
  const S = 256;
  const c = makeCanvas(S);
  const x = c.getContext("2d");
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);

  // large panel division
  x.strokeStyle = seam;
  x.lineWidth = 6;
  x.strokeRect(3, 3, S - 6, S - 6);
  x.beginPath();
  x.moveTo(S / 2, 0); x.lineTo(S / 2, S);
  x.moveTo(0, S * 0.62); x.lineTo(S, S * 0.62);
  x.stroke();

  // inset sub-panels
  x.lineWidth = 2;
  x.strokeStyle = "rgba(255,255,255,0.05)";
  x.strokeRect(18, 18, S / 2 - 36, S * 0.62 - 36);
  x.strokeRect(S / 2 + 18, 18, S / 2 - 36, S * 0.62 - 36);

  // rivets
  x.fillStyle = "rgba(180,200,220,0.18)";
  for (const [rx, ry] of [[14, 14], [S - 14, 14], [14, S - 14], [S - 14, S - 14], [S / 2, 14], [S / 2, S - 14]]) {
    x.beginPath();
    x.arc(rx, ry, 3, 0, Math.PI * 2);
    x.fill();
  }

  // accent light strip along the lower seam
  x.fillStyle = accent;
  x.globalAlpha = 0.55;
  x.fillRect(8, S * 0.62 - 3, S - 16, 4);
  x.globalAlpha = 1;

  grain(x, S, 0.06);
  return toTexture(c, { repeat: 1 });
}

// Floor: dark tech tiles with a grid and small detail squares.
export function techFloor({ base = "#1b212b", line = "#2c3a47", accent = "#39b6ff" } = {}) {
  const S = 256;
  const c = makeCanvas(S);
  const x = c.getContext("2d");
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);

  x.strokeStyle = line;
  x.lineWidth = 3;
  x.strokeRect(0, 0, S, S);
  x.lineWidth = 1.5;
  x.beginPath();
  x.moveTo(S / 2, 0); x.lineTo(S / 2, S);
  x.moveTo(0, S / 2); x.lineTo(S, S / 2);
  x.stroke();

  // corner tech notches
  x.strokeStyle = "rgba(120,150,180,0.18)";
  x.lineWidth = 2;
  for (const [cx, cy] of [[18, 18], [S - 18, 18], [18, S - 18], [S - 18, S - 18]]) {
    x.strokeRect(cx - 8, cy - 8, 16, 16);
  }
  // a faint accent dash
  x.fillStyle = accent;
  x.globalAlpha = 0.25;
  x.fillRect(S / 2 - 20, S / 2 - 1.5, 40, 3);
  x.globalAlpha = 1;

  grain(x, S, 0.05);
  return toTexture(c, { repeat: 1 });
}

// Diagonal hazard stripes for door trims / crate tops.
export function hazardStripes(a = "#e0a93f", b = "#1c2128") {
  const S = 128;
  const c = makeCanvas(S);
  const x = c.getContext("2d");
  x.fillStyle = b;
  x.fillRect(0, 0, S, S);
  x.strokeStyle = a;
  x.lineWidth = 18;
  for (let i = -S; i < S * 2; i += 40) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i + S, S);
    x.stroke();
  }
  return toTexture(c, { repeat: 1 });
}

// Brushed metal for trims and weapon-station surfaces.
export function brushedMetal(base = "#3a4654") {
  const S = 256;
  const c = makeCanvas(S);
  const x = c.getContext("2d");
  x.fillStyle = base;
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 1400; i += 1) {
    const y = Math.random() * S;
    x.strokeStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.05})`;
    x.beginPath();
    x.moveTo(0, y);
    x.lineTo(S, y + (Math.random() - 0.5) * 4);
    x.stroke();
  }
  return toTexture(c, { repeat: 1 });
}

// Holographic screen / display (used as an emissive map): dark base with
// cyan UI lines and a heading. Returns a non-color (linear) texture.
export function holoScreen(title = "OPERATIONS", lines = 5, color = "#5fd0ff") {
  const W = 256;
  const H = 256;
  const c = makeCanvas(W);
  const x = c.getContext("2d");
  x.fillStyle = "#06121a";
  x.fillRect(0, 0, W, H);

  x.fillStyle = color;
  x.font = "bold 26px system-ui, sans-serif";
  x.fillText(title, 18, 40);
  x.fillRect(18, 52, W - 36, 2);

  x.globalAlpha = 0.85;
  for (let i = 0; i < lines; i += 1) {
    const y = 78 + i * 30;
    x.fillRect(20, y, 14, 14); // bullet
    x.fillRect(44, y + 4, 80 + Math.random() * 120, 6); // text bar
  }
  x.globalAlpha = 0.12;
  for (let y = 0; y < H; y += 4) x.fillRect(0, y, W, 1); // scanlines
  x.globalAlpha = 1;

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}
