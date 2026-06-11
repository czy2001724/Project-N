import * as THREE from "three";

// Procedural first-person view-models with a real arm "skeleton": each weapon
// is gripped by two hands, and each hand is connected back to a shoulder anchor
// (near the bottom of the screen) through an upper-arm + forearm segment with a
// bent elbow. Everything is plain geometry so the toonify pass can cel-shade and
// outline it. No external assets.

const metal = () => new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.42, metalness: 0.75 });
const polymer = () => new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.75, metalness: 0.15 });
const accent = () => new THREE.MeshStandardMaterial({ color: 0x6fd0ff, emissive: 0x2a90c0, emissiveIntensity: 0.85, roughness: 0.4 });
const steel = () => new THREE.MeshStandardMaterial({ color: 0xd2dae2, roughness: 0.25, metalness: 0.9 });
const skin = () => new THREE.MeshStandardMaterial({ color: 0xe6b48c, roughness: 0.7, metalness: 0.0 });
const sleeve = () => new THREE.MeshStandardMaterial({ color: 0x39414e, roughness: 0.85, metalness: 0.1 });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}
function cyl(r, len, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat);
  m.rotation.x = Math.PI / 2;
  m.position.set(x, y, z);
  return m;
}
const V = (x, y, z) => new THREE.Vector3(x, y, z);

const UP = new THREE.Vector3(0, 1, 0);
// A tapered bone spanning two points (a -> b), oriented along the segment.
function bone(a, b, rA, rB, mat) {
  const dir = b.clone().sub(a);
  const len = Math.max(1e-4, dir.length());
  const m = new THREE.Mesh(new THREE.CylinderGeometry(rB, rA, len, 12), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(UP, dir.multiplyScalar(1 / len));
  return m;
}
function joint(pos, r, mat) {
  const m = new THREE.Mesh(new THREE.SphereGeometry(r, 12, 10), mat);
  m.position.copy(pos);
  return m;
}

// A skin-toned hand: palm, four 2-segment fingers curling forward over the
// grip, a thumb, and a short fabric sleeve + glowing cuff at the wrist.
function hand() {
  const g = new THREE.Group();
  const sk = skin();
  g.add(box(0.085, 0.038, 0.095, sk, 0, 0, -0.01)); // back of hand / palm

  const xs = [-0.031, -0.011, 0.011, 0.031];
  const lens = [0.05, 0.056, 0.053, 0.046];
  xs.forEach((fx, i) => {
    const knuckle = box(0.017, 0.02, lens[i], sk, fx, 0.002, -0.07);
    knuckle.rotation.x = -0.55; // angle down over the front
    g.add(knuckle);
    const tip = box(0.016, 0.018, 0.03, sk, fx, -0.03, -0.095);
    tip.rotation.x = -1.15; // curl under (wrapping the grip)
    g.add(tip);
  });

  const thumb = box(0.021, 0.021, 0.052, sk, 0.05, 0.006, -0.02);
  thumb.rotation.z = 0.5;
  thumb.rotation.x = -0.35;
  g.add(thumb);
  return g;
}

// A full arm: hand at `handPos/handRot`, connected back to `shoulder` through a
// bent elbow. The elbow is pushed outward/down so the forearm reads naturally.
function arm(handPos, handRot, shoulder, side) {
  const g = new THREE.Group();
  const sk = skin();
  const sl = sleeve();

  const h = hand();
  h.position.copy(handPos);
  h.rotation.set(handRot[0], handRot[1], handRot[2] || 0);
  g.add(h);

  // wrist sits just behind the hand (where the sleeve cuff meets the arm)
  const wrist = handPos.clone().add(V(0, 0.01, 0.08));
  // elbow: midpoint of shoulder->wrist, pushed out to the side and down
  const mid = shoulder.clone().lerp(wrist, 0.5);
  const elbow = mid.add(V(side * 0.08, -0.05, 0.02));

  g.add(bone(elbow, wrist, 0.05, 0.045, sk)); // forearm (skin near wrist)
  g.add(bone(shoulder, elbow, 0.075, 0.055, sl)); // upper arm (sleeved)
  g.add(joint(elbow, 0.052, sl)); // elbow pad
  g.add(joint(shoulder, 0.085, sl)); // shoulder / deltoid
  // glowing wrist cuff
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 18), accent());
  cuff.position.copy(wrist);
  cuff.rotation.copy(h.rotation);
  g.add(cuff);
  return g;
}

// Shoulder anchors in weapon-group local space (the group is parented under the
// camera and offset toward bottom-right; these sit low + near the camera so the
// arms recede from the bottom corners up to the hands).
const SH_R = V(0.12, -0.46, 0.30);
const SH_L = V(-0.16, -0.44, 0.26);

// muzzle flash: a flat emissive star, hidden until fired.
function makeFlash(pos) {
  const g = new THREE.Group();
  g.position.copy(pos);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffe7a0, transparent: true, opacity: 0, depthWrite: false });
  const core = new THREE.Mesh(new THREE.CircleGeometry(0.09, 16), mat);
  g.add(core);
  const blades = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.05), mat);
  g.add(blades);
  const blades2 = new THREE.Mesh(new THREE.PlaneGeometry(0.05, 0.34), mat);
  g.add(blades2);
  g.visible = false;
  g.userData.mat = mat;
  return g;
}

