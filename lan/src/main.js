import * as THREE from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
import { createArena, buildAvatar } from "./arena.js?v=DEV";
import { createPlayer } from "./player.js?v=DEV";
import { createWeapons } from "./weapons.js?v=DEV";
import { createNet } from "./net.js?v=DEV";

const BUILD_VERSION = "260611lan2";
document.getElementById("buildVer").textContent = `v${BUILD_VERSION}`;

// --- renderer / scene ---
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.08, 200);
scene.add(camera);

const arena = createArena(scene);
const player = createPlayer(camera, arena);

const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));
composer.addPass(new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.14, 0.4, 1.0));
composer.addPass(new OutputPass());
composer.addPass(new SMAAPass(window.innerWidth, window.innerHeight));

// --- HUD refs ---
const overlay = document.getElementById("overlay");
const startBtn = document.getElementById("startBtn");
const crosshair = document.getElementById("crosshair");
const hitmarker = document.getElementById("hitmarker");
const scoreEl = document.getElementById("score");
const ammoEl = document.getElementById("ammo");
const healthEl = document.getElementById("health");
const weaponEl = document.getElementById("weapon");
const sprintEl = document.getElementById("sprint");
const oppStatus = document.getElementById("oppStatus");
const oppHpEl = document.getElementById("oppHp");
const fpsEl = document.getElementById("fps");

function toast(msg) {
  const el = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.classList.add("show"), 10);
  setTimeout(() => { el.classList.remove("show"); setTimeout(() => el.remove(), 400); }, 2000);
}

const weapons = createWeapons(camera, scene, arena, player, {
  onHitmarker() { hitmarker.classList.remove("show"); void hitmarker.offsetWidth; hitmarker.classList.add("show"); },
});

// --- networking ---
const net = createNet();
let connected = false;
let role = 0; // 0 host, 1 guest
let myKills = 0;
let dead = false;

// opponent avatar
const opp = buildAvatar(0xff5a5a);
opp.group.visible = false;
scene.add(opp.group);
opp.hit.userData.onHit = (dmg) => { net.send({ t: "hit", d: dmg }); }; // I hit them -> tell them
arena.addHittable(opp.hit);
let oppFlash = 0;
const oppTarget = { x: 0, y: 0, z: 0, ry: 0 };

function mySpawn() { return arena.spawns[role]; }
function respawnSelf() {
  const s = mySpawn();
  player.state.pos.set(s.pos.x, 0, s.pos.z);
  player.state.yaw = s.yaw; player.state.vy = 0;
  player.state.health = 100;
  dead = false;
}
function takeDamage(d) {
  if (dead) return;
  player.state.health = Math.max(0, player.state.health - d);
  if (player.state.health <= 0) {
    dead = true;
    net.send({ t: "dead" }); // opponent scored
    toast("你被击败，正在重生…");
    setTimeout(respawnSelf, 900);
  }
}

net.on("message", (m) => {
  if (m.t === "s") {
    opp.group.visible = true;
    // ry + PI: the avatar's visor faces +z, but the player looks down -z at yaw 0
    oppTarget.x = m.x; oppTarget.y = m.y || 0; oppTarget.z = m.z; oppTarget.ry = m.ry + Math.PI;
    if (typeof m.hp === "number") oppHpEl.textContent = String(Math.round(m.hp));
    if (m.f) oppFlash = 0.05;
  } else if (m.t === "hit") {
    takeDamage(m.d || 14);
  } else if (m.t === "dead") {
    myKills += 1; scoreEl.textContent = String(myKills); toast("击败对手 ✦");
  }
});
net.on("open", () => {
  connected = true;
  closeNet();
  oppStatus.classList.remove("hidden");
  respawnSelf();
  toast("已连接对手，开战！");
});
net.on("close", () => {
  if (connected) toast("连接已断开");
  connected = false; opp.group.visible = false; oppStatus.classList.add("hidden");
});

// --- net panel wiring ---
const netPanel = document.getElementById("netPanel");
const $ = (id) => document.getElementById(id);
function openNet() { netPanel.classList.remove("hidden"); overlay.classList.add("hidden"); if (document.pointerLockElement) document.exitPointerLock?.(); }
function closeNet() { netPanel.classList.add("hidden"); if (!connected) overlay.classList.remove("hidden"); }
$("openNet").addEventListener("click", openNet);
$("netClose").addEventListener("click", closeNet);
$("roleHost").addEventListener("click", async () => {
  role = 0; $("hostFlow").classList.remove("hidden"); $("guestFlow").classList.add("hidden");
  $("netMsg").textContent = "正在生成邀请码…";
  try { $("hostOffer").value = await net.host(); $("netMsg").textContent = "把邀请码发给好友，等待其应答码。"; }
  catch (e) { $("netMsg").textContent = "生成失败：" + e; }
});
$("roleGuest").addEventListener("click", () => {
  role = 1; $("guestFlow").classList.remove("hidden"); $("hostFlow").classList.add("hidden");
  $("netMsg").textContent = "粘贴主机邀请码，再生成应答码。";
});
$("hostConnect").addEventListener("click", async () => {
  try { await net.accept($("hostAnswer").value); $("netMsg").textContent = "已应用应答码，等待连接…"; }
  catch (e) { $("netMsg").textContent = "连接失败：" + e; }
});
$("guestGen").addEventListener("click", async () => {
  $("netMsg").textContent = "正在生成应答码…";
  try { $("guestAnswer").value = await net.join($("guestOffer").value); $("netMsg").textContent = "把应答码发回主机，等待连接…"; }
  catch (e) { $("netMsg").textContent = "生成失败：" + e; }
});
$("copyOffer").addEventListener("click", () => { navigator.clipboard.writeText($("hostOffer").value); $("netMsg").textContent = "邀请码已复制"; });
$("copyAnswer").addEventListener("click", () => { navigator.clipboard.writeText($("guestAnswer").value); $("netMsg").textContent = "应答码已复制"; });

