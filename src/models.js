import * as THREE from "three";

// Procedural first-person view-models: rifle / pistol / tech blade, each
// held by gloved hands+forearms (CS / CF style). No external assets; the
// toonify pass cel-shades and outlines everything.

const metal = () => new THREE.MeshStandardMaterial({ color: 0x23272e, roughness: 0.42, metalness: 0.75 });
const polymer = () => new THREE.MeshStandardMaterial({ color: 0x2b2f36, roughness: 0.75, metalness: 0.15 });
const accent = () => new THREE.MeshStandardMaterial({ color: 0x6fd0ff, emissive: 0x2a90c0, emissiveIntensity: 0.8, roughness: 0.4 });
const steel = () => new THREE.MeshStandardMaterial({ color: 0xc8d2dc, roughness: 0.25, metalness: 0.9 });
const glove = () => new THREE.MeshStandardMaterial({ color: 0x2b3039, roughness: 0.8, metalness: 0.1 });

function box(w, h, d, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), mat);
  m.position.set(x, y, z);
  return m;
}

function cyl(r, len, mat, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14), mat);
  m.rotation.x = Math.PI / 2; // along -Z
  m.position.set(x, y, z);
  return m;
}

// A gloved hand (palm + curled fingers + thumb + knuckle accent).
function gloveHand() {
  const g = new THREE.Group();
  const m = glove();
  g.add(box(0.08, 0.05, 0.12, m)); // palm
  g.add(box(0.076, 0.018, 0.06, accent(), 0, 0.033, -0.02)); // knuckle plate glow
  for (let i = 0; i < 4; i += 1) {
    const f = box(0.017, 0.055, 0.038, m, -0.028 + i * 0.019, -0.025, -0.075);
    f.rotation.x = 1.0; // curled over
    g.add(f);
  }
  const thumb = box(0.02, 0.045, 0.05, m, 0.045, 0.0, -0.005);
  thumb.rotation.z = 0.7;
  g.add(thumb);
  return g;
}

// A full arm: gloved hand + forearm capsule + glowing cuff, posed via rot.
function arm(pos, rotX, rotY) {
  const a = new THREE.Group();
  a.add(gloveHand());
  const fore = new THREE.Mesh(new THREE.CapsuleGeometry(0.05, 0.3, 6, 12), glove());
  fore.rotation.x = Math.PI / 2;
  fore.position.set(0, -0.01, 0.22);
  a.add(fore);
  const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.058, 0.012, 8, 18), accent());
  cuff.position.set(0, -0.01, 0.08);
  a.add(cuff);
  a.position.copy(pos);
  a.rotation.set(rotX, rotY, 0);
  return a;
}

const V = (x, y, z) => new THREE.Vector3(x, y, z);

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
  g.add(box(0.12, 0.02, 0.34, mMetal, 0, 0.11, -0.12)); // top rail
  g.add(box(0.02, 0.06, 0.02, accent(), 0, 0.16, -0.02)); // rear sight
  g.add(box(0.02, 0.05, 0.02, accent(), 0, 0.15, -0.26)); // front sight

  g.add(arm(V(0.02, -0.16, 0.06), -0.5, -0.15)); // right hand on grip
  g.add(arm(V(-0.02, -0.04, -0.32), -0.75, 0.3)); // left hand on handguard

  return { group: g, muzzle: V(0, 0.03, -0.76) };
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

  g.add(box(0.02, 0.035, 0.02, accent(), 0, 0.08, -0.26)); // front sight
  g.add(box(0.05, 0.03, 0.02, accent(), 0, 0.08, 0.0)); // rear sight

  g.add(arm(V(0.035, -0.15, 0.05), -0.5, -0.1)); // right hand on grip
  g.add(arm(V(-0.045, -0.12, 0.0), -0.6, 0.25)); // left support hand

  return { group: g, muzzle: V(0, 0.02, -0.38) };
}

// Faceted high-tech long blade (科技长刀).
export function buildKnife() {
  const g = new THREE.Group();
  const mSteel = steel();
  const mDark = metal();

  // faceted tapered blade — 4-sided prism, flattened, pointing forward
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.055, 0.82, 4), mSteel);
  blade.scale.set(0.32, 1, 1); // flatten to a blade profile
  blade.rotation.x = -Math.PI / 2; // length along -Z
  blade.position.set(0, 0.02, -0.52);
  g.add(blade);
  // glowing energy fuller down the blade
  g.add(box(0.006, 0.014, 0.66, accent(), 0, 0.02, -0.48));

  // angular crossguard (faceted bar)
  const guard = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.17, 6), mDark);
  guard.rotation.z = Math.PI / 2;
  guard.position.set(0, 0.02, -0.1);
  g.add(guard);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.034, 0.008, 8, 18), accent());
  ring.position.set(0, 0.02, -0.09);
  g.add(ring);

  // hex handle + pommel
  const handle = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.024, 0.2, 6), polymer());
  handle.rotation.x = Math.PI / 2;
  handle.position.set(0, -0.01, 0.02);
  g.add(handle);
  g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 6), mDark).translateY(-0.01).translateZ(0.12));

  g.add(arm(V(0.0, -0.03, 0.05), -0.5, -0.05)); // hand on handle

  return { group: g, muzzle: V(0, 0.02, -0.92) };
}
