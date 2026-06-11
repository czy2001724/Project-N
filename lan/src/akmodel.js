import * as THREE from "three";
import { OBJLoader } from "three/addons/loaders/OBJLoader.js";

// Loads the CS 1.6 AK view-model, split into a gun body and the arms so the arm
// placement can be nudged independently (see tools/arm.html). On the web the
// two OBJs + textures are fetched from assets/ak/; in the packaged build they
// are embedded as window.__PN_AK_ASSETS__ { gun, arms, tex }.

const TEX = [
  "view_glove.png", "view_skin.png", "view_finger.png",
  "QS_AK1.png", "QS_AK2.png", "QS_AK3.png", "QS_AK4.png", "QS_AK5.png",
];

// Whole-model placement (tuned in tools/aim.html; mirror is applied in viewmodel.js).
const SCALE = 0.127;
const ROT = new THREE.Euler(0, 0.02, 0);
const POS = new THREE.Vector3(-0.625, -1.055, 0.345);

export function loadAK(onReady, onError) {
  const EMB = (typeof window !== "undefined") ? window.__PN_AK_ASSETS__ : null;
  // Independent arm offset (in gun-local OBJ units), tuned in tools/arm.html.
  const A = (typeof window !== "undefined" && window.__PN_ARM__) || { px: 0, py: 0, pz: 0, rx: 0, ry: 0, rz: 0 };

  const SKIN_HEX = { gold: 0xffffff, black: 0x34353c };
  const gunMats = [];
  const skin = (typeof window !== "undefined" && window.__PN_AK_SKIN__) || "black";

  const texLoader = new THREE.TextureLoader();
  if (!EMB) texLoader.setPath("assets/ak/");
  const cache = {};
  function tex(i) {
    if (!cache[i]) {
      const name = TEX[i] || TEX[3];
      const t = texLoader.load(EMB ? EMB.tex[name] : name);
      t.colorSpace = THREE.SRGBColorSpace; t.flipY = true;
      cache[i] = t;
    }
    return cache[i];
  }
  function gunMatFor(name) {
    const m = /tex(\d+)/.exec(name || ""); const ti = m ? parseInt(m[1], 10) : 3;
    const gm = new THREE.MeshBasicMaterial({ map: tex(ti), transparent: true, alphaTest: 0.5, side: THREE.DoubleSide });
    gm.color.setHex(SKIN_HEX[skin] || SKIN_HEX.black);
    gunMats.push(gm);
    return gm;
  }
  const armMat = () => new THREE.MeshStandardMaterial({ color: 0xd9a578, roughness: 0.75, metalness: 0.0, side: THREE.DoubleSide });

  function applyMat(root, factory) {
    root.traverse((o) => {
      if (!o.isMesh) return;
      o.material = Array.isArray(o.material) ? o.material.map((mm) => factory(mm.name)) : factory(o.material.name);
      o.raycast = () => {};
    });
  }

  function build(gunRoot, armRoot) {
    applyMat(gunRoot, gunMatFor);
    applyMat(armRoot, () => armMat());

    const inner = new THREE.Group();
    inner.add(gunRoot);
    const armWrap = new THREE.Group();
    armWrap.position.set(A.px, A.py, A.pz);
    armWrap.rotation.set(A.rx, A.ry, A.rz);
    armWrap.add(armRoot);
    inner.add(armWrap);
    inner.scale.setScalar(SCALE);
    inner.rotation.copy(ROT);

    const holder = new THREE.Group();
    holder.add(inner);

    // centre on POS, push near end to POS.z
    const box = new THREE.Box3().setFromObject(holder);
    const c = box.getCenter(new THREE.Vector3());
    inner.position.x += POS.x - c.x;
    inner.position.y += POS.y - c.y;
    inner.position.z += POS.z - box.max.z;

    // muzzle: forward-most gun vertices
    holder.updateMatrixWorld(true);
    const tmp = new THREE.Vector3(); let minZ = Infinity; const pts = [];
    gunRoot.traverse((o) => {
      if (!o.isMesh) return;
      const pos = o.geometry.attributes.position;
      for (let i = 0; i < pos.count; i += 1) { tmp.fromBufferAttribute(pos, i).applyMatrix4(o.matrixWorld); pts.push(tmp.clone()); if (tmp.z < minZ) minZ = tmp.z; }
    });
    let sx = 0, sy = 0, n = 0;
    for (const v of pts) if (v.z < minZ + 0.04) { sx += v.x; sy += v.y; n += 1; }
    const muzzle = new THREE.Vector3(n ? sx / n : 0, n ? sy / n : 0, minZ - 0.02);

    if (typeof window !== "undefined") {
      window.__PN_SET_AK_SKIN__ = (s) => { const hex = SKIN_HEX[s] || SKIN_HEX.black; gunMats.forEach((m) => m.color.setHex(hex)); };
      window.__PN_SET_ARM__ = (px, py, pz, rx, ry, rz) => { armWrap.position.set(px, py, pz); armWrap.rotation.set(rx, ry, rz); };
    }
    onReady(holder, muzzle);
  }

  function loadOne(name, embStr, cb) {
    if (EMB) { try { cb(new OBJLoader().parse(embStr)); } catch (e) { if (onError) onError(e); } }
    else new OBJLoader().setPath("assets/ak/").load(name, cb, undefined, onError);
  }
  loadOne("v_ak47_gun.obj", EMB && EMB.gun, (gunRoot) => {
    loadOne("v_ak47_arms.obj", EMB && EMB.arms, (armRoot) => build(gunRoot, armRoot));
  });
}
