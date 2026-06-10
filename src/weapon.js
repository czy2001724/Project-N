import * as THREE from "three";

// Hitscan weapon: a view-model gun, raycast firing against the world,
// ammo/reload, recoil, muzzle flash and impact effects.
export function createWeapon(camera, scene, world, player, hooks = {}) {
  // --- View model -------------------------------------------------------
  const gun = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({ color: 0x2b3038, roughness: 0.5, metalness: 0.6 });
  const accentMat = new THREE.MeshStandardMaterial({ color: 0x6fd0ff, emissive: 0x2a90c0, emissiveIntensity: 0.8 });

  const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.14, 0.5), bodyMat);
  body.position.set(0, -0.02, -0.1);
  gun.add(body);

  const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.45), bodyMat);
  barrel.position.set(0, 0.02, -0.42);
  gun.add(barrel);

  const grip = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.18, 0.1), bodyMat);
  grip.position.set(0, -0.16, 0.02);
  grip.rotation.x = 0.3;
  gun.add(grip);

  const sight = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.06), accentMat);
  sight.position.set(0, 0.09, -0.1);
  gun.add(sight);

  gun.position.set(0.22, -0.2, -0.5);
  camera.add(gun);

  // Muzzle flash light at the barrel tip.
  const flash = new THREE.PointLight(0xffd070, 0, 7, 2);
  flash.position.set(0, 0.02, -0.66);
  gun.add(flash);

  // --- State ------------------------------------------------------------
  const stats = {
    mag: 30,
    ammo: 30,
    reserve: 120,
    damage: 12,
    fireRate: 0.09, // seconds between shots
    reloadTime: 1.3,
    reloading: false,
  };
  let lastShot = -1;
  let recoil = 0; // visual kick, decays to 0
  const restPos = gun.position.clone();

  const ray = new THREE.Raycaster();
  const screenCenter = new THREE.Vector2(0, 0);

  // Pool of impact sparks reused over time.
  const impacts = [];
  const sparkGeo = new THREE.SphereGeometry(0.06, 6, 6);

  function spawnImpact(point) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffe08a, transparent: true, opacity: 1 });
    const spark = new THREE.Mesh(sparkGeo, mat);
    spark.position.copy(point);
    scene.add(spark);
    impacts.push({ mesh: spark, life: 0.25, max: 0.25 });
  }

  function reload() {
    if (stats.reloading || stats.ammo === stats.mag || stats.reserve === 0) return;
    stats.reloading = true;
    setTimeout(() => {
      const need = stats.mag - stats.ammo;
      const take = Math.min(need, stats.reserve);
      stats.ammo += take;
      stats.reserve -= take;
      stats.reloading = false;
    }, stats.reloadTime * 1000);
  }

  // Attempt to fire at the given time (seconds). Honors fire rate + ammo.
  function tryFire(time) {
    if (stats.reloading) return;
    if (time - lastShot < stats.fireRate) return;
    if (stats.ammo <= 0) {
      reload();
      return;
    }
    lastShot = time;
    stats.ammo -= 1;

    // recoil + muzzle flash
    recoil = Math.min(recoil + 0.05, 0.14);
    player.addPitch(0.012);
    flash.intensity = 4.5;

    // hitscan from screen center
    ray.setFromCamera(screenCenter, camera);
    const hits = ray.intersectObjects(world.getHittables(), false);
    if (hits.length > 0) {
      const hit = hits[0];
      spawnImpact(hit.point);
      const obj = hit.object;
      if (obj.userData && obj.userData.type === "target") {
        const killed = world.damageTarget(obj, stats.damage);
        if (hooks.onHitmarker) hooks.onHitmarker(killed);
      }
    }
  }

  function update(dt) {
    // recoil recovery
    recoil = Math.max(0, recoil - dt * 0.9);
    gun.position.set(restPos.x, restPos.y, restPos.z + recoil);
    gun.rotation.x = recoil * 1.5;

    // muzzle flash decay
    if (flash.intensity > 0) flash.intensity = Math.max(0, flash.intensity - dt * 40);

    // fade + retire impact sparks
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

  return { stats, tryFire, reload, update };
}