// --- input ---
const inputState = { locked: false };
let localFiring = false;
function requestLock() { renderer.domElement.requestPointerLock?.(); }
function showPause() { overlay.classList.remove("hidden"); crosshair.style.display = "none"; player.keys.clear(); }

function onKeyDown(e) {
  if (!netPanel.classList.contains("hidden")) { if (e.code === "Escape") closeNet(); return; }
  if (["KeyW", "KeyA", "KeyS", "KeyD", "Space", "ShiftLeft", "ControlLeft"].includes(e.code)) e.preventDefault();
  if (e.code === "Escape") { document.exitPointerLock?.(); return; }
  player.keys.add(e.code);
  if (e.code === "Space" && !e.repeat) player.queueJump();
  if (e.code === "KeyR") weapons.reload();
  if (e.code === "Digit1") weapons.select(0);
  if (e.code === "Digit2") weapons.select(1);
  if (e.code === "Digit3") weapons.select(2);
}
function onKeyUp(e) { player.keys.delete(e.code); }
function onMouseMove(e) { if (inputState.locked) player.look(e.movementX, e.movementY); }
function onMouseDown(e) { if (!inputState.locked) return; if (e.button === 0) { localFiring = true; weapons.triggerDown(performance.now() / 1000); } }
function onMouseUp(e) { if (e.button === 0) { localFiring = false; weapons.triggerUp(); } }
function onLockChange() {
  inputState.locked = document.pointerLockElement === renderer.domElement;
  const paneOpen = !netPanel.classList.contains("hidden");
  overlay.classList.toggle("hidden", inputState.locked || paneOpen);
  crosshair.style.display = inputState.locked ? "block" : "none";
  if (!inputState.locked) { localFiring = false; weapons.triggerUp(); player.keys.clear(); }
}
startBtn.addEventListener("click", requestLock);
renderer.domElement.addEventListener("click", () => { if (!inputState.locked && netPanel.classList.contains("hidden")) requestLock(); });
window.addEventListener("keydown", onKeyDown);
window.addEventListener("keyup", onKeyUp);
window.addEventListener("mousemove", onMouseMove);
window.addEventListener("mousedown", onMouseDown);
window.addEventListener("mouseup", onMouseUp);
document.addEventListener("pointerlockchange", onLockChange);
window.addEventListener("blur", () => { localFiring = false; player.keys.clear(); weapons.triggerUp(); });
window.addEventListener("resize", () => {
  camera.aspect = window.innerWidth / window.innerHeight; camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight); composer.setSize(window.innerWidth, window.innerHeight);
});

function updateHUD() {
  const hud = weapons.getHUD();
  weaponEl.textContent = hud.name;
  ammoEl.textContent = hud.ammoText;
  sprintEl.textContent = player.state.sprinting ? "开" : "关";
  healthEl.textContent = String(Math.round(player.state.health));
}

// --- loop ---
let fpsFrames = 0, fpsLast = performance.now(), last = performance.now(), sendAcc = 0;
function animate(now) {
  const dt = Math.min(0.033, (now - last) / 1000); last = now;
  if (inputState.locked) {
    player.update(dt);
    weapons.update(dt, now / 1000);
    arena.update(dt);
  }
  // smooth opponent
  if (opp.group.visible) {
    opp.group.position.x += (oppTarget.x - opp.group.position.x) * 0.25;
    opp.group.position.y += (oppTarget.y - opp.group.position.y) * 0.25;
    opp.group.position.z += (oppTarget.z - opp.group.position.z) * 0.25;
    let dy = oppTarget.ry - opp.group.rotation.y;
    while (dy > Math.PI) dy -= Math.PI * 2; while (dy < -Math.PI) dy += Math.PI * 2;
    opp.group.rotation.y += dy * 0.3;
    oppFlash = Math.max(0, oppFlash - dt);
    opp.muzzle.material.opacity = oppFlash > 0 ? 1 : 0;
  }
  // send my state
  if (connected) {
    sendAcc += dt;
    if (sendAcc >= 0.05) {
      sendAcc = 0;
      net.send({ t: "s", x: player.state.pos.x, y: player.state.pos.y, z: player.state.pos.z, ry: player.state.yaw, rx: player.state.pitch, f: localFiring, hp: player.state.health });
    }
  }
  composer.render();
  updateHUD();
  fpsFrames += 1;
  if (now - fpsLast >= 500) { fpsEl.textContent = `${Math.round((fpsFrames * 1000) / (now - fpsLast))} FPS`; fpsFrames = 0; fpsLast = now; }
  requestAnimationFrame(animate);
}
requestAnimationFrame(animate);
