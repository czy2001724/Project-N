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
import { toonify } from "./toonify.js?v=DEV";

// Human-readable build version: YYMMDD + 3-digit deploy count for that day
// (e.g. 260611001 = 2026-06-11, 1st deploy). Bumped by hand each deploy so a
// refresh visibly confirms whether the new build is live.
const BUILD_VERSION = "260611003";
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
renderer.toneMapping = THREE.NoToneMapping; // flat, saturated anime colours
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 200);
scene.add(camera); // camera holds the weapon view-model

const world = createWorld(scene);
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

const weapons = createWeapons(camera, scene, world, player, {
  onHitmarker() {
    // retrigger the CSS flash animation
    hitmarker.classList.remove("show");
    void hitmarker.offsetWidth;
    hitmarker.classList.add("show");
  },
});

// Apply the anime / cel-shaded look to the whole scene. The view-model is a
// child of the camera (added above), so the weapon + rigged arms get the same
// toon shading + outline treatment as the world.
toonify(scene, { outlineMaxRadius: 5, outlineScale: 1.045 });

const ui = createUI({
  onResume: () => requestLock(),
  onDeploy: () => {}, // hook for the future combat instance
});

// --- Input --------------------------------------------------------------
const inputState = { locked: false };
let activeInteractable = null;

function interact() {
  if (!activeInteractable) return;
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
  // While a menu is open, only Esc (close) is handled.
  if (ui.isOpen()) {
    if (e.code === "Escape") {
      ui.close();
      requestLock();
    }
    return;
  }
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
  renderer.domElement.requestPointerLock?.();
}

function onPointerLockChange() {
  inputState.locked = document.pointerLockElement === renderer.domElement;
  // Show the start overlay only when paused with no menu panel open.
  overlay.classList.toggle("hidden", inputState.locked || ui.isOpen());
  crosshair.style.display = inputState.locked ? "block" : "none";
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
let last = performance.now();
function animate(now) {
  const dt = Math.min(0.033, (now - last) / 1000);
  last = now;

  if (inputState.locked) {
    player.update(dt);
    weapons.update(dt, now / 1000);
    world.update(dt);
    updateInteraction();
  }

  composer.render();
  updateHUD();
  requestAnimationFrame(animate);
}

requestAnimationFrame(animate);