export function buildRifle() {
  const g = new THREE.Group();
  const mMetal = metal();
  const mPoly = polymer();

  g.add(box(0.12, 0.14, 0.46, mMetal, 0, 0, -0.08)); // receiver
  g.add(cyl(0.028, 0.5, mMetal, 0, 0.03, -0.5)); // barrel
  g.add(cyl(0.05, 0.26, mPoly, 0, 0.03, -0.34)); // handguard
  const grip = box(0.08, 0.2, 0.1, mPoly, 0, -0.17, 0.06);
  grip.rotation.x = 0.32;
  g.add(grip);
  const mag = box(0.07, 0.26, 0.12, mMetal, 0, -0.22, -0.14);
  mag.rotation.x = -0.18;
  g.add(mag);
  g.add(box(0.08, 0.13, 0.24, mPoly, 0, -0.02, 0.26)); // stock
  g.add(box(0.12, 0.02, 0.34, mMetal, 0, 0.11, -0.12)); // rail
  g.add(box(0.02, 0.06, 0.02, accent(), 0, 0.16, -0.02));
  g.add(box(0.02, 0.05, 0.02, accent(), 0, 0.15, -0.26));

  const rHand = V(0.0, -0.13, 0.07);
  const lHand = V(0.0, 0.05, -0.34);
  g.add(arm(rHand, [-0.35, -0.1, 0], SH_R, 1)); // right hand on grip
  g.add(arm(lHand, [-1.2, 0.1, 0], SH_L, -1)); // left hand over the handguard

  const muzzle = V(0, 0.03, -0.76);
  const flash = makeFlash(muzzle);
  g.add(flash);
  return { group: g, muzzle, flash };
}

export function buildPistol() {
  const g = new THREE.Group();
  const mMetal = metal();
  const mPoly = polymer();

  g.add(box(0.09, 0.1, 0.34, mMetal, 0, 0.02, -0.12)); // slide
  g.add(cyl(0.02, 0.12, mMetal, 0, 0.02, -0.3)); // barrel
  g.add(box(0.08, 0.07, 0.3, mPoly, 0, -0.05, -0.08)); // frame
  const grip = box(0.08, 0.2, 0.12, mPoly, 0, -0.17, 0.04);
  grip.rotation.x = 0.28;
  g.add(grip);
  g.add(box(0.02, 0.035, 0.02, accent(), 0, 0.08, -0.26));
  g.add(box(0.05, 0.03, 0.02, accent(), 0, 0.08, 0.0));

  const rHand = V(0.01, -0.15, 0.05);
  const lHand = V(-0.06, -0.13, 0.0);
  g.add(arm(rHand, [-0.4, -0.1, 0], SH_R, 1)); // right hand on grip
  g.add(arm(lHand, [-0.5, 0.35, 0], SH_L, -1)); // left support hand

  const muzzle = V(0, 0.02, -0.38);
  const flash = makeFlash(muzzle);
  g.add(flash);
  return { group: g, muzzle, flash };
}

// Sci-fi katana. The handle (tsuka) + tsuba sit by the hands at rest; the
// blade is a separate group (returned) that the weapon system "draws" out
// and sweeps on attack.
export function buildKnife() {
  const g = new THREE.Group();
  const inner = new THREE.Group(); // idle pose: held low at the side
  g.add(inner);

  const bladeMat = steel();
  const dark = metal();

  // --- handle assembly (always visible) ---
  const tsuba = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.02, 8), dark);
  tsuba.rotation.x = Math.PI / 2;
  tsuba.position.z = -0.04;
  inner.add(tsuba);
  inner.add(new THREE.Mesh(new THREE.TorusGeometry(0.072, 0.01, 8, 8), accent()).translateZ(-0.03));

  const tsuka = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.028, 0.28, 8), polymer());
  tsuka.rotation.x = Math.PI / 2;
  tsuka.position.z = 0.12;
  inner.add(tsuka);
  // wrap diamonds (glowing) along the handle
  for (let i = 0; i < 4; i += 1) {
    inner.add(box(0.07, 0.07, 0.018, accent(), 0, 0, 0.02 + i * 0.06).rotateZ(Math.PI / 4));
  }
  const pommel = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.03, 8), dark).rotateX(Math.PI / 2);
  pommel.position.set(0, 0, 0.27);
  inner.add(pommel);

  // --- blade group (drawn out on attack) ---
  const blade = new THREE.Group();
  const b1 = box(0.016, 0.06, 0.5, bladeMat, 0, 0.0, -0.32);
  blade.add(b1);
  const b2 = box(0.014, 0.05, 0.34, bladeMat, 0, 0.03, -0.72);
  b2.rotation.x = -0.12; // curved tip
  blade.add(b2);
  blade.add(box(0.006, 0.012, 0.46, accent(), 0, -0.03, -0.32));
  blade.add(box(0.006, 0.012, 0.3, accent(), 0, 0.0, -0.72).rotateX(-0.12));
  blade.position.z = -0.06; // grows out from the tsuba
  inner.add(blade);

  // idle: katana held low to the right, blade angled back (sheathed look)
  inner.rotation.set(0.25, -0.55, -0.5);
  inner.position.set(0.12, -0.16, 0.16);

  // two hands stacked on the tsuka, each connected to a shoulder
  inner.add(arm(V(0, -0.01, 0.1), [-0.2, 0, 0], SH_R.clone().applyAxisAngle(UP, 0.55), 1));
  inner.add(arm(V(0, -0.01, 0.22), [-0.2, 0, 0], SH_L.clone().applyAxisAngle(UP, 0.55), -1));

  return { group: g, muzzle: V(0, 0, -1.0), blade };
}
