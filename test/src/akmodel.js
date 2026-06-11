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
// The OBJ is baked in the idle pose, which already points the barrel down -Z,
// so no extra rotation is needed.
// Tuned with an offline previewer that mirrors the in-game camera. The view-
// model is mirrored to a right-handed hold in viewmodel.js (akGroup.scale.x =
// -1), so these values are authored in that mirrored frame: bigger, lower, and
// angled so the gun fills the lower-right and the forearm ends sit off-screen.
const SCALE = 0.03; // GoldSrc units (~inches) -> metres
const ROT = new THREE.Euler(-0.05, -0.72, 0.05);
const POS = new THREE.Vector3(-0.12, -0.45, -0.3);

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

      // Find the muzzle: average of the forward-most (smallest z) vertices, so
      // the flash sits on the barrel tip rather than the bbox centre.
      holder.updateMatrixWorld(true);
      const tmp = new THREE.Vector3();
      let minZ = Infinity;
      const pts = [];
      holder.traverse((o) => {
        if (!o.isMesh) return;
        const pos = o.geometry.attributes.position;
        for (let i = 0; i < pos.count; i += 1) {
          tmp.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld);
          pts.push(tmp.clone());
          if (tmp.z < minZ) minZ = tmp.z;
        }
      });
      let sx = 0;
      let sy = 0;
      let n = 0;
      for (const v of pts) {
        if (v.z < minZ + 0.04) { sx += v.x; sy += v.y; n += 1; }
      }
      const muzzle = new THREE.Vector3(n ? sx / n : 0, n ? sy / n : 0, minZ - 0.02);
      onReady(holder, muzzle);
    },
    undefined,
    onError
  );
}
