import * as THREE from "three";

// Builds the arena, lighting, cover boxes and shootable targets.
// Returns an object that owns the world state and exposes helpers the
// rest of the game uses (collision boxes, hittable meshes, scoring).
export function createWorld(scene) {
  const ROOM = 18; // half-extent of the floor
  const HEIGHT = 6;

  scene.background = new THREE.Color(0x0e1418);
  scene.fog = new THREE.Fog(0x0e1418, 26, 75);

  // --- Lighting ---------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0x9fb8d0, 0x141a20, 0.85));

  const sun = new THREE.DirectionalLight(0xfff0d8, 1.15);
  sun.position.set(10, 18, 8);
  sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024);
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 60;
  sun.shadow.camera.left = -28;
  sun.shadow.camera.right = 28;
  sun.shadow.camera.top = 28;
  sun.shadow.camera.bottom = -28;
  scene.add(sun);

  // --- Materials --------------------------------------------------------
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x2c343f, roughness: 0.96 });
  const wallMat = new THREE.MeshStandardMaterial({ color: 0x3c4654, roughness: 0.9 });
  const boxMat = new THREE.MeshStandardMaterial({ color: 0x5b6675, roughness: 0.82 });

  const colliders = []; // THREE.Box3 used for player movement
  const solids = []; // meshes used as raycast backstops (walls/cover/floor)

  function addSolid(mesh, asCollider) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    solids.push(mesh);
    if (asCollider) colliders.push(new THREE.Box3().setFromObject(mesh));
  }

  // Floor + ceiling (not collidable — the player is clamped to the room).
  const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM * 2, 0.2, ROOM * 2), floorMat);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);
  solids.push(floor);

  const ceiling = new THREE.Mesh(new THREE.BoxGeometry(ROOM * 2, 0.2, ROOM * 2), wallMat);
  ceiling.position.y = HEIGHT;
  scene.add(ceiling);
  solids.push(ceiling);

  // Sci-fi grid overlay on the floor.
  const grid = new THREE.GridHelper(ROOM * 2, ROOM * 2, 0x35657f, 0x1f2a33);
  grid.position.y = 0.02;
  scene.add(grid);

  // Four boundary walls.
  const t = 0.4;
  const walls = [
    [0, -ROOM, ROOM * 2, t],
    [0, ROOM, ROOM * 2, t],
    [-ROOM, 0, t, ROOM * 2],
    [ROOM, 0, t, ROOM * 2],
  ];
  for (const [x, z, w, d] of walls) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, HEIGHT, d), wallMat);
    m.position.set(x, HEIGHT / 2, z);
    addSolid(m, true);
  }

  // Cover boxes scattered around the arena.
  const covers = [
    [-5, 2, 3, 2.2, 3],
    [5, -4, 4, 3, 4],
    [-1, -8, 2.5, 1.8, 2.5],
    [8, 6, 3, 2.6, 3],
    [-9, -3, 2, 1.4, 2],
  ];
  for (const [x, z, w, h, d] of covers) {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), boxMat);
    m.position.set(x, h / 2, z);
    addSolid(m, true);
  }

  // --- Targets ----------------------------------------------------------
  const TARGET_COUNT = 6;
  const TARGET_HP = 30;
  const RESPAWN_DELAY = 1.8;
  const targetGeo = new THREE.IcosahedronGeometry(0.55, 0);
  const targets = [];

  for (let i = 0; i < TARGET_COUNT; i += 1) {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xff6b4a,
      emissive: 0xff3b1a,
      emissiveIntensity: 0.6,
      roughness: 0.4,
      metalness: 0.1,
    });
    const mesh = new THREE.Mesh(targetGeo, mat);
    mesh.castShadow = true;
    mesh.userData = {
      type: "target",
      health: TARGET_HP,
      maxHealth: TARGET_HP,
      alive: true,
      baseY: 1.5,
      phase: Math.random() * Math.PI * 2,
      hitFlash: 0,
      respawnAt: 0,
    };
    scene.add(mesh);
    targets.push(mesh);
    placeTarget(mesh);
  }

  // Move a target to a fresh random spot, away from cover boxes.
  function placeTarget(mesh) {
    const limit = ROOM - 2.5;
    let x = 0;
    let z = 0;
    for (let tries = 0; tries < 20; tries += 1) {
      x = (Math.random() * 2 - 1) * limit;
      z = (Math.random() * 2 - 1) * limit;
      // keep clear of cover boxes so targets don't spawn inside walls
      const blocked = covers.some(([cx, cz, cw, , cd]) =>
        Math.abs(x - cx) < cw / 2 + 1 && Math.abs(z - cz) < cd / 2 + 1
      );
      if (!blocked) break;
    }
    mesh.userData.baseY = 1.2 + Math.random() * 1.8;
    mesh.position.set(x, mesh.userData.baseY, z);
  }

  const state = { score: 0, time: 0 };

  // Apply damage to a target. Returns true when it was destroyed.
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

  // Meshes the weapon can ray-test against this frame.
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
        // bob + spin so they read as "alive"
        mesh.position.y = d.baseY + Math.sin(state.time * 2 + d.phase) * 0.3;
        mesh.rotation.y += dt * 1.2;
        mesh.rotation.x += dt * 0.6;
        if (d.hitFlash > 0) {
          d.hitFlash = Math.max(0, d.hitFlash - dt * 4);
          mesh.material.emissiveIntensity = 0.6 + d.hitFlash * 1.6;
        }
      } else if (state.time >= d.respawnAt) {
        // respawn
        d.alive = true;
        d.health = d.maxHealth;
        d.hitFlash = 0;
        mesh.material.emissiveIntensity = 0.6;
        mesh.visible = true;
        placeTarget(mesh);
      }
    }
  }

  return { ROOM, colliders, solids, targets, state, damageTarget, getHittables, update };
}
