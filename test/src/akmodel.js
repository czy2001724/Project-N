import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";
import { MTLLoader } from "three/addons/loaders/MTLLoader.js";

// Loads the real CS 1.6 AK view-model (converted from GoldSrc v_ak47.mdl to
// OBJ + textures) and normalises it into camera space: scaled, rotated so the
// barrel points into the screen, and aligned so the gloved-hand end sits just
// in front of the eye. Returns the prepared group + muzzle point via callback.

// --- tunables (adjust after a playtest screenshot) ---
const SCALE = 0.02; // GoldSrc units (~inches) -> metres
const ROT = new THREE.Euler(0.0, Math.PI / 2, 0.0); // barrel +X -> -Z (into screen)
const POS = new THREE.Vector3(0.12, -0.18, -0.22); // where the near (hand) end sits

export function loadAK(onReady, onError) {
  const mtl = new MTLLoader();
  mtl.setPath("assets/ak/");
  mtl.load(
    "v_ak47.mtl",
    (materials) => {
      materials.preload();
      const obj = new OBJLoader();
      obj.setMaterials(materials);
      obj.setPath("assets/ak/");
      obj.load(
        "v_ak47.obj",
        (root) => {
          // Replace lit materials with unlit textured ones so the model is
          // always clearly visible regardless of scene lighting; honour the
          // masked (transparent) areas of the glove textures.
          root.traverse((o) => {
            if (!o.isMesh) return;
            const src = Array.isArray(o.material) ? o.material[0] : o.material;
            o.material = new THREE.MeshBasicMaterial({
              map: src ? src.map : null,
              transparent: true,
              alphaTest: 0.5,
              side: THREE.DoubleSide,
            });
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
    },
    undefined,
    onError
  );
}
