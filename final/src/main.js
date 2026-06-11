import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { createWorld } from "./world.js?v=DEV";
import { createPlayer } from "./player.js?v=DEV";
import { createWeapons } from "./weapons.js?v=DEV";
import { createUI } from "./ui.js?v=DEV";
import "./shell.js?v=DEV"; // boot logo + login + lobby + backpack (front-end shell)
import { account } from "./account.js?v=DEV";
import { renderInventory, ITEM_DB } from "./inventory.js?v=DEV";
import { audio } from "./audio.js?v=DEV";

// Human-readable build version: YYMMDD + 3-digit deploy count for that day
// (e.g. 260611001 = 2026-06-11, 1st deploy). Bumped by hand each deploy so a
// refresh visibly confirms whether the new build is live.
const BUILD_VERSION = "260611026";
(() => {
  const el = document.getElementById("buildVer");
  if (el) el.textContent = `v${BUILD_VERSION}`;
})();

// --- Renderer / scene / camera ------------------------------------------
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping; // filmic, realistic response
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 200);
scene.add(camera); // camera holds the weapon view-model

const world = createWorld(scene, {
  // Walking over a loot orb in Area 1 picks it up into the account inventory.
  onLoot(drop) {
    account.addItem(drop.id, drop.qty);
    const it = ITEM_DB[drop.id];
    ui.toast(`拾取：${it ? it.name : drop.id}${drop.qty > 1 ? " ×" + drop.qty : ""}`);
    if (charPanel && !charPanel.classList.contains("hidden")) renderInventory(charBody);
  },
});
const player = createPlayer(camera, world);

// --- Post-processing: clean anime presentation -------------------------
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
// gentle bloom for energy/holo glow only
composer.addPass(
  new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.14, 0.4, 1.0)
);
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass(window.innerWidth, window.innerHeight)); // crisp line art

// HUD elements
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const crosshair = document.getElementById("crosshair");
const hitmarker = document.getElementById("hitmarker");
const scoreEl = document.getElementById("score");
const ammoEl = document.getElementById("ammo");
const healthEl = document.getElementById("health");
const weaponEl = document.getElementById("weapon");
const sprintEl = document.getElementById("sprint");
const promptEl = document.getElementById("prompt");

// In-game character / backpack panel (toggle with B).
const charPanel = document.getElementById("charPanel");
const charBody = document.getElementById("charBody");
function openChar() {
  renderInventory(charBody);
  charPanel.classList.remove("hidden");
  if (document.pointerLockElement) document.exitPointerLock?.();
}
function closeChar(resume = true) {
  charPanel.classList.add("hidden");
  if (resume) requestLock();
  else showPause();
}
document.getElementById("charClose").addEventListener("click", () => closeChar(true));

const killBanner = document.getElementById("killBanner");
function showKill() {
  audio.kill();
  killBanner.classList.remove("show");
  void killBanner.offsetWidth;
  killBanner.classList.add("show");
}

const weapons = createWeapons(camera, scene, world, player, {
  onHitmarker(killed) {
    // retrigger the CSS flash animation
    hitmarker.classList.remove("show");
    void hitmarker.offsetWidth;
    hitmarker.classList.add("show");
    if (killed) showKill();
  },
});

const ui = createUI({
  onResume: () => requestLock(),
  onDeploy: (area) => {
    world.enterArea1();
    player.state.pos.copy(world.areaSpawn);
    player.state.vy = 0;
    const d = account.getData();
    if (d) { d.stats.runs += 1; account.save(d); }
    ui.toast(`已进入 ${area.name} · 走到撤离点按 E 返回`);
  },
});

// --- Input --------------------------------------------------------------
const inputState = { locked: false };
let activeInteractable = null;

function interact() {
  if (!activeInteractable) return;
  if (activeInteractable.action === "extract") {
    world.extract();
    player.state.pos.copy(world.baseSpawn);
    player.state.vy = 0;
    ui.toast("已撤离回基地");
    return;
  }
  if (activeInteractable.action === "ammo") {
    weapons.resupply();
    audio.reload();
    ui.toast("弹药已补充");
    return;
  }
  ui.openAction(activeInteractable.action);
  document.exitPointerLock?.();
}

function updateInteraction() {
  let best = null;
  let bestD = Infinity;
  const p = player.state.pos;
  for (const it of world.interactables) {
    const d = Math.hypot(p.x - it.pos.x, p.z - it.pos.z);
    if (d < it.radius && d < bestD) {
      best = it;
      bestD = d;
    }
  }
  activeInteractable = best;
  if (best) {
    promptEl.textContent = `[E] ${best.name}`;
    promptEl.style.display = "block";
  } else {
    promptEl.style.display = "none";
  }
}

