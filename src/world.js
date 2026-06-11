import * as THREE from "three";
import { techPanel, techFloor, hazardStripes, brushedMetal, holoScreen } from "./textures.js";

// Enclosed sci-fi base. Mixes boxes with cylinders, capsules, arches and
// rings to break up the blocky look, with a bright, saturated palette.
// Exposes colliders, raycast solids, training targets and interactables.
export function createWorld(scene) {
  const ROOM = 16;
  const HEIGHT = 6;

  scene.background = new THREE.Color(0x0e1a26);
  scene.fog = new THREE.Fog(0x0e1a26, 34, 88);

  // --- Lighting (brighter, colourful fills) ----------------------------
  scene.add(new THREE.HemisphereLight(0xc8e0ff, 0x1a2230, 1.05));
  const key = new THREE.DirectionalLight(0xf2f8ff, 0.95);
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
  for (const [lx, lz, col] of [[-8, -5, 0x57c8ff], [8, -5, 0xffac4d], [0, 8, 0x57c8ff], [0, -9, 0x6affc0]]) {
    const lamp = new THREE.PointLight(col, 0.55, 22, 2);
    lamp.position.set(lx, HEIGHT - 0.8, lz);
    scene.add(lamp);
  }

  // --- Textures + materials --------------------------------------------
  const floorTex = techFloor();
  floorTex.repeat.set(12, 12);
  const wallTex = techPanel();
  wallTex.repeat.set(8, 2);
  const ceilTex = brushedMetal("#2a3a4c");
  ceilTex.repeat.set(8, 8);
  const metalTex = brushedMetal("#48607a");
  const hazardTex = hazardStripes();
  hazardTex.repeat.set(3, 1);

  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.65, metalness: 0.35 });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.72, metalness: 0.3 });
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.8, metalness: 0.3 });
  const trimMat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.35, metalness: 0.6 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.55, metalness: 0.2 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x2bb6ff, emissive: 0x37c4ff, emissiveIntensity: 1.15, roughness: 0.35 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff9a3c, emissive: 0xff8a2c, emissiveIntensity: 1.1, roughness: 0.35 });
  const mint = new THREE.MeshStandardMaterial({ color: 0x46ffb0, emissive: 0x40f0a0, emissiveIntensity: 1.0, roughness: 0.35 });

  const colliders = [];
  const solids = [];
  const interactables = [];
  const decor = []; // animated bits (rotating rings)

  function add(mesh, asCollider) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    solids.push(mesh);
    if (asCollider) colliders.push(new THREE.Box3().setFromObject(mesh));
    return mesh;
  }

  const boxMesh = (w, h, d, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
    m.position.set(x, y, z);
    return m;
  };
  const cyl = (r, h, mat, x, y, z, axis = "y") => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 22), mat);
    if (axis === "x") m.rotation.z = Math.PI / 2;
    if (axis === "z") m.rotation.x = Math.PI / 2;
    m.position.set(x, y, z);
    return m;
  };
  const torus = (r, tube, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 36), mat);
    m.position.set(x, y, z);
    return m;
  };
  const sphere = (r, mat, x, y, z) => {
    const m = new THREE.Mesh(new THREE.SphereGeometry(r, 20, 16), mat);
    m.position.set(x, y, z);
    return m;
  };

  // Floor + ceiling.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM * 2, 0.2, ROOM * 2), floorMat);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);
  solids.push(floor);
  scene.add(boxMesh(ROOM * 2, 0.2, ROOM * 2, ceilMat, 0, HEIGHT, 0));

  // Walls.
  const t = 0.5;
  const walls = [
    [0, -ROOM, ROOM * 2, t],
    [0, ROOM, ROOM * 2, t],
    [-ROOM, 0, t, ROOM * 2],
    [ROOM, 0, t, ROOM * 2],
  ];
  for (const [x, z, w, d] of walls) add(boxMesh(w, HEIGHT, d, wallMat, x, HEIGHT / 2, z), true);

  // Cylindrical support pillars along the walls (replaces boxy ribs).
  for (let i = -ROOM + 4; i <= ROOM - 4; i += 4) {
    for (const [px, pz] of [[i, -ROOM + 0.6], [i, ROOM - 0.6], [-ROOM + 0.6, i], [ROOM - 0.6, i]]) {
      add(cyl(0.28, HEIGHT, trimMat, px, HEIGHT / 2, pz), false);
    }
  }
  // Big rounded corner columns with glowing collars.
  for (const [cx, cz] of [[-ROOM + 1, -ROOM + 1], [ROOM - 1, -ROOM + 1], [-ROOM + 1, ROOM - 1], [ROOM - 1, ROOM - 1]]) {
    add(cyl(0.7, HEIGHT, trimMat, cx, HEIGHT / 2, cz), true);
    scene.add(torus(0.78, 0.07, cyan, cx, 1.2, cz).rotateX(Math.PI / 2));
    scene.add(torus(0.78, 0.07, cyan, cx, HEIGHT - 1.2, cz).rotateX(Math.PI / 2));
  }
  // Ceiling pipes running the length of the room.
  for (const px of [-11, 11]) {
    add(cyl(0.16, ROOM * 1.9, trimMat, px, HEIGHT - 0.5, 0, "z"), false);
    add(cyl(0.06, ROOM * 1.9, cyan, px, HEIGHT - 0.78, 0, "z"), false);
  }
  // Glowing floor guide lines.
  for (const px of [-9, 0, 9]) scene.add(boxMesh(0.1, 0.04, ROOM * 1.7, cyan, px, 0.03, 0));

  // --- Holo label + capsule operator -----------------------------------
  function makeLabel(text, color = "#7fd1ff") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(8,20,30,0.55)";
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
    const suit = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.5, metalness: 0.4 });
    const plate = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.45, metalness: 0.55 });

    const torsoM = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 6, 14), suit);
    torsoM.position.y = 1.3;
    const chestPlate = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.2, 4, 10), plate);
    chestPlate.position.set(0, 1.34, 0.16);
    chestPlate.scale.set(1, 1, 0.5);
    const head = sphere(0.2, plate, 0, 1.86, 0);
    const visor = sphere(0.14, visorMat, 0, 1.86, 0.1);
    visor.scale.set(1, 0.55, 0.6);
    const shoulderL = sphere(0.16, plate, -0.34, 1.5, 0);
    const shoulderR = sphere(0.16, plate, 0.34, 1.5, 0);

    const limb = (r, len, px, py) => {
      const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 10), suit);
      m.position.set(px, py, 0);
      return m;
    };
    const lArm = limb(0.085, 0.42, -0.4, 1.18);
    const rArm = limb(0.085, 0.42, 0.4, 1.18);
    const lLeg = limb(0.12, 0.5, -0.15, 0.45);
    const rLeg = limb(0.12, 0.5, 0.15, 0.45);

    for (const part of [torsoM, chestPlate, head, visor, shoulderL, shoulderR, lArm, rArm, lLeg, rLeg]) {
      part.castShadow = true;
      g.add(part);
    }
    g.position.set(x, 0, z);
    g.rotation.y = faceYaw;
    scene.add(g);
    solids.push(torsoM, head);

    const label = makeLabel(labelText, labelColor);
    label.position.set(x, 2.45, z);
    scene.add(label);
  }

  // Rounded counter: box base + cylindrical rolled front edge.
  function counter(x, z, accentMat) {
    add(boxMesh(3.4, 1.0, 1.1, trimMat, x, 0.5, z), true);
    add(cyl(0.16, 3.4, trimMat, x, 1.0, z + 0.55, "x"), false);
    scene.add(cyl(0.05, 3.4, accentMat, x, 1.05, z + 0.55, "x"));
  }

  // --- Vendor station (left) -------------------------------------------
  counter(-8, -5, cyan);
  const armoryScreen = holoScreen("ARMORY", 4, "#7fe0ff");
  add(boxMesh(3.0, 0.7, 0.06, new THREE.MeshStandardMaterial({ map: armoryScreen, emissiveMap: armoryScreen, emissive: 0xffffff, emissiveIntensity: 1.1, color: 0x0a1a26 }), -8, 0.62, -4.4), false);
  makeOperator(-8, -6, 0, 0x2f7fb0, cyan, "商人 · 军械", "#7fe0ff");
  interactables.push({ name: "商人 · 装备售卖", action: "vendor", pos: new THREE.Vector3(-8, 0, -3.6), radius: 3 });

  // --- Mission station (right) — holo board ----------------------------
  counter(8, -5, orange);
  add(cyl(0.12, 2.6, trimMat, 8, 1.3, -5.9), false); // board post
  const missionScreen = holoScreen("MISSIONS", 5, "#ffc070");
  add(boxMesh(2.4, 2.1, 0.06, new THREE.MeshStandardMaterial({ map: missionScreen, emissiveMap: missionScreen, emissive: 0xffffff, emissiveIntensity: 1.15, color: 0x0a1018 }), 8, 2.1, -5.8), false);
  scene.add(torus(1.4, 0.05, orange, 8, 2.1, -5.7));
  makeOperator(8, -6, 0, 0xc06a1f, orange, "任务官 · 行动", "#ffc070");
  interactables.push({ name: "任务官 · 任务接取", action: "mission", pos: new THREE.Vector3(8, 0, -3.6), radius: 3 });

  // --- Deploy door (far wall) — arch + rotating ring -------------------
  add(boxMesh(4.2, 4.0, 0.4, trimMat, 0, 2.0, -ROOM + 0.35), false); // frame
  // arched top (half cylinder)
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.1, 2.1, 0.4, 24, 1, false, 0, Math.PI), trimMat);
  arch.rotation.z = Math.PI;
  arch.rotation.x = Math.PI / 2;
  arch.position.set(0, 4.0, -ROOM + 0.35);
  scene.add(arch);
  solids.push(arch);
  add(cyl(2.1, 0.45, hazardMat, 0, 4.0, -ROOM + 0.3, "z"), false); // hazard ring behind arch
  const doorScreen = holoScreen("DEPLOY", 3, "#ffd23f");
  const doorMat = new THREE.MeshStandardMaterial({ map: doorScreen, emissiveMap: doorScreen, emissive: 0xffffff, emissiveIntensity: 1.0, color: 0x0a1018, roughness: 0.4, metalness: 0.4 });
  const doorPanel = boxMesh(3.2, 3.8, 0.18, doorMat, 0, 2.0, -ROOM + 0.55);
  scene.add(doorPanel);
  solids.push(doorPanel);
  const doorRing = torus(2.0, 0.08, orange, 0, 2.2, -ROOM + 0.7);
  scene.add(doorRing);
  decor.push({ mesh: doorRing, spin: 0.5 });
  const doorLabel = makeLabel("部署门 · 选择副本", "#ffd23f");
  doorLabel.position.set(0, 5.2, -ROOM + 0.7);
  scene.add(doorLabel);
  interactables.push({ name: "部署门 · 选择副本", action: "deploy", pos: new THREE.Vector3(0, 0, -ROOM + 2.2), radius: 3.5 });

  // --- Holo energy pylon (decoration, off the main walkway) ------------
  const PX = -5.5;
  const PZ = 5.5;
  add(cyl(0.6, 0.3, trimMat, PX, 0.15, PZ), true); // base
  scene.add(cyl(0.12, 2.4, cyan, PX, 1.3, PZ)); // glowing core
  scene.add(sphere(0.3, cyan, PX, 2.7, PZ));
  const ring1 = torus(0.7, 0.05, mint, PX, 1.6, PZ);
  const ring2 = torus(0.95, 0.05, cyan, PX, 1.6, PZ);
  ring2.rotation.x = Math.PI / 2;
  scene.add(ring1, ring2);
  decor.push({ mesh: ring1, spin: 0.8 }, { mesh: ring2, spin: -0.6, axis: "y" });

  // supply props: boxes + cylinders (barrels) for variety
  for (const [x, z] of [[-12, 8], [-10.4, 9.6], [11, 7.4]]) {
    add(boxMesh(1.4, 1.3, 1.4, trimMat, x, 0.65, z), true);
    add(boxMesh(1.42, 0.16, 1.42, hazardMat, x, 1.32, z), false);
  }
  for (const [x, z, m] of [[12.5, 9, cyan], [11.8, 10.4, orange], [-13, 10, mint]]) {
    add(cyl(0.5, 1.5, trimMat, x, 0.75, z), true);
    scene.add(torus(0.52, 0.05, m, x, 1.2, z).rotateX(Math.PI / 2));
    scene.add(torus(0.52, 0.05, m, x, 0.4, z).rotateX(Math.PI / 2));
  }

  // --- Training range (behind spawn) -----------------------------------
  const TARGET_HP = 30;
  const RESPAWN_DELAY = 1.5;
  const targetGeo = new THREE.OctahedronGeometry(0.55, 0);
  const targets = [];
  add(boxMesh(12, 0.7, 0.4, trimMat, 0, 0.35, 11.5), true);
  add(cyl(0.08, 12, cyan, 0, 0.72, 11.5, "x"), false);
  const rangeLabel = makeLabel("训练靶场", "#8effb0");
  rangeLabel.position.set(0, 3.2, 14.5);
  scene.add(rangeLabel);

  const trainSpots = [[-4, 13], [0, 13.6], [4, 13]];
  for (let i = 0; i < trainSpots.length; i += 1) {
    const [tx, tz] = trainSpots[i];
    const mat = new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff6a44, emissiveIntensity: 0.9, roughness: 0.4, metalness: 0.3 });
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
    for (const d of decor) {
      if (d.axis === "y") d.mesh.rotation.y += dt * d.spin;
      else d.mesh.rotation.z += dt * d.spin;
    }
    for (const mesh of targets) {
      const d = mesh.userData;
      if (d.alive) {
        mesh.position.y = d.baseY + Math.sin(state.time * 2 + d.phase) * 0.25;
        mesh.rotation.y += dt * 1.4;
        if (d.hitFlash > 0) {
          d.hitFlash = Math.max(0, d.hitFlash - dt * 4);
          mesh.material.emissiveIntensity = 0.9 + d.hitFlash * 1.4;
        }
      } else if (state.time >= d.respawnAt) {
        d.alive = true;
        d.health = d.maxHealth;
        d.hitFlash = 0;
        mesh.material.emissiveIntensity = 0.9;
        mesh.position.copy(d.home);
        mesh.visible = true;
      }
    }
  }

  return { ROOM, colliders, solids, targets, interactables, state, damageTarget, getHittables, update };
}
