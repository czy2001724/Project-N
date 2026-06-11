import * as THREE from "three";

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

// First-person controller: mouse-look (yaw/pitch), WASD movement with
// sprint/crouch/jump + gravity, and AABB collision against the world.
export function createPlayer(camera, world) {
  camera.rotation.order = "YXZ"; // yaw then pitch — correct FPS look order

  const state = {
    pos: new THREE.Vector3(0, 0, 9),
    yaw: Math.PI,
    pitch: 0,
    vy: 0,
    grounded: true,
    radius: 0.4,
    moveSpeed: 5,
    sprintMul: 1.7,
    crouchMul: 0.55,
    jumpSpeed: 5.7,
    gravity: 15,
    crouching: false,
    sprinting: false,
    health: 100,
  };

  const keys = new Set();
  const forward = new THREE.Vector3();
  const right = new THREE.Vector3();

  // jump feel helpers
  let jumpBuffer = 0; // set by queueJump() on a real keydown event
  let coyote = 0; // lets you jump just after leaving the ground

  function eyeHeight() {
    return state.crouching ? 1.05 : 1.62;
  }

  // Called from the mouse-move handler while pointer is locked.
  function look(dx, dy) {
    state.yaw -= dx * 0.0024;
    state.pitch = clamp(state.pitch - dy * 0.0019, -1.5, 1.5);
  }

  // Small vertical kick used by weapon recoil.
  function addPitch(amount) {
    state.pitch = clamp(state.pitch + amount, -1.5, 1.5);
  }

  // Called from the Space keydown event. Driving the jump from the event
  // (instead of polling keys.has("Space")) means a lost keyup can never
  // leave Space "stuck" and disable future jumps.
  function queueJump() {
    jumpBuffer = 0.12;
  }

  function resolveCollisions() {
    const r = state.radius;
    // clamp to room bounds
    const limit = world.ROOM - 0.5 - r;
    state.pos.x = clamp(state.pos.x, -limit, limit);
    state.pos.z = clamp(state.pos.z, -limit, limit);

    // push out of cover/wall boxes (XZ only)
    for (const box of world.colliders) {
      const minX = box.min.x - r;
      const maxX = box.max.x + r;
      const minZ = box.min.z - r;
      const maxZ = box.max.z + r;
      if (state.pos.x <= minX || state.pos.x >= maxX || state.pos.z <= minZ || state.pos.z >= maxZ) {
        continue;
      }
      const pL = state.pos.x - minX;
      const pR = maxX - state.pos.x;
      const pB = state.pos.z - minZ;
      const pF = maxZ - state.pos.z;
      const m = Math.min(pL, pR, pB, pF);
      if (m === pL) state.pos.x = minX;
      else if (m === pR) state.pos.x = maxX;
      else if (m === pB) state.pos.z = minZ;
      else state.pos.z = maxZ;
    }
  }

  function update(dt) {
    state.crouching = keys.has("ControlLeft") || keys.has("ControlRight");
    const moving =
      keys.has("KeyW") || keys.has("KeyA") || keys.has("KeyS") || keys.has("KeyD");
    // Sprint is derived from input every frame (held Shift), decoupled from
    // jumping: holding Shift in mid-air simply makes sprint engage the moment
    // you land. Only a *new* Space press while W+Shift are held can be blocked
    // by keyboard ghosting — and that combo isn't needed to sprint on landing.
    const sprintHeld = keys.has("ShiftLeft") || keys.has("ShiftRight");
    state.sprinting = sprintHeld && !state.crouching && state.grounded && moving;

    let speed = state.moveSpeed;
    if (state.crouching) speed *= state.crouchMul;
    if (state.sprinting) speed *= state.sprintMul;

    // horizontal basis from yaw
    forward.set(-Math.sin(state.yaw), 0, -Math.cos(state.yaw));
    right.set(Math.cos(state.yaw), 0, -Math.sin(state.yaw));

    let mx = 0;
    let mz = 0;
    if (keys.has("KeyW")) { mx += forward.x; mz += forward.z; }
    if (keys.has("KeyS")) { mx -= forward.x; mz -= forward.z; }
    if (keys.has("KeyD")) { mx += right.x; mz += right.z; }
    if (keys.has("KeyA")) { mx -= right.x; mz -= right.z; }

    const len = Math.hypot(mx, mz);
    if (len > 0) {
      state.pos.x += (mx / len) * speed * dt;
      state.pos.z += (mz / len) * speed * dt;
    }

    resolveCollisions();

    // jump with input buffer + coyote time (buffer is event-driven)
    jumpBuffer = Math.max(0, jumpBuffer - dt);
    coyote = state.grounded ? 0.1 : Math.max(0, coyote - dt);
    if (jumpBuffer > 0 && coyote > 0) {
      state.vy = state.jumpSpeed;
      state.grounded = false;
      jumpBuffer = 0;
      coyote = 0;
    }

    state.vy -= state.gravity * dt;
    state.pos.y += state.vy * dt;
    if (state.pos.y <= 0) {
      state.pos.y = 0;
      state.vy = 0;
      state.grounded = true;
    }

    // apply to camera
    camera.position.set(state.pos.x, state.pos.y + eyeHeight(), state.pos.z);
    camera.rotation.y = state.yaw;
    camera.rotation.x = state.pitch;
  }

  return { state, keys, look, addPitch, queueJump, update };
}