function onKeyDown(e) {
  // Backpack/attributes panel: B resumes the game, Esc goes to the pause overlay.
  if (!charPanel.classList.contains("hidden")) {
    if (e.code === "KeyB") closeChar(true);
    else if (e.code === "Escape") closeChar(false);
    return;
  }
  // While a menu is open, Esc closes it to the pause overlay.
  if (ui.isOpen()) {
    if (e.code === "Escape") {
      ui.close();
      showPause();
    }
    return;
  }
  if (e.code === "KeyB" && inputState.locked) { openChar(); return; }
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ControlLeft"].includes(e.code)) {
    e.preventDefault();
  }
  player.keys.add(e.code);
  if (e.code === "Space" && !e.repeat) player.queueJump();
  if (e.code === "KeyE") interact();
  if (e.code === "KeyR") weapons.reload();
  if (e.code === "Digit1") weapons.select(0);
  if (e.code === "Digit2") weapons.select(1);
  if (e.code === "Digit3") weapons.select(2);
}

function onKeyUp(e) {
  player.keys.delete(e.code);
}

function onMouseMove(e) {
  if (!inputState.locked) return;
  player.look(e.movementX, e.movementY);
}

function onMouseDown(e) {
  if (!inputState.locked) return;
  if (e.button === 0) weapons.triggerDown(performance.now() / 1000);
}

function onMouseUp(e) {
  if (e.button === 0) weapons.triggerUp();
}

function requestLock() {
  audio.resume(); // unlock audio within the click gesture
  renderer.domElement.requestPointerLock?.();
}

// Browsers block requestPointerLock when it's triggered by the Esc key (Esc is
// the exit key), so closing a panel with Esc shows the pause overlay instead of
// snapping back into the game — the player clicks "点击开始" to resume.
function showPause() {
  overlay.classList.remove("hidden");
  crosshair.style.display = "none";
  player.keys.clear();
}

function onPointerLockChange() {
  inputState.locked = document.pointerLockElement === renderer.domElement;
  // Show the start overlay only when paused with no menu/backpack panel open.
  const panelOpen = ui.isOpen() || !charPanel.classList.contains("hidden");
  overlay.classList.toggle("hidden", inputState.locked || panelOpen);
  crosshair.style.display = inputState.locked ? "block" : "none";
  // Sync the in-hand AK skin to the account (gold once unlocked from merchant).
  if (inputState.locked && window.__PN_SET_AK_SKIN__) {
    const d = account.getData();
    window.__PN_SET_AK_SKIN__(d && d.skins && d.skins.ak === "gold" ? "gold" : "black");
  }
  if (!inputState.locked) {
    weapons.triggerUp();
    player.keys.clear();
    promptEl.style.display = "none";
  }
}

startBtn.addEventListener("click", requestLock);
renderer.domElement.addEventListener("click", () => {
  if (!inputState.locked) requestLock();
});
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("mousemove", onMouseMove);
window.addEventListener("mousedown", onMouseDown);
window.addEventListener("mouseup", onMouseUp);
document.addEventListener("pointerlockchange", onPointerLockChange);

// Losing focus can drop keyup events — clear held keys so nothing sticks.
window.addEventListener("blur", () => {
  player.keys.clear();
  weapons.triggerUp();
});

window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  composer.setSize(window.innerWidth, window.innerHeight);
});

// --- HUD ----------------------------------------------------------------
function updateHUD() {
  scoreEl.textContent = String(world.state.score);
  const hud = weapons.getHUD();
  weaponEl.textContent = hud.name;
  ammoEl.textContent = hud.ammoText;
  sprintEl.textContent = player.state.sprinting ? "开" : "关";
  healthEl.textContent = String(Math.round(player.state.health));
}

// --- Main loop ----------------------------------------------------------
const fpsEl = document.getElementById("fps");
let fpsFrames = 0;
let fpsLast = performance.now();
let last = performance.now();
function animate(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (inputState.locked) {
    player.update(dt);
    weapons.update(dt, now / 1000);
    world.update(dt, player.state.pos);
    updateInteraction();
  }

  composer.render();
  updateHUD();

  fpsFrames += 1;
  if (now - fpsLast >= 500) {
    if (fpsEl) fpsEl.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsLast))} FPS`;
    fpsFrames = 0;
    fpsLast = now;
  }
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
