import * as THREE from "three";
import { buildRifle, buildPistol, buildKnife, makeFlash } from "./models.js?v=DEV";
import { loadAK } from "./akmodel.js?v=DEV";

// 3D first-person view-model. Each weapon is a real mesh gripped by rigged arms
// (see models.js), parented under the camera. A `poseGroup` applies the live
// recoil / sway / reload / switch transform every frame. This replaces the old
// flat 2D canvas overlay so hands actually sit on the weapon in perspective.

// Base placement of each weapon in camera space (eye at origin, -Z forward).
const BASE = {
  rifle: { pos: new THREE.Vector3(0.15, -0.17, -0.5), rot: new THREE.Euler(0.02, 0.06, 0.02) },
  pistol: { pos: new THREE.Vector3(0.12, -0.19, -0.45), rot: new THREE.Euler(0.0, 0.05, 0.0) },
  knife: { pos: new THREE.Vector3(0.0, 0.0, -0.4), rot: new THREE.Euler(0.0, 0.0, 0.0) },
};

export function createViewmodel(camera) {
  const root = new THREE.Group();
  camera.add(root);

  const poseGroup = new THREE.Group(); // live pose (recoil/sway/switch) lives here
  root.add(poseGroup);

  const builders = { rifle: buildRifle, pistol: buildPistol, knife: buildKnife };
  const built = {};
  for (const id of Object.keys(builders)) {
    const b = builders[id]();
    const base = BASE[id];
    b.group.position.copy(base.pos);
    b.group.rotation.copy(base.rot);
    b.group.visible = false;
    poseGroup.add(b.group);
    built[id] = b;
  }

  let currentId = null;
  let flashT = 0;
  // While the AK is still loading we hide the rifle entirely (rather than flash
  // the procedural placeholder). It's revealed once the AK swaps in, or if the
  // load fails and we fall back to the procedural rifle.
  let akState = "loading"; // loading | ready | failed

  function show(id) {
    for (const k of Object.keys(built)) {
      const hideLoadingRifle = id === "rifle" && akState === "loading";
      built[k].group.visible = k === id && !hideLoadingRifle;
    }
    currentId = id;
  }

  // Swap the procedural rifle for the real gold AK (with its own CS arms/hands)
  // once it loads.
  loadAK(
    (holder, muzzle) => {
      const flash = makeFlash(muzzle);
      const akGroup = new THREE.Group();
      akGroup.add(holder);
      akGroup.add(flash);
      poseGroup.remove(built.rifle.group);
      poseGroup.add(akGroup);
      built.rifle = { group: akGroup, muzzle, flash };
      akState = "ready";
      if (currentId === "rifle") show("rifle");
    },
    (err) => {
      console.warn("AK model failed to load, keeping procedural rifle:", err);
      akState = "failed";
      if (currentId === "rifle") show("rifle");
    }
  );

  return {
    setWeapon(id) {
      this._id = id;
      show(id);
    },
    // CF-style knife: the blade is always visible, so this is a no-op kept for
    // API compatibility with the weapon system.
    setBladeDrawn() {},
    // Live pose, in metres / radians, applied on top of each weapon's base.
    setPose({ posX = 0, posY = 0, posZ = 0, rotX = 0, rotY = 0, rotZ = 0 }) {
      poseGroup.position.set(posX, posY, posZ);
      poseGroup.rotation.set(rotX, rotY, rotZ);
    },
    flash() {
      flashT = 0.06;
      const f = built[currentId] && built[currentId].flash;
      if (f) {
        f.visible = true;
        f.rotation.z = Math.random() * Math.PI; // spin the star a bit each shot
        f.userData.mat.opacity = 1;
      }
    },
    // Called every frame to fade the muzzle flash.
    tick(dt) {
      if (flashT > 0) {
        flashT -= dt;
        const f = built[currentId] && built[currentId].flash;
        if (f) {
          const k = Math.max(0, flashT / 0.06);
          f.userData.mat.opacity = k;
          f.scale.setScalar(0.8 + (1 - k) * 0.6);
          if (flashT <= 0) f.visible = false;
        }
      }
    },
  };
}
