import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

// Loads the real CS 1.6 AK view-model (converted from GoldSrc v_ak47.mdl to
// OBJ + textures) and normalises it into camera space: scaled, rotated so the
// barrel points into the screen, and aligned so the gloved-hand end sits just
// in front of the eye. Returns the prepared group + muzzle point via callback.
//
// Textures are loaded by hand (not via MTL) and matched to each material group
// by name ("texN" -> TEX[N]), so the gun isn't a black blob from a bad MTL path.

// texture index N (from the converter) -> file in assets/ak/
const TEX = [
  "view_glove.png", "view_skin.png", "view_finger.png",
  "QS_AK1.png", "QS_AK2.png", "QS_AK3.png", "QS_AK4.png", "QS_AK5.png",
];

// --- tunables (adjust after a playtest screenshot) ---
const SCALE = 0.019; // GoldSrc units (~inches) -> metres
const ROT = new THREE.Euler(0.0, Math.PI / 2, 0.0); // barrel +X -> -Z (into screen)
const POS = new THREE.Vector3(0.17, -0.2, -0.26); // where the near (hand) end sits

export function loadAK(onReady, onError) {
  const texLoader = new THREE.TextureLoader().setPath("assets/ak/");
  const cache = {};
  function tex(i) {
    if (!cache[i]) {
      const t = texLoader.load(TEX[i] || TEX[3]);
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = true;
      cache[i] = t;
    }
    return cache[i];
  }
  function basicFor(name) {
    const m = /tex(\d+)/.exec(name || "");
    const ti = m ? parseInt(m[1], 10) : 3;
    return new THREE.MeshBasicMaterial({
      map: tex(ti),
      transparent: true,
      alphaTest: 0.5,
      side: THREE.DoubleSide,
    });
  }

  const obj = new OBJLoader().setPath("assets/ak/");
  obj.load(
    "v_ak47.obj",
    (root) => {
      root.traverse((o) => {
        if (!o.isMesh) return;
        o.material = Array.isArray(o.material)
          ? o.material.map((mm) => basicFor(mm.name))
          : basicFor(o.material.name);
        o.raycast = () => {}; // never block shooting rays
      });

      const holder = new THREE.Group();
      root.scale.setScalar(SCALE);
      root.rotation.copy(ROT);
      holder.add(root);

      // Centre horizontally/vertically on POS and push the near end to POS.z.
      const box = new THREE.Box3().setFromObject(holder);
      const c = box.getCenter(new THREE.Vector3());
      root.position.x += POS.x - c.x;
      root.position.y += POS.y - c.y;
      root.position.z += POS.z - box.max.z;

      const box2 = new THREE.Box3().setFromObject(holder);
      const muzzle = new THREE.Vector3(
        (box2.min.x + box2.max.x) / 2,
        (box2.min.y + box2.max.y) / 2,
        box2.min.z
      );
      onReady(holder, muzzle);
    },
    undefined,
    onError
  );
}
