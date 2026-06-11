import * as THREE from "three";

// Procedural view-model builders. No external assets, so it stays a
// zero-dependency static site, but the shapes are detailed enough to read
// clearly as a rifle / pistol / knife in first person.

const metal = () => new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.42, metalness: 0.75 });
const polymer = () => new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.75, metalness: 0.15 });
const accent = () => new THREE.MeshStandardMaterial({ color: 0x6fd0ff, emissive: 0x2a90c0, emissiveIntensity: 0.9, roughness: 0.4 });
const steel = () => new THREE.MeshStandardMaterial({ color: 0xc8d2dc, roughness: 0.25, metalness: 0.9 });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(r, len, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat);
  m.rotation.x = Math.PI / 2; // align along -Z (forward)
  m.position.set(x, y, z);
  return m;
}

// Returns { group, muzzle } where muzzle is a local point at the barrel tip.
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

  const stock = box(0.08, 0.13, 0.24, mPoly, 0, -0.02, 0.26);
  g.add(stock);

  g.add(box(0.12, 0.02, 0.34, mMetal, 0, 0.11, -0.12)); // top rail
  g.add(box(0.02, 0.06, 0.02, accent(), 0, 0.16, -0.02)); // rear sight glow
  g.add(box(0.02, 0.05, 0.02, accent(), 0, 0.15, -0.26)); // front sight glow

  return { group: g, muzzle: new THREE.Vector3(0, 0.03, -0.76) };
}

export function buildPistol() {
  const g = new THREE.Group();
  const mMetal = metal();
  const mPoly = polymer();

  g.add(box(0.09, 0.1, 0.34, mMetal, 0, 0.02, -0.12)); // slide
  g.add(cyl(0.02, 0.12, mMetal, 0, 0.02, -0.3)); // barrel tip
  g.add(box(0.08, 0.07, 0.3, mPoly, 0, -0.05, -0.08)); // frame

  const grip = box(0.08, 0.2, 0.12, mPoly, 0, -0.17, 0.04);
  grip.rotation.x = 0.28;
  g.add(grip);

  g.add(box(0.02, 0.035, 0.02, accent(), 0, 0.08, -0.26)); // front sight glow
  g.add(box(0.05, 0.03, 0.02, accent(), 0, 0.08, 0.0)); // rear sight glow

  return { group: g, muzzle: new THREE.Vector3(0, 0.02, -0.38) };
}

export function buildKnife() {
  const g = new THREE.Group();
  const mSteel = steel();
  const mPoly = polymer();

  // tapered blade
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.42), mSteel);
  blade.position.set(0, 0.02, -0.3);
  g.add(blade);
  const tip = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.12, 4), mSteel);
  tip.rotation.x = -Math.PI / 2;
  tip.position.set(0, 0.02, -0.56);
  g.add(tip);

  g.add(box(0.09, 0.03, 0.04, metal(), 0, 0.02, -0.08)); // guard
  const handle = box(0.04, 0.05, 0.16, mPoly, 0, -0.02, 0.02);
  g.add(handle);
  g.add(box(0.02, 0.02, 0.16, accent(), 0.026, -0.02, 0.02)); // accent stripe

  return { group: g, muzzle: new THREE.Vector3(0, 0.02, -0.62) };
}
