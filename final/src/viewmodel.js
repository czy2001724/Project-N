// 2D first-person view-model. Each weapon is drawn as a flat, anime / cel
// style image on a canvas (bold outline + flat fill + one shadow tone), shown
// in a screen-anchored layer at the bottom. Recoil / reload / switch / katana
// draw-slash are CSS transforms applied to the layer. No code-built 3D models.

const OUT = "#0e131b";
const SKIN = "#eab88e";
const SKIN_SH = "#cf9670";
const METAL = "#3b4350";
const METAL_SH = "#272d39";
const POLY = "#2c313b";
const BLADE = "#e2eaf2";
const BLADE_SH = "#aebccb";
const ACCENT = "#49d0ff";
const ACCENT_D = "#2aa6e0";

function ctxOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function poly(ctx, pts, fill, lw = 7, stroke = OUT) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length; i += 1) ctx.lineTo(pts[i][0], pts[i][1]);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineJoin = "round"; ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

function rrect(ctx, x, y, w, h, r, fill, lw = 7, stroke = OUT) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (lw) { ctx.lineJoin = "round"; ctx.lineWidth = lw; ctx.strokeStyle = stroke; ctx.stroke(); }
}

// A stylized hand gripping around a point (fingers as rounded bars).
function hand(ctx, x, y, scale = 1, flip = 1) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(flip * scale, scale);
  // palm
  rrect(ctx, -34, -6, 64, 60, 18, SKIN);
  // shadow side
  ctx.save();
  ctx.beginPath();
  rrect(ctx, -34, 26, 64, 28, 14, SKIN_SH, 0);
  ctx.restore();
  // four fingers wrapping over the top
  for (let i = 0; i < 4; i += 1) {
    rrect(ctx, -32 + i * 16, -30, 14, 34, 7, SKIN);
  }
  // thumb
  rrect(ctx, 22, 6, 18, 34, 9, SKIN);
  ctx.restore();
}

function drawRifle(ctx, W, H) {
  ctx.save();
  ctx.translate(W * 0.52, H * 0.62);
  ctx.rotate(-0.32);
  // stock + receiver
  rrect(ctx, 120, -28, 150, 70, 16, METAL);
  rrect(ctx, -180, -34, 320, 78, 18, METAL);
  rrect(ctx, -180, 10, 320, 34, 12, METAL_SH, 0);
  // handguard + barrel
  rrect(ctx, -360, -22, 200, 50, 14, POLY);
  rrect(ctx, -470, -12, 130, 26, 10, METAL);
  // sight + accent
  rrect(ctx, -40, -64, 60, 26, 8, POLY);
  rrect(ctx, -150, -20, 250, 8, 4, ACCENT, 0);
  // magazine
  ctx.save();
  ctx.translate(-70, 60);
  ctx.rotate(0.18);
  rrect(ctx, -28, -10, 56, 150, 14, METAL);
  ctx.restore();
  // pistol grip
  ctx.save();
  ctx.translate(40, 70);
  ctx.rotate(0.4);
  rrect(ctx, -22, -10, 48, 120, 16, POLY);
  ctx.restore();
  ctx.restore();

  // hands
  hand(ctx, W * 0.6, H * 0.78, 1.15, 1); // right on grip
  hand(ctx, W * 0.3, H * 0.66, 1.0, -1); // left on handguard
}

function drawPistol(ctx, W, H) {
  ctx.save();
  ctx.translate(W * 0.5, H * 0.58);
  ctx.rotate(-0.18);
  rrect(ctx, -150, -34, 250, 64, 16, METAL); // slide
  rrect(ctx, -150, 6, 250, 24, 10, METAL_SH, 0);
  rrect(ctx, -190, -22, 60, 38, 10, METAL); // muzzle
  rrect(ctx, -120, -18, 150, 6, 3, ACCENT, 0);
  // grip
  ctx.save();
  ctx.translate(60, 40);
  ctx.rotate(0.42);
  rrect(ctx, -26, -10, 54, 150, 16, POLY);
  ctx.restore();
  ctx.restore();

  hand(ctx, W * 0.6, H * 0.82, 1.2, 1); // right
  hand(ctx, W * 0.46, H * 0.86, 1.1, -1); // left support
}

// Katana held on the LEFT, right hand crossed over the hilt (idle: sheathed).
function drawKatana(ctx, W, H, drawn) {
  // hilt area lower-left
  ctx.save();
  ctx.translate(W * 0.34, H * 0.74);
  ctx.rotate(drawn ? -0.9 : -0.35);
  // tsuka (handle)
  rrect(ctx, -22, -20, 44, 230, 16, POLY);
  for (let i = 0; i < 5; i += 1) rrect(ctx, -22, -10 + i * 42, 44, 16, 6, ACCENT_D, 0);
  // tsuba (guard)
  rrect(ctx, -46, -44, 92, 26, 10, METAL);
  if (drawn) {
    // blade extends up-right
    ctx.save();
    ctx.translate(0, -40);
    ctx.rotate(-0.12);
    poly(ctx, [[-20, 0], [20, 0], [10, -430], [-26, -440]], BLADE, 7); // curved blade
    poly(ctx, [[-20, 0], [-4, 0], [-12, -430], [-26, -440]], BLADE_SH, 0); // shade side
    ctx.fillStyle = ACCENT;
    rrect(ctx, 8, -420, 7, 400, 3, ACCENT, 0); // energy edge
    ctx.restore();
  }
  ctx.restore();

  // hands on the hilt — right hand crossed over from the right
  hand(ctx, W * 0.34, H * 0.84, 1.15, 1); // lower hand
  hand(ctx, W * 0.4, H * 0.7, 1.1, 1); // upper (right) hand crossed over
}

const RENDERERS = {
  rifle: drawRifle,
  pistol: drawPistol,
  knife: (ctx, W, H) => drawKatana(ctx, W, H, false),
  knife_slash: (ctx, W, H) => drawKatana(ctx, W, H, true),
};

export function createViewmodel() {
  const W = 1000;
  const H = 560;

  const root = document.createElement("div");
  root.id = "viewmodel";
  document.body.appendChild(root);

  const wrap = document.createElement("div");
  wrap.id = "vmWrap";
  root.appendChild(wrap);

  const flashEl = document.createElement("div");
  flashEl.id = "vmFlash";
  root.appendChild(flashEl);

  // pre-render each frame to its own canvas
  const canvases = {};
  for (const key of Object.keys(RENDERERS)) {
    const c = ctxOf(W, H);
    RENDERERS[key](c.getContext("2d"), W, H);
    c.classList.add("vmCanvas");
    c.style.display = "none";
    wrap.appendChild(c);
    canvases[key] = c;
  }

  let currentKey = null;
  function show(key) {
    if (currentKey === key) return;
    for (const k of Object.keys(canvases)) canvases[k].style.display = k === key ? "block" : "none";
    currentKey = key;
  }

  return {
    setWeapon(id) {
      this._id = id;
      show(id === "knife" ? "knife" : id);
    },
    setBladeDrawn(drawn) {
      if (this._id !== "knife") return;
      show(drawn ? "knife_slash" : "knife");
    },
    setPose({ tx = 0, ty = 0, rot = 0, scale = 1 }) {
      wrap.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${scale})`;
    },
    flash() {
      flashEl.classList.remove("show");
      void flashEl.offsetWidth;
      flashEl.classList.add("show");
    },
  };
}
