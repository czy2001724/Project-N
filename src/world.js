import * as THREE from "three";

// Builds the enclosed home base (hub): vendor + mission NPCs, a deploy door,
// and a small training range so weapons stay testable. Exposes colliders,
// raycast solids, training targets and a list of interactables that the
// interaction system reads each frame.
export function createWorld(scene) {
  const ROOM = 16;
  const HEIGHT = 6;

  scene.background = new THREE.Color(0x0c1116);
  scene.fog = new THREE.Fog(0x0c1116, 30, 80);

  // --- Lighting ---------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0x9fb8d0, 0x10161c, 0.7));

  const sun = new THREE.DirectionalLight(0xdfe8f5, 0.7);
  sun.position.set(8, 18, 10);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -26;
  sun.shadow.camera.right = 26;
  sun.shadow.camera.top = 26;
  sun.shadow.camera.bottom = -26;
  scene.add(sun);

  // Warm interior fill lights.
  for (const [lx, lz] of [[-7, -5], [7, -5], [0, 8]]) {
    const lamp = new THREE.PointLight(0x88c8ff, 0.5, 22, 2);
    lamp.position.set(lx, HEIGHT - 0.6, lz);
    scene.add(lamp);
  }

  // --- Materials --------------------------------------------------------
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x1b212a, roughness: 0.42, metalness: 0.62 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x2b333d, roughness: 0.82, metalness: 0.2 });
  const trimMat = new THREE.MeshStandardMaterial({ color: 0x47525f, roughness: 0.5, metalness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x8fe3ff, emissive: 0x39b6ff, emissiveIntensity: 2.2, roughness: 0.3, metalness: 0.2 });
  const panelMat = new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xc4e6ff, emissiveIntensity: 3.0 });

  const colliders = [];
  const solids = [];

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

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(ROOM * 2, 0.2, ROOM * 2), wallMat);
  ceiling.position.y = HEIGHT;
  scene.add(ceiling);
  solids.push(ceiling);

  // Subtle floor grid.
  const grid = new THREE.GridHelper(ROOM * 2, ROOM, 0x2c3a47, 0x1d262e);
  grid.position.y = 0.02;
  scene.add(grid);

  // Glowing ceiling light fixtures (bloom) over each zone.
  for (const [lx, lz] of [[-7, -5], [7, -5], [0, 8], [0, -9]]) {
    const fixture = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.14, 1.0), panelMat);
    fixture.position.set(lx, HEIGHT - 0.16, lz);
    scene.add(fixture);
  }

  // Emissive floor strips running down the room for a sci-fi walkway feel.
  for (const x of [-9, 0, 9]) {
    const strip = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.04, ROOM * 1.7), accentMat);
    strip.position.set(x, 0.03, 0);
    scene.add(strip);
  }

  // Four walls.
  const t = 0.5;
  const walls = [
    [0, -ROOM, ROOM * 2, t],
    [0, ROOM, ROOM * 2, t],
    [-ROOM, 0, t, ROOM * 2],
    [ROOM, 0, t, ROOM * 2],
  ];
  for (const [x, z, w, d] of walls) add(boxMesh(w, HEIGHT, d, wallMat, x, HEIGHT / 2, z), true);

  // Glowing wall trim strip for the sci-fi base look.
  for (const [x, z, w, d] of walls) {
    const strip = boxMesh(w * 0.98, 0.08, d + 0.02, accentMat, x, 1.4, z);
    if (d > w) strip.scale.set(1, 1, 1); // tall wall: keep
    scene.add(strip);
  }

  const interactables = [];

  // --- Helpers: NPC + label --------------------------------------------
  function makeLabel(text, color = "#7fd1ff") {
    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "rgba(8,14,20,0.66)";
    ctx.fillRect(0, 0, 256, 64);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.strokeRect(2, 2, 252, 60);
    ctx.font = "bold 32px system-ui, sans-serif";
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, 128, 34);
    const sprite = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas), transparent: true, depthTest: false })
    );
    sprite.scale.set(1.8, 0.45, 1);
    return sprite;
  }

  function makeNPC(x, z, faceYaw, suitColor, labelText) {
    const g = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.7 });
    const skin = new THREE.MeshStandardMaterial({ color: 0xd9b48a, roughness: 0.8 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x20262e, roughness: 0.8 });

    const torso = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.78, 0.34), suit);
    torso.position.y = 1.16;
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 16), skin);
    head.position.y = 1.72;
    const lLeg = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.75, 0.26), dark);
    lLeg.position.set(-0.15, 0.38, 0);
    const rLeg = lLeg.clone();
    rLeg.position.x = 0.15;
    const lArm = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.62, 0.18), suit);
    lArm.position.set(-0.38, 1.18, 0);
    const rArm = lArm.clone();
    rArm.position.x = 0.38;
    for (const part of [torso, head, lLeg, rLeg, lArm, rArm]) {
      part.castShadow = true;
      g.add(part);
    }
    g.position.set(x, 0, z);
    g.rotation.y = faceYaw;
    scene.add(g);
    solids.push(torso, head);

    const label = makeLabel(labelText);
    label.position.set(x, 2.35, z);
    scene.add(label);
    return g;
  }

  // --- Vendor station (left) -------------------------------------------
  add(boxMesh(3.2, 1.1, 1.1, trimMat, -8, 0.55, -5), true); // counter
  add(boxMesh(3.2, 0.1, 1.1, accentMat, -8, 1.12, -5), false); // glowing counter top
  makeNPC(-8, -6, 0, 0x3a6ea5, "商人");
  interactables.push({ name: "商人 · 装备售卖", action: "vendor", pos: new THREE.Vector3(-8, 0, -3.6), radius: 3 });

  // --- Mission station (right) -----------------------------------------
  add(boxMesh(3.2, 1.1, 1.1, trimMat, 8, 0.55, -5), true);
  add(boxMesh(1.4, 2.0, 0.2, trimMat, 8, 1.6, -5.9), false); // mission board
  add(boxMesh(1.2, 1.7, 0.06, accentMat, 8, 1.65, -5.78), false);
  makeNPC(8, -6, 0, 0x9a6a2f, "任务官");
  interactables.push({ name: "任务官 · 任务接取", action: "mission", pos: new THREE.Vector3(8, 0, -3.6), radius: 3 });

  // --- Deploy door (far wall) ------------------------------------------
  const doorFrame = add(boxMesh(3.8, 4.4, 0.3, trimMat, 0, 2.2, -ROOM + 0.35), false);
  const doorPanel = boxMesh(3.2, 3.9, 0.18, new THREE.MeshStandardMaterial({ color: 0x1c242c, roughness: 0.5, metalness: 0.5 }), 0, 2.0, -ROOM + 0.5);
  scene.add(doorPanel);
  solids.push(doorPanel);
  // door accent lines
  add(boxMesh(3.3, 0.12, 0.2, accentMat, 0, 3.9, -ROOM + 0.55), false);
  add(boxMesh(0.12, 3.9, 0.2, accentMat, 0, 2.0, -ROOM + 0.55), false);
  const doorLabel = makeLabel("部署门 · 选择副本", "#ffd23f");
  doorLabel.position.set(0, 4.7, -ROOM + 0.6);
  scene.add(doorLabel);
  interactables.push({ name: "部署门 · 选择副本", action: "deploy", pos: new THREE.Vector3(0, 0, -ROOM + 2.2), radius: 3.5 });

  // crates for cover / decoration
  for (const [x, z] of [[-12, 8], [-10.5, 9.5], [11, 7], [12, 9]]) {
    add(boxMesh(1.4, 1.4, 1.4, trimMat, x, 0.7, z), true);
  }

  // --- Training range (behind spawn) -----------------------------------
  const TARGET_HP = 30;
  const RESPAWN_DELAY = 1.5;
  const targetGeo = new THREE.IcosahedronGeometry(0.5, 0);
  const targets = [];
  const trainSpots = [[-4, 13], [0, 13.6], [4, 13]];
  add(boxMesh(12, 0.6, 0.4, trimMat, 0, 0.3, 11.5), true); // range barrier
  const rangeLabel = makeLabel("训练靶场", "#8effb0");
  rangeLabel.position.set(0, 3.2, 14.5);
  scene.add(rangeLabel);

  for (let i = 0; i < trainSpots.length; i += 1) {
    const [tx, tz] = trainSpots[i];
    const mat = new THREE.MeshStandardMaterial({ color: 0xff6b4a, emissive: 0xff3b1a, emissiveIntensity: 1.3, roughness: 0.4 });
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
        mesh.rotation.y += dt * 1.2;
        if (d.hitFlash > 0) {
          d.hitFlash = Math.max(0, d.hitFlash - dt * 4);
          mesh.material.emissiveIntensity = 1.3 + d.hitFlash * 2.0;
        }
      } else if (state.time >= d.respawnAt) {
        d.alive = true;
        d.health = d.maxHealth;
        d.hitFlash = 0;
        mesh.material.emissiveIntensity = 1.3;
        mesh.position.copy(d.home);
        mesh.visible = true;
      }
    }
  }

  return { ROOM, colliders, solids, targets, interactables, state, damageTarget, getHittables, update };
}
