import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

// Loads the real CS 1.6 AK view-model (converted from GoldSrc v_ak47.mdl to
// OBJ + textures) and normalises it into camera space. On the web it fetches
// the OBJ/textures from assets/ak/; in the packaged desktop build the assets are
// embedded as window.__PN_AK_ASSETS__ (OBJ string + texture data URIs) so it
// works fully offline with no fetch.

// texture index N (from the converter) -> file in assets/ak/
const TEX = [
  "view_glove.png", "view_skin.png", "view_finger.png",
  "QS_AK1.png", "QS_AK2.png", "QS_AK3.png", "QS_AK4.png", "QS_AK5.png",
];

// Hold tuned by hand in tools/aim.html (mirror = true is applied in viewmodel.js).
const SCALE = 0.127; // GoldSrc units (~inches) -> metres
const ROT = new THREE.Euler(0, 0.02, 0);
const POS = new THREE.Vector3(-0.625, -1.055, 0.345);

export function loadAK(onReady, onError) {
  const EMB = (typeof window !== "undefined") ? window.__PN_AK_ASSETS__ : null;

  const texLoader = new THREE.TextureLoader();
  if (!EMB) texLoader.setPath("assets/ak/");
  const cache = {};
  function tex(i) {
    if (!cache[i]) {
      const name = TEX[i] || TEX[3];
      const src = EMB ? EMB.tex[name] : name; // data URI when embedded
      const t = texLoader.load(src);
      t.colorSpace = THREE.SRGBColorSpace;
      t.flipY = true;
      cache[i] = t;
    }
    return cache[i];
  }
  function basicFor(name) {
    const m = /tex(\d+)/.exec(name || "");
    const ti = m ? parseInt(m[1], 10) : 3;
    // Arm meshes (textures 0-2) use a clean uniform skin tone instead of the
    // gritty CS glove/skin textures; the gun keeps its gold texture.
    if (ti < 3) {
      return new THREE.MeshToonMaterial({ color: 0xeac09a, emissive: 0x241a10, side: THREE.DoubleSide });
    }
    return new THREE.MeshBasicMaterial({
      map: tex(ti), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide,
    });
  }

  function finish(root) {
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

    // Find the muzzle: average of the forward-most (smallest z) vertices.
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
    let sx = 0, sy = 0, n = 0;
    for (const v of pts) {
      if (v.z < minZ + 0.04) { sx += v.x; sy += v.y; n += 1; }
    }
    const muzzle = new THREE.Vector3(n ? sx / n : 0, n ? sy / n : 0, minZ - 0.02);
    onReady(holder, muzzle);
  }

  if (EMB) {
    try { finish(new OBJLoader().parse(EMB.obj)); }
    catch (e) { if (onError) onError(e); }
  } else {
    new OBJLoader().setPath("assets/ak/").load("v_ak47.obj", finish, undefined, onError);
  }
}
