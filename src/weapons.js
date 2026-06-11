import * as THREE from "three";
import { buildRifle, buildPistol, buildKnife } from "./models.js";

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
    if (w.def.mode === "melee" || w.reloading) return;
    if (w.ammo === w.def.mag || w.reserve === 0) return;
    w.reloading = true;
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

  function select(index) {
    if (index < 0 || index >= weapons.length || weapons[index] === current) return;
    current.firing = false;
    current.group.visible = false;
    current = weapons[index];
    current.group.visible = true;
  }

  function update(dt, time) {
    // auto fire while held
    if (current.def.mode === "auto" && current.firing) fireRanged(time);

    // per-weapon view-model animation
    for (const w of weapons) {
      if (w.def.mode === "melee") {
        w.swing = Math.max(0, w.swing - dt * 3.2);
        const s = Math.sin(w.swing * Math.PI); // 0..1..0
        w.group.position.set(w.restPos.x - s * 0.12, w.restPos.y + s * 0.06, w.restPos.z + s * 0.05);
        w.group.rotation.x = -s * 1.1;
        w.group.rotation.z = s * 0.5;
      } else {
        w.recoil = Math.max(0, w.recoil - dt * 0.9);
        w.group.position.set(w.restPos.x, w.restPos.y, w.restPos.z + w.recoil);
        w.group.rotation.x = w.recoil * 1.5;
        if (w.flash && w.flash.intensity > 0) {
          w.flash.intensity = Math.max(0, w.flash.intensity - dt * 40);
        }
      }
    }

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
