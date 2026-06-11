import * as THREE from "three";
import { createViewmodel } from "./viewmodel.js?v=DEV";

// Weapon definitions. mode drives trigger behaviour:
//   auto  -> fires continuously while held
//   semi  -> one shot per press
//   melee -> draw-slash on press
const DEFS = [
  { id: "rifle", name: "步枪", mode: "auto", damage: 14, fireRate: 0.1, mag: 30, reserve: 150, reload: 1.4, range: 120, recoil: 0.05, kick: 0.012 },
  { id: "pistol", name: "手枪", mode: "semi", damage: 26, fireRate: 0.2, mag: 12, reserve: 96, reload: 1.0, range: 90, recoil: 0.08, kick: 0.022 },
  { id: "knife", name: "近战刀", mode: "melee", damage: 150, fireRate: 0.5, range: 2.4 },
];

export function createWeapons(camera, scene, world, player, hooks = {}) {
  const ray = new THREE.Raycaster();
  const screenCenter = new THREE.Vector2(0, 0);
  const vm = createViewmodel(); // 2D image view-model (hands + weapon)

  // Camera-attached muzzle light: lights the scene briefly on fire.
  const muzzle = new THREE.PointLight(0xffd070, 0, 8, 2);
  muzzle.position.set(0, -0.1, -0.6);
  camera.add(muzzle);

  // 3D impact sparks at hit points.
  const impacts = [];
  const sparkGeo = new THREE.SphereGeometry(0.06, 6, 6);
  function spawnImpact(point) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 1 });
    const spark = new THREE.Mesh(sparkGeo, mat);
    spark.position.copy(point);
    scene.add(spark);
    impacts.push({ mesh: spark, life: 0.25, max: 0.25 });
  }

  const weapons = DEFS.map((def) => ({
    def,
    ammo: def.mag ?? 0,
    reserve: def.reserve ?? 0,
    reloading: false,
    reloadStart: 0,
    lastShot: -1,
    firing: false,
    recoil: 0,
    swing: 0,
  }));

  let current = weapons[0];
  vm.setWeapon(current.def.id);

  const SWITCH_TIME = 0.16;
  let equipT = 0;
  let equipPhase = "idle";
  let pendingIndex = -1;

  function damageAt(range, damage) {
    ray.setFromCamera(screenCenter, camera);
    ray.far = range;
    const hits = ray.intersectObjects(world.getHittables(), false);
    if (hits.length === 0) return;
    const hit = hits[0];
    spawnImpact(hit.point);
    const obj = hit.object;
    if (obj.userData && obj.userData.type === "target") {
      const killed = world.damageTarget(obj, damage);
      if (hooks.onHitmarker) hooks.onHitmarker(killed);
    }
  }

  function reload() {
    const w = current;
    if (w.def.mode === "melee" || w.reloading || equipPhase !== "idle") return;
    if (w.ammo === w.def.mag || w.reserve === 0) return;
    w.reloading = true;
    w.reloadStart = performance.now() / 1000;
    setTimeout(() => {
      const need = w.def.mag - w.ammo;
      const take = Math.min(need, w.reserve);
      w.ammo += take;
      w.reserve -= take;
      w.reloading = false;
    }, w.def.reload * 1000);
  }

  function fireRanged(time) {
    const w = current;
    if (w.reloading || time - w.lastShot < w.def.fireRate) return;
    if (w.ammo <= 0) {
      reload();
      return;
    }
    w.lastShot = time;
    w.ammo -= 1;
    w.recoil = Math.min(w.recoil + w.def.recoil, 0.16);
    player.addPitch(w.def.kick);
    muzzle.intensity = 4.5;
    vm.flash();
    damageAt(w.def.range, w.def.damage);
  }

  function meleeSwing(time) {
    const w = current;
    if (time - w.lastShot < w.def.fireRate) return;
    w.lastShot = time;
    w.swing = 1;
    damageAt(w.def.range, w.def.damage);
  }

  function triggerDown(time) {
    if (equipPhase !== "idle") return;
    if (current.def.mode === "auto") {
      current.firing = true;
      fireRanged(time);
    } else if (current.def.mode === "semi") {
      fireRanged(time);
    } else {
      meleeSwing(time);
    }
  }

  function triggerUp() {
    current.firing = false;
  }

  function select(index) {
    if (index < 0 || index >= weapons.length) return;
    const target = weapons[index];
    if (equipPhase === "idle" && target === current) return;
    if (equipPhase === "lower" && weapons[pendingIndex] === target) return;
    pendingIndex = index;
    equipPhase = "lower";
    current.firing = false;
  }

  function update(dt, time) {
    // weapon switch: lower -> swap -> raise
    if (equipPhase === "lower") {
      equipT = Math.min(1, equipT + dt / SWITCH_TIME);
      if (equipT >= 1) {
        current = weapons[pendingIndex];
        vm.setWeapon(current.def.id);
        equipPhase = "raise";
      }
    } else if (equipPhase === "raise") {
      equipT = Math.max(0, equipT - dt / SWITCH_TIME);
      if (equipT <= 0) equipPhase = "idle";
    }

    if (current.def.mode === "auto" && current.firing && equipPhase === "idle") fireRanged(time);

    const w = current;
    if (w.def.mode === "melee") {
      w.swing = Math.max(0, w.swing - dt * 2.6);
    } else {
      w.recoil = Math.max(0, w.recoil - dt * 0.9);
    }
    if (muzzle.intensity > 0) muzzle.intensity = Math.max(0, muzzle.intensity - dt * 40);

    let reloadDip = 0;
    if (w.reloading) reloadDip = Math.sin(Math.min(1, (time - w.reloadStart) / w.def.reload) * Math.PI);

    // --- compose the 2D view-model pose (screen pixels / degrees) ---
    let tx = 0;
    let ty = 0;
    let rot = 0;
    let scale = 1;

    ty += equipT * 280; // slide down off-screen while switching
    ty += reloadDip * 90; // dip while reloading
    rot += reloadDip * 8;

    if (w.def.mode === "melee") {
      if (w.swing > 0.001) {
        const a = 1 - w.swing; // 0 -> 1 over the attack
        tx += -150 + a * 320; // sweep left -> right
        ty += 70 - a * 170; // low -> up
        rot += -26 + a * 78; // rotate through the slash
        vm.setBladeDrawn(true);
      } else {
        vm.setBladeDrawn(false);
      }
    } else {
      ty += -w.recoil * 520; // recoil kick up
      rot += -w.recoil * 24;
      scale += w.recoil * 0.4;
    }

    vm.setPose({ tx, ty, rot, scale });

    // fade impact sparks
    for (let i = impacts.length - 1; i >= 0; i -= 1) {
      const fx = impacts[i];
      fx.life -= dt;
      const k = Math.max(0, fx.life / fx.max);
      fx.mesh.material.opacity = k;
      fx.mesh.scale.setScalar(0.5 + (1 - k) * 1.5);
      if (fx.life <= 0) {
        scene.remove(fx.mesh);
        fx.mesh.material.dispose();
        impacts.splice(i, 1);
      }
    }
  }

  function getHUD() {
    const w = current;
    return {
      name: w.def.name,
      ammoText: w.def.mode === "melee" ? "—" : w.reloading ? "换弹中…" : `${w.ammo} / ${w.reserve}`,
    };
  }

  return { triggerDown, triggerUp, select, reload, update, getHUD };
}
