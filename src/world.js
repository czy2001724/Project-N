import * as THREE from "three";
import { techPanel, techFloor, hazardStripes, brushedMetal, holoScreen } from "./textures.js?v=DEV";

// Futuristic command-hub base. Uses beveled extruded panels, polygonal
// columns, a lathed dome, trusses, light coves and energy conduits instead
// of plain slabs, so it reads as designed sci-fi architecture rather than a
// metal box. Materials are MeshStandard (the toonify pass cel-shades them).
export function createWorld(scene) {
  const ROOM = 16;
  const HEIGHT = 7.5;

  scene.background = new THREE.Color(0x0c1622);
  scene.fog = new THREE.Fog(0x0c1622, 36, 92);

  // --- Lighting --------------------------------------------------------
  scene.add(new THREE.HemisphereLight(0xcfe6ff, 0x1a2433, 1.0));
  const key = new THREE.DirectionalLight(0xf2f8ff, 0.95);
  key.position.set(8, 20, 12);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.near = 1;
  key.shadow.camera.far = 70;
  key.shadow.camera.left = -28;
  key.shadow.camera.right = 28;
  key.shadow.camera.top = 28;
  key.shadow.camera.bottom = -28;
  scene.add(key);
  for (const [lx, lz, col] of [[-9, -4, 0x59c8ff], [9, -4, 0xffac4d], [0, 8, 0x59c8ff], [0, -10, 0x6affc0]]) {
    const lamp = new THREE.PointLight(col, 0.55, 24, 2);
    lamp.position.set(lx, HEIGHT - 1.0, lz);
    scene.add(lamp);
  }

  // --- Textures + materials --------------------------------------------
  const floorTex = techFloor();
  floorTex.repeat.set(10, 10);
  const wallTex = techPanel();
  wallTex.repeat.set(4, 2);
  const ceilTex = brushedMetal("#26323f");
  ceilTex.repeat.set(8, 8);
  const metalTex = brushedMetal("#4a5e76");
  const hazardTex = hazardStripes();
  hazardTex.repeat.set(4, 1);

  const floorMat = new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.7, metalness: 0.2 });
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 0.75, metalness: 0.2 });
  const ceilMat = new THREE.MeshStandardMaterial({ map: ceilTex, roughness: 0.8, metalness: 0.2 });
  const panelMat = new THREE.MeshStandardMaterial({ map: metalTex, roughness: 0.45, metalness: 0.4 });
  const darkMat = new THREE.MeshStandardMaterial({ color: 0x232c38, roughness: 0.6, metalness: 0.4 });
  const hazardMat = new THREE.MeshStandardMaterial({ map: hazardTex, roughness: 0.6, metalness: 0.2 });
  const cyan = new THREE.MeshStandardMaterial({ color: 0x36c4ff, emissive: 0x36c4ff, emissiveIntensity: 1.4, roughness: 0.4 });
  const orange = new THREE.MeshStandardMaterial({ color: 0xff9a3c, emissive: 0xff8a2c, emissiveIntensity: 1.35, roughness: 0.4 });
  const mint = new THREE.MeshStandardMaterial({ color: 0x46ffb0, emissive: 0x40f0a0, emissiveIntensity: 1.3, roughness: 0.4 });
  const field = new THREE.MeshStandardMaterial({ color: 0x49c0ff, emissive: 0x49c0ff, emissiveIntensity: 0.7, transparent: true, opacity: 0.28, roughness: 0.3 });
  const glass = new THREE.MeshStandardMaterial({ color: 0x8fd8ff, emissive: 0x3aa0e0, emissiveIntensity: 0.4, transparent: true, opacity: 0.22, roughness: 0.2 });

  const colliders = [];
  const solids = [];
  const interactables = [];
  const decor = [];

  function add(mesh, asCollider) {
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    solids.push(mesh);
    if (asCollider) colliders.push(new THREE.Box3().setFromObject(mesh));
    return mesh;
  }
  const place = (m, x, y, z) => { m.position.set(x, y, z); return m; };
  const boxMesh = (w, h, d, mat, x, y, z) => place(new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat), x, y, z);
  const col = (r, h, mat, x, y, z, seg = 24, axis = "y") => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat);
    if (axis === "x") m.rotation.z = Math.PI / 2;
    if (axis === "z") m.rotation.x = Math.PI / 2;
    return place(m, x, y, z);
  };
  const torus = (r, tube, mat, x, y, z) => place(new THREE.Mesh(new THREE.TorusGeometry(r, tube, 12, 40), mat), x, y, z);
  const sphere = (r, mat, x, y, z) => place(new THREE.Mesh(new THREE.SphereGeometry(r, 22, 16), mat), x, y, z);

  // Beveled extruded panel (chamfered slab) — the key "designed" detail.
  function bevelPanel(w, h, depth, mat) {
    const s = new THREE.Shape();
    s.moveTo(-w / 2, -h / 2);
    s.lineTo(w / 2, -h / 2);
    s.lineTo(w / 2, h / 2);
    s.lineTo(-w / 2, h / 2);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth, bevelEnabled: true, bevelThickness: 0.05, bevelSize: 0.07, bevelSegments: 2, steps: 1 });
    geo.center();
    return new THREE.Mesh(geo, mat);
  }

  // Angled-screen console (extruded wedge profile).
  function console(width, mat) {
    const s = new THREE.Shape();
    s.moveTo(0, 0);
    s.lineTo(0.75, 0);
    s.lineTo(0.75, 0.82);
    s.lineTo(0.12, 1.12);
    s.lineTo(0, 1.12);
    s.closePath();
    const geo = new THREE.ExtrudeGeometry(s, { depth: width, bevelEnabled: true, bevelThickness: 0.03, bevelSize: 0.03, bevelSegments: 1 });
    geo.center();
    return new THREE.Mesh(geo, mat);
  }

  // Lathed half-dome (ceiling skylight / holo dome).
  function dome(radius, height, mat) {
    const pts = [];
    const seg = 14;
    for (let i = 0; i <= seg; i += 1) {
      const a = (i / seg) * (Math.PI / 2);
      pts.push(new THREE.Vector2(Math.cos(a) * radius, Math.sin(a) * height));
    }
    return new THREE.Mesh(new THREE.LatheGeometry(pts, 36), mat);
  }

  // ---------------------------------------------------------------------
  // FLOOR — tiered: outer floor, raised border ring, glowing inlays.
  const floor = new THREE.Mesh(new THREE.BoxGeometry(ROOM * 2, 0.2, ROOM * 2), floorMat);
  floor.position.y = -0.1;
  floor.receiveShadow = true;
  scene.add(floor);
  solids.push(floor);
  // glowing inlay lines down the central axis + cross rings
  for (const gx of [-6, 0, 6]) scene.add(boxMesh(0.14, 0.03, ROOM * 1.7, cyan, gx, 0.02, 0));
  scene.add(place(new THREE.Mesh(new THREE.RingGeometry(3.0, 3.2, 48), cyan), 0, 0.04, 0).rotateX(-Math.PI / 2));
  scene.add(place(new THREE.Mesh(new THREE.RingGeometry(3.5, 3.62, 48), mint), 0, 0.04, 0).rotateX(-Math.PI / 2));

  // CEILING — recessed dark deck with glowing light panels + trusses.
  scene.add(boxMesh(ROOM * 2, 0.3, ROOM * 2, ceilMat, 0, HEIGHT, 0));
  for (let gx = -ROOM + 4; gx <= ROOM - 4; gx += 8) {
    for (let gz = -ROOM + 4; gz <= ROOM - 4; gz += 8) {
      scene.add(boxMesh(2.6, 0.08, 2.6, cyan, gx, HEIGHT - 0.32, gz)); // recessed light panel
    }
  }
  // ceiling trusses (cross beams)
  for (let gx = -ROOM + 5; gx <= ROOM - 5; gx += 6) scene.add(boxMesh(0.25, 0.4, ROOM * 2, darkMat, gx, HEIGHT - 0.5, 0));
  for (let gz = -ROOM + 5; gz <= ROOM - 5; gz += 6) scene.add(boxMesh(ROOM * 2, 0.25, 0.4, darkMat, 0, HEIGHT - 0.85, gz));
  // central holo dome
  const dm = dome(4.5, 1.6, glass);
  place(dm, 0, HEIGHT - 0.15, 0);
  scene.add(dm);
  scene.add(torus(4.5, 0.08, cyan, 0, HEIGHT - 0.12, 0).rotateX(Math.PI / 2));

  // ---------------------------------------------------------------------
  // WALLS — structural slab (collider) + layered cladding per wall.
  const wallDefs = [
    { axis: "x", pos: -ROOM, inward: 1, len: ROOM * 2 }, // back (-z)
    { axis: "x", pos: ROOM, inward: -1, len: ROOM * 2 }, // front (+z)
    { axis: "z", pos: -ROOM, inward: 1, len: ROOM * 2 }, // left (-x)
    { axis: "z", pos: ROOM, inward: -1, len: ROOM * 2 }, // right (+x)
  ];

  function wallPoint(def, u, depth, y) {
    if (def.axis === "x") return [u, y, def.pos + def.inward * depth];
    return [def.pos + def.inward * depth, y, u];
  }
  function faceYawInto(def) {
    if (def.axis === "x") return def.inward > 0 ? 0 : Math.PI;
    return def.inward > 0 ? Math.PI / 2 : -Math.PI / 2;
  }

  for (const def of wallDefs) {
    // structural slab
    if (def.axis === "x") add(boxMesh(def.len, HEIGHT, 0.6, wallMat, 0, HEIGHT / 2, def.pos), true);
    else add(boxMesh(0.6, HEIGHT, def.len, wallMat, def.pos, HEIGHT / 2, 0), true);

    const yaw = faceYawInto(def);
    // recessed beveled panels + vertical light pilasters along the wall
    for (let u = -ROOM + 3; u <= ROOM - 3; u += 6) {
      const [px, , pz] = wallPoint(def, u, 0.25, HEIGHT / 2 + 0.2);
      const panel = bevelPanel(4.2, HEIGHT - 1.6, 0.2, panelMat);
      panel.rotation.y = yaw;
      scene.add(place(panel, px, HEIGHT / 2 + 0.2, pz));
      // pilaster between panels
      const [lx, , lz] = wallPoint(def, u + 3, 0.34, HEIGHT / 2);
      scene.add(col(0.08, HEIGHT - 1.2, cyan, lx, HEIGHT / 2, lz));
    }
    // canted skirt at the base (angled lower wall)
    const [sx, , sz] = wallPoint(def, 0, 0.55, 0.55);
    const skirt = boxMesh(def.axis === "x" ? def.len : 0.5, 1.2, def.axis === "x" ? 0.5 : def.len, panelMat, sx, 0.55, sz);
    if (def.axis === "x") skirt.rotation.x = def.inward * 0.35;
    else skirt.rotation.z = -def.inward * 0.35;
    scene.add(skirt);
    // top + bottom light coves
    const [tx, , tz] = wallPoint(def, 0, 0.45, HEIGHT - 0.5);
    scene.add(boxMesh(def.axis === "x" ? def.len - 1 : 0.12, 0.1, def.axis === "x" ? 0.12 : def.len - 1, cyan, tx, HEIGHT - 0.5, tz));
    const [bx, , bz] = wallPoint(def, 0, 0.5, 0.12);
    scene.add(boxMesh(def.axis === "x" ? def.len - 1 : 0.1, 0.08, def.axis === "x" ? 0.1 : def.len - 1, cyan, bx, 0.12, bz));
  }

  // Angled corner panels (cut the boxy corners) + collider.
  for (const [cx, cz, ry] of [[-ROOM, -ROOM, Math.PI / 4], [ROOM, -ROOM, -Math.PI / 4], [-ROOM, ROOM, -Math.PI / 4], [ROOM, ROOM, Math.PI / 4]]) {
    const p = bevelPanel(3.8, HEIGHT, 0.4, panelMat);
    p.rotation.y = ry;
    place(p, cx - Math.sign(cx) * 1.3, HEIGHT / 2, cz - Math.sign(cz) * 1.3);
    add(p, true);
    scene.add(col(0.1, HEIGHT, cyan, cx - Math.sign(cx) * 1.9, HEIGHT / 2, cz - Math.sign(cz) * 1.9));
  }

  // ---------------------------------------------------------------------
  // HEX COLUMNS with tapered glowing capitals + energy collars.
  for (const [hx, hz] of [[-7, 2], [7, 2], [-7, -10], [7, -10]]) {
    add(col(0.55, HEIGHT - 0.6, panelMat, hx, (HEIGHT - 0.6) / 2, hz, 6), true);
    scene.add(col(0.7, 0.4, darkMat, hx, 0.2, hz, 6)); // base
    scene.add(col(0.7, 0.4, darkMat, hx, HEIGHT - 0.6, hz, 6)); // capital
    scene.add(torus(0.62, 0.06, cyan, hx, 1.4, hz).rotateX(Math.PI / 2));
    scene.add(torus(0.62, 0.06, cyan, hx, HEIGHT - 1.4, hz).rotateX(Math.PI / 2));
    scene.add(col(0.06, HEIGHT - 1.2, cyan, hx, HEIGHT / 2, hz)); // glowing core seam
  }

  // --- Holo label + capsule operator -----------------------------------
  function makeLabel(text, color = "#7fd1ff") {
    const c = document.createElement("canvas");
    c.width = 256; c.height = 64;
    const x = c.getContext("2d");
    x.fillStyle = "rgba(8,20,30,0.55)"; x.fillRect(0, 0, 256, 64);
    x.strokeStyle = color; x.lineWidth = 2; x.strokeRect(3, 3, 250, 58);
    x.fillStyle = color; x.fillRect(3, 3, 6, 58);
    x.font = "bold 30px system-ui, sans-serif"; x.textAlign = "center"; x.textBaseline = "middle";
    x.fillText(text, 132, 34);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, depthTest: false }));
    sp.scale.set(1.9, 0.48, 1);
    return sp;
  }

  function makeOperator(x, z, faceYaw, suitColor, visorMat, labelText, labelColor) {
    const g = new THREE.Group();
    const suit = new THREE.MeshStandardMaterial({ color: suitColor, roughness: 0.5, metalness: 0.3 });
    const plate = new THREE.MeshStandardMaterial({ color: 0x2a323c, roughness: 0.45, metalness: 0.45 });
    const torsoM = new THREE.Mesh(new THREE.CapsuleGeometry(0.27, 0.42, 6, 14), suit); torsoM.position.y = 1.3;
    const chestPlate = new THREE.Mesh(new THREE.CapsuleGeometry(0.2, 0.2, 4, 10), plate); chestPlate.position.set(0, 1.34, 0.16); chestPlate.scale.set(1, 1, 0.5);
    const head = sphere(0.2, plate, 0, 1.86, 0);
    const visor = sphere(0.14, visorMat, 0, 1.86, 0.1); visor.scale.set(1, 0.55, 0.6);
    const shoulderL = sphere(0.16, plate, -0.34, 1.5, 0);
    const shoulderR = sphere(0.16, plate, 0.34, 1.5, 0);
    const limb = (r, len, px, py) => { const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 5, 10), suit); m.position.set(px, py, 0); return m; };
    for (const part of [torsoM, chestPlate, head, visor, shoulderL, shoulderR, limb(0.085, 0.42, -0.4, 1.18), limb(0.085, 0.42, 0.4, 1.18), limb(0.12, 0.5, -0.15, 0.45), limb(0.12, 0.5, 0.15, 0.45)]) {
      part.castShadow = true; g.add(part);
    }
    g.position.set(x, 0, z); g.rotation.y = faceYaw; scene.add(g);
    solids.push(torsoM, head);
    const label = makeLabel(labelText, labelColor); label.position.set(x, 2.45, z); scene.add(label);
  }

  // ---------------------------------------------------------------------
  // VENDOR alcove (left wall) — recessed frame, wedge console, holo, NPC.
  function station(side, screenTitle, accent, labelText, labelColor, name, action) {
    const wx = side * (ROOM - 0.7);
    const z = -2;
    const yaw = side > 0 ? -Math.PI / 2 : Math.PI / 2;
    // alcove back-lit recess
    scene.add(place(bevelPanel(5, HEIGHT - 1.4, 0.3, darkMat).rotateY(yaw), wx + side * -0.05, HEIGHT / 2, z));
    scene.add(boxMesh(0.12, 0.1, 5, accent, wx - side * 0.4, HEIGHT - 0.9, z)); // overhead cove
    // wedge console
    const cons = console(3.0);
    cons.rotation.y = yaw;
    add(place(cons, wx - side * 1.0, 0.0, z), true);
    // holo screen on the angled face
    const scr = holoScreen(screenTitle, 4, labelColor);
    const screen = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.0), new THREE.MeshStandardMaterial({ map: scr, emissiveMap: scr, emissive: 0xffffff, emissiveIntensity: 1.1, color: 0x0a1622, side: THREE.DoubleSide }));
    screen.rotation.y = yaw;
    place(screen, wx - side * 1.0, 1.15, z);
    scene.add(screen);
    scene.add(torus(0.9, 0.05, accent, wx - side * 1.0, 1.15, z).rotateY(yaw));
    makeOperator(wx - side * 1.7, z + 1.6, yaw, side > 0 ? 0xc06a1f : 0x2f7fb0, accent, labelText, labelColor);
    interactables.push({ name, action, pos: new THREE.Vector3(wx - side * 2.4, 0, z), radius: 3 });
  }
  station(-1, "ARMORY", cyan, "商人 · 军械", "#7fe0ff", "商人 · 装备售卖", "vendor");
  station(1, "MISSIONS", orange, "任务官 · 行动", "#ffc070", "任务官 · 任务接取", "mission");

  // ---------------------------------------------------------------------
  // DEPLOY PORTAL (far wall) — layered beveled frame + energy field.
  scene.add(place(bevelPanel(6.5, 6.0, 0.5, panelMat), 0, 3.0, -ROOM + 0.4));
  scene.add(place(bevelPanel(5.2, 5.0, 0.4, darkMat), 0, 2.7, -ROOM + 0.6));
  // arched header
  const arch = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 2.4, 0.5, 28, 1, false, 0, Math.PI), panelMat);
  arch.rotation.z = Math.PI; arch.rotation.x = Math.PI / 2;
  add(place(arch, 0, 5.0, -ROOM + 0.45), false);
  scene.add(place(col(2.4, 0.5, hazardMat, 0, 5.0, -ROOM + 0.4, 28, "z"), false));
  // energy field
  const fieldMesh = boxMesh(3.4, 4.2, 0.12, field, 0, 2.4, -ROOM + 0.75);
  scene.add(fieldMesh);
  solids.push(fieldMesh);
  // chevrons + glowing frame
  for (const sgn of [-1, 1]) scene.add(col(0.1, 4.2, orange, sgn * 1.8, 2.4, -ROOM + 0.7));
  scene.add(boxMesh(3.8, 0.12, 0.2, orange, 0, 4.6, -ROOM + 0.7));
  const doorScreen = holoScreen("DEPLOY", 3, "#ffd23f");
  scene.add(boxMesh(1.6, 0.6, 0.05, new THREE.MeshStandardMaterial({ map: doorScreen, emissiveMap: doorScreen, emissive: 0xffffff, emissiveIntensity: 1.1, color: 0x0a1018 }), 0, 0.9, -ROOM + 0.85));
  const doorRing = torus(2.0, 0.08, orange, 0, 2.4, -ROOM + 0.9);
  scene.add(doorRing);
  decor.push({ mesh: doorRing, spin: 0.5 });
  const doorLabel = makeLabel("部署门 · 选择副本", "#ffd23f");
  doorLabel.position.set(0, 5.9, -ROOM + 0.9);
  scene.add(doorLabel);
  interactables.push({ name: "部署门 · 选择副本", action: "deploy", pos: new THREE.Vector3(0, 0, -ROOM + 2.6), radius: 3.5 });

  // ---------------------------------------------------------------------
  // CENTRAL HOLO PROJECTOR (off the main walkway) + rotating rings.
  const PX = 0, PZ = 0;
  add(col(1.3, 0.25, darkMat, PX, 0.12, PZ, 8), true); // octagonal dais
  scene.add(col(1.1, 0.08, cyan, PX, 0.27, PZ, 8));
  scene.add(col(0.12, 1.6, cyan, PX, 1.0, PZ));
  const holoBall = sphere(0.5, glass, PX, 2.0, PZ);
  scene.add(holoBall);
  decor.push({ mesh: holoBall, spin: 0.4, axis: "y" });
  const ring1 = torus(0.9, 0.04, mint, PX, 1.7, PZ);
  const ring2 = torus(1.15, 0.04, cyan, PX, 1.7, PZ); ring2.rotation.x = Math.PI / 2;
  scene.add(ring1, ring2);
  decor.push({ mesh: ring1, spin: 0.7 }, { mesh: ring2, spin: -0.5, axis: "y" });

  // supply props: hex canisters with glowing collars
  for (const [x, z, m] of [[-12.5, 9, cyan], [-11, 10.5, orange], [12.5, 9, mint], [11, 10.5, cyan]]) {
    add(col(0.55, 1.5, panelMat, x, 0.75, z, 6), true);
    scene.add(torus(0.56, 0.05, m, x, 1.2, z).rotateX(Math.PI / 2));
    scene.add(torus(0.56, 0.05, m, x, 0.45, z).rotateX(Math.PI / 2));
  }

  // ---------------------------------------------------------------------
  // TRAINING RANGE (behind spawn).
  const TARGET_HP = 30;
  const RESPAWN_DELAY = 1.5;
  const targetGeo = new THREE.OctahedronGeometry(0.55, 0);
  const targets = [];
  add(boxMesh(12, 0.8, 0.5, panelMat, 0, 0.4, 11.5), true);
  scene.add(boxMesh(12, 0.1, 0.55, cyan, 0, 0.82, 11.5));
  const rangeLabel = makeLabel("训练靶场", "#8effb0");
  rangeLabel.position.set(0, 3.2, 14.5);
  scene.add(rangeLabel);
  const trainSpots = [[-4, 13], [0, 13.6], [4, 13]];
  for (let i = 0; i < trainSpots.length; i += 1) {
    const [tx, tz] = trainSpots[i];
    const mat = new THREE.MeshStandardMaterial({ color: 0xff5a3c, emissive: 0xff6a44, emissiveIntensity: 0.9, roughness: 0.4 });
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
