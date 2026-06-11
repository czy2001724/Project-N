import * as THREE from "three";
import { buildRifle, buildPistol, buildKnife } from "./models.js?v=DEV";

// Weapon definitions. mode drives trigger behaviour:
//   auto  -> fires continuously while the trigger is held
//   semi  -> one shot per trigger press
//   melee -> short-range swing on press
const DEFS = [
  { id: "rifle", name: "步枪", mode: "auto", build: buildRifle, damage: 14, fireRate: 0.1, mag: 30, reserve: 150, reload: 1.4, range: 120, recoil: 0.05, kick: 0.012 },
  { id: "pistol", name: "手枪", mode: "semi", build: buildPistol, damage: 26, fireRate: 0.2, mag: 12, reserve: 96, reload: 1.0, range: 90, recoil: 0.08, kick: 0.022 },
  { id: "knife", name: "近战刀", mode: "melee", build: buildKnife, damage: 150, fireRate: 0.45, range: 2.4 },
];

export function createWeapons(camera, scene, world, player, hooks = {}) {
  const ray = new THREE.Raycaster();
  const screenCenter = new THREE.Vector2(0, 0);

  // Shared impact sparks pool.
  const impacts = [];
  const sparkGeo = new THREE.SphereGeometry(0.06, 6, 6);
  function spawnImpact(point) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 1 });
    const spark = new THREE.Mesh(sparkGeo, mat);
    spark.position.copy(point);
    scene.add(spark);
    impacts.push({ mesh: spark, life: 0.25, max: 0.25 });
  }

  // Build each weapon instance from its definition.
  const weapons = DEFS.map((def) => {
    const built = def.build();
    const group = built.group;
    group.position.set(0.22, -0.2, -0.5);
    group.visible = false;
    camera.add(group);

    let flash = null;
    if (def.mode !== "melee") {
      flash = new THREE.PointLight(0xffd070, 0, 7, 2);
      flash.position.copy(built.muzzle);
      group.add(flash);
    }

    return {
      def,
      group,
      flash,
      restPos: group.position.clone(),
      ammo: def.mag ?? 0,
      reserve: def.reserve ?? 0,
      reloading: false,
      lastShot: -1,
      firing: false, // auto trigger held
      recoil: 0,
      swing: 0, // melee animation progress
    };
  });

  let current = weapons[0];
  current.group.visible = true;

  // Weapon-switch animation: lower the old weapon, swap, raise the new one.
  const SWITCH_TIME = 0.16; // seconds per half (lower / raise)
  let equipT = 0; // 0 = fully up/ready, 1 = fully lowered
  let equipPhase = "idle"; // "lower" | "raise" | "idle"
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
    w.reloadStart = performance.now() / 1000; // drives the dip animation
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
    if (w.flash) w.flash.intensity = 4.5;
    damageAt(w.def.range, w.def.damage);
  }

  function meleeSwing(time) {
    const w = current;
    if (time - w.lastShot < w.def.fireRate) return;
    w.lastShot = time;
    w.swing = 1; // trigger swing animation
    damageAt(w.def.range, w.def.damage);
  }

  // Trigger pressed.
  function triggerDown(time) {
    if (equipPhase !== "idle") return; // can't fire mid weapon-swap
    if (current.def.mode === "auto") {
      current.firing = true;
      fireRanged(time); // immediate first shot
    } else if (current.def.mode === "semi") {
      fireRanged(time);
    } else {
      meleeSwing(time);
    }
  }

  function triggerUp() {
    current.firing = false;
  }

  // Start a switch: the actual swap happens mid-animation (see update()).
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
    // --- weapon switch: lower old -> swap -> raise new ---
    if (equipPhase === "lower") {
      equipT = Math.min(1, equipT + dt / SWITCH_TIME);
      if (equipT >= 1) {
        current.group.visible = false;
        current = weapons[pendingIndex];
        current.group.visible = true;
        equipPhase = "raise";
      }
    } else if (equipPhase === "raise") {
      equipT = Math.max(0, equipT - dt / SWITCH_TIME);
      if (equipT <= 0) equipPhase = "idle";
    }

    // auto fire while held (never mid-switch)
    if (current.def.mode === "auto" && current.firing && equipPhase === "idle") {
      fireRanged(time);
    }

    const w = current;

    // recoil / swing / muzzle-flash decay
    if (w.def.mode === "melee") {
      w.swing = Math.max(0, w.swing - dt * 3.2);
    } else {
      w.recoil = Math.max(0, w.recoil - dt * 0.9);
      if (w.flash && w.flash.intensity > 0) {
        w.flash.intensity = Math.max(0, w.flash.intensity - dt * 40);
      }
    }

    // reload dip (0 -> 1 -> 0 across the reload)
    let reloadDip = 0;
    if (w.reloading) {
      const p = Math.min(1, (time - w.reloadStart) / w.def.reload);
      reloadDip = Math.sin(p * Math.PI);
    }

    // compose the view-model transform from all active motions
    let px = w.restPos.x;
    let py = w.restPos.y;
    let pz = w.restPos.z;
    let rx = 0;
    let rz = 0;

    py -= equipT * 0.4; // lowered during switch
    rx += equipT * 1.0;

    py -= reloadDip * 0.18; // dip while reloading
    rx += reloadDip * 0.8;
    rz += reloadDip * 0.35;

    if (w.def.mode === "melee") {
      const s = Math.sin(w.swing * Math.PI);
      px -= s * 0.12;
      py += s * 0.06;
      pz += s * 0.05;
      rx += -s * 1.1;
      rz += s * 0.5;
    } else {
      pz += w.recoil;
      rx += w.recoil * 1.5;
    }

    w.group.position.set(px, py, pz);
    w.group.rotation.set(rx, 0, rz);

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
      ammoText:
        w.def.mode === "melee" ? "—" : w.reloading ? "换弹中…" : `${w.ammo} / ${w.reserve}`,
    };
  }

  return { triggerDown, triggerUp, select, reload, update, getHUD };
}
