import * as THREE from "three";
import { techPanel, techFloor, hazardStripes, brushedMetal, holoScreen } from "./textures.js";

// Enclosed sci-fi base ("future ops" look): panelled metal surfaces, holo
// screens, hazard trims and restrained accent lighting (no bloom). Exposes
// colliders, raycast solids, training targets and interactables.
export function createWorld(scene) {
  const ROOM = 16;
  const HEIGHT = 6;

  scene.background = new THREE.Color(0x0b1016);
  scene.fog = new THREE.Fog(0x0b1016, 32, 82);

  // --- Lighting (moderate, texture-readable) ---------------------------
  scene.add(new THREE.HemisphereLight(0xb4cce6, 0x12181f, 0.85));
  const key = new THREE.DirectionalLight(0xeaf2ff, 0.8);
  key.position.set(9, 18, 11);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 60;
  key.shadow.camera.left = -26;
  key.shadow.camera.right = 26;
  key.shadow.camera.top = 26;
  key.shadow.camera.bottom = -26;
  scene.add(key);
  for (const [lx, lz, col] of [[-8, -5, 0x9cc6ff], [8, -5, 0xffb066], [0, 8, 0x9cc6ff]]) {
    const lamp = new THREE.PointLight(col, 0.4, 20, 2);
    lamp.position.set(lx, HEIGHT - 0.8, lz);
    scene.add(lamp);
  }

  // --- Textures + materials --------------------------------------------
  const floorTex = techFloor();
  floorTex.repeat.set(12, 12);
  const wallTex = techPanel();
  wallTex.repeat.set(8, 2);
  const ceilTex = brushedMetal("#222a33");
  ceilTex.repeat.set(8, 8);
  const metalTex = brushedMetal("#3a4654");
  const hazardTex = hazardStripes();
  hazardTex.repeat.set(3, 1);

  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, metalness: 0.35 });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.78, metalness: 0.3 });
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.85, metalness: 0.25 });
  const trimMat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.4, metalness: 0.55 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6, metalness: 0.2 });
  const cyanMat = new THREE.MeshStandardMaterial({ color: 0x1b6f96, emissive: 0x37b6ff, emissiveIntensity: 0.85, roughness: 0.4 });
  const orangeMat = new THREE.MeshStandardMaterial({ color: 0x8a4a18, emissive: 0xff8a3c, emissiveIntensity: 0.8, roughness: 0.4 });

  const colliders = [];
  const solids = [];
  const interactables = [];

  function add(mesh, asCollider) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    solids.push(mesh);
    if (asCollider) colliders.push(new THREE.Box3().setFromObject(mesh));
    return mesh;
  }

  function boxMesh(w, h, d, mat, x, y, z) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  }

  // Floor + ceiling.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM * 2, 0.2, ROOM * 2), floorMat);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);
  solids.push(floor);
  const ceiling = boxMesh(ROOM * 2, 0.2, ROOM * 2, ceilMat, 0, HEIGHT, 0);
  scene.add(ceiling);
  solids.push(ceiling);

  // Walls + vertical structural ribs for depth.
  const t = 0.5;
  const walls = [
    [0, -ROOM, ROOM * 2, t],
    [0, ROOM, ROOM * 2, t],
    [-ROOM, 0, t, ROOM * 2],
    [ROOM, 0, t, ROOM * 2],
  ];
  for (const [x, z, w, d] of walls) add(boxMesh(w, HEIGHT, d, wallMat, x, HEIGHT / 2, z), true);

  // structural ribs along each wall
  for (let i = -ROOM + 4; i <= ROOM - 4; i += 4) {
    add(boxMesh(0.4, HEIGHT, 0.5, trimMat, i, HEIGHT / 2, -ROOM + 0.4), false);
    add(boxMesh(0.4, HEIGHT, 0.5, trimMat, i, HEIGHT / 2, ROOM - 0.4), false);
    add(boxMesh(0.5, HEIGHT, 0.4, trimMat, -ROOM + 0.4, HEIGHT / 2, i), false);
    add(boxMesh(0.5, HEIGHT, 0.4, trimMat, ROOM - 0.4, HEIGHT / 2, i), false);
  }
  // thin cyan accent baseboard framing the room
  scene.add(boxMesh(ROOM * 2 - 1, 0.07, 0.12, cyanMat, 0, 0.3, -ROOM + 0.7));
  scene.add(boxMesh(ROOM * 2 - 1, 0.07, 0.12, cyanMat, 0, 0.3, ROOM - 0.7));
  scene.add(boxMesh(0.12, 0.07, ROOM * 2 - 1, cyanMat, -ROOM + 0.7, 0.3, 0));
  scene.add(boxMesh(0.12, 0.07, ROOM * 2 - 1, cyanMat, ROOM - 0.7, 0.3, 0));

  // --- Holo label + operator NPC ---------------------------------------
  function makeLabel(text, color = "#7fd1ff") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(8,18,26,0.55)";
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.strokeRect(3, 3, 250, 58);
    ctx.fillStyle = color;
    ctx.fillRect(3, 3, 6, 58);
    ctx.font = "bold 30px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 132, 34);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false })
    );
    sprite.scale.set(1.9, 0.48, 1);
    return sprite;
  }

  function makeOperator(x, z, faceYaw, suitColor, visorMat, labelText, labelColor) {
    const g = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.55, metalness: 0.35 });
    const plate = new THREE.MeshStandardMaterial({ color: 0x20272f, roughness: 0.5, metalness: 0.5 });

    const hips = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.32, 0.3), plate);
    hips.position.y = 0.92;
    const chest = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.5, 0.36), suit);
    chest.position.y = 1.32;
    const chestPlate = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.34, 0.06), plate);
    chestPlate.position.set(0, 1.34, 0.2);
    const neck = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.1, 0.18), plate);
    neck.position.y = 1.62;
    const helmet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.36), plate);
    helmet.position.y = 1.82;
    const visor = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 0.06), visorMat);
    visor.position.set(0, 1.82, 0.2);
    const shoulders = new THREE.Mesh(new THREE.BoxGeometry(0.94, 0.18, 0.36), plate);
    shoulders.position.y = 1.54;

    const mkLimb = (w, h, d, px, py) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), suit);
      m.position.set(px, py, 0);
      return m;
    };
    const lArm = mkLimb(0.16, 0.6, 0.2, -0.4, 1.2);
    const rArm = mkLimb(0.16, 0.6, 0.2, 0.4, 1.2);
    const lLeg = mkLimb(0.22, 0.78, 0.26, -0.15, 0.4);
    const rLeg = mkLimb(0.22, 0.78, 0.26, 0.15, 0.4);

    for (const part of [hips, chest, chestPlate, neck, helmet, visor, shoulders, lArm, rArm, lLeg, rLeg]) {
      part.castShadow = true;
      g.add(part);
    }
    g.position.set(x, 0, z);
    g.rotation.y = faceYaw;
    scene.add(g);
    solids.push(chest, helmet);

    const label = makeLabel(labelText, labelColor);
    label.position.set(x, 2.4, z);
    scene.add(label);
  }

  // --- Vendor station (left) -------------------------------------------
  add(boxMesh(3.4, 1.1, 1.2, trimMat, -8, 0.55, -5), true);
  add(boxMesh(3.4, 0.08, 1.2, cyanMat, -8, 1.12, -5), false); // glowing counter edge
  const armoryScreen = holoScreen("ARMORY", 4, "#7fd1ff");
  add(boxMesh(3.0, 0.7, 0.08, new THREE.MeshStandardMaterial({ map: armoryScreen, emissiveMap: armoryScreen, emissive: 0xffffff, emissiveIntensity: 0.9, color: 0x0a1a26 }), -8, 0.7, -4.45), false);
  makeOperator(-8, -6, 0, 0x2f5d86, cyanMat, "商人 · 军械", "#7fd1ff");
  interactables.push({ name: "商人 · 装备售卖", action: "vendor", pos: new THREE.Vector3(-8, 0, -3.6), radius: 3 });

  // --- Mission station (right) — holo board ----------------------------
  add(boxMesh(3.4, 1.1, 1.2, trimMat, 8, 0.55, -5), true);
  add(boxMesh(2.6, 2.4, 0.18, trimMat, 8, 2.0, -5.9), false); // board frame
  const missionScreen = holoScreen("MISSIONS", 5, "#ffb066");
  add(boxMesh(2.3, 2.1, 0.06, new THREE.MeshStandardMaterial({ map: missionScreen, emissiveMap: missionScreen, emissive: 0xffffff, emissiveIntensity: 0.95, color: 0x0a1018 }), 8, 2.0, -5.78), false);
  makeOperator(8, -6, 0, 0x6a4a22, orangeMat, "任务官 · 行动", "#ffc070");
  interactables.push({ name: "任务官 · 任务接取", action: "mission", pos: new THREE.Vector3(8, 0, -3.6), radius: 3 });

  // --- Deploy door (far wall) ------------------------------------------
  add(boxMesh(4.0, 4.6, 0.4, trimMat, 0, 2.3, -ROOM + 0.35), false); // frame
  add(boxMesh(4.2, 0.5, 0.45, hazardMat, 0, 4.7, -ROOM + 0.32), false); // hazard header
  const doorScreen = holoScreen("DEPLOY", 3, "#ffd23f");
  const doorMat = new THREE.MeshStandardMaterial({ map: doorScreen, emissiveMap: doorScreen, emissive: 0xffffff, emissiveIntensity: 0.8, color: 0x0a1018, roughness: 0.4, metalness: 0.4 });
  const doorPanel = boxMesh(3.2, 3.8, 0.18, doorMat, 0, 2.0, -ROOM + 0.55);
  scene.add(doorPanel);
  solids.push(doorPanel);
  add(boxMesh(3.4, 0.1, 0.2, orangeMat, 0, 3.95, -ROOM + 0.6), false);
  add(boxMesh(0.1, 3.9, 0.2, orangeMat, -1.7, 2.0, -ROOM + 0.6), false);
  add(boxMesh(0.1, 3.9, 0.2, orangeMat, 1.7, 2.0, -ROOM + 0.6), false);
  const doorLabel = makeLabel("部署门 · 选择副本", "#ffd23f");
  doorLabel.position.set(0, 4.95, -ROOM + 0.7);
  scene.add(doorLabel);
  interactables.push({ name: "部署门 · 选择副本", action: "deploy", pos: new THREE.Vector3(0, 0, -ROOM + 2.2), radius: 3.5 });

  // supply crates (metal body, hazard-striped top)
  for (const [x, z] of [[-12, 8], [-10.4, 9.6], [11, 7], [12.3, 9]]) {
    add(boxMesh(1.4, 1.3, 1.4, trimMat, x, 0.65, z), true);
    add(boxMesh(1.42, 0.16, 1.42, hazardMat, x, 1.32, z), false);
  }

  // --- Training range (behind spawn) -----------------------------------
  const TARGET_HP = 30;
  const RESPAWN_DELAY = 1.5;
  const targetGeo = new THREE.OctahedronGeometry(0.55, 0);
  const targets = [];
  add(boxMesh(12, 0.7, 0.4, trimMat, 0, 0.35, 11.5), true);
  add(boxMesh(12, 0.1, 0.45, cyanMat, 0, 0.72, 11.5), false);
  const rangeLabel = makeLabel("训练靶场", "#8effb0");
  rangeLabel.position.set(0, 3.2, 14.5);
  scene.add(rangeLabel);

  const trainSpots = [[-4, 13], [0, 13.6], [4, 13]];
  for (let i = 0; i < trainSpots.length; i += 1) {
    const [tx, tz] = trainSpots[i];
    const mat = new THREE.MeshStandardMaterial({ color: 0xc7402a, emissive: 0xff5a3c, emissiveIntensity: 0.6, roughness: 0.4, metalness: 0.3 });
    const mesh = new THREE.Mesh(targetGeo, mat);
    mesh.castShadow = true;
    mesh.position.set(tx, 1.6, tz);
    mesh.userData = { type: "target", health: TARGET_HP, maxHealth: TARGET_HP, alive: true, baseY: 1.6, home: new THREE.Vector3(tx, 1.6, tz), phase: i * 1.7, hitFlash: 0, respawnAt: 0 };
    scene.add(mesh);
    targets.push(mesh);
  }

  const state = { score: 0, time: 0 };

  function damageTarget(mesh, dmg) {
    const d = mesh.userData;
    if (!d.alive) return false;
    d.health -= dmg;
    d.hitFlash = 1;
    if (d.health <= 0) {
      d.alive = false;
      mesh.visible = false;
      d.respawnAt = state.time + RESPAWN_DELAY;
      state.score += 1;
      return true;
    }
    return false;
  }

  function getHittables() {
    const list = solids.slice();
    for (const tgt of targets) if (tgt.userData.alive) list.push(tgt);
    return list;
  }

  function update(dt) {
    state.time += dt;
    for (const mesh of targets) {
      const d = mesh.userData;
      if (d.alive) {
        mesh.position.y = d.baseY + Math.sin(state.time * 2 + d.phase) * 0.25;
        mesh.rotation.y += dt * 1.4;
        if (d.hitFlash > 0) {
          d.hitFlash = Math.max(0, d.hitFlash - dt * 4);
          mesh.material.emissiveIntensity = 0.6 + d.hitFlash * 1.4;
        }
      } else if (state.time >= d.respawnAt) {
        d.alive = true;
        d.health = d.maxHealth;
        d.hitFlash = 0;
        mesh.material.emissiveIntensity = 0.6;
        mesh.position.copy(d.home);
        mesh.visible = true;
      }
    }
  }

  return { ROOM, colliders, solids, targets, interactables, state, damageTarget, getHittables, update };
}
