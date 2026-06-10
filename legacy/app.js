const canvas = document.getElementById('game');
const overlay = document.getElementById('overlay');
const startBtn = document.getElementById('startBtn');
const crosshair = document.getElementById('crosshair');
const statusEl = document.getElementById('status');

const gl = canvas.getContext('webgl', {
  antialias: true,
  alpha: false,
  depth: true
});

if (!gl) {
  throw new Error('WebGL is not supported.');
}

const keys = new Set();

const player = {
  x: 0,
  y: 0,
  z: 9,
  cameraYaw: Math.PI,
  bodyYaw: Math.PI,
  pitch: 0,
  moveSpeed: 5,
  sprintMultiplier: 1.75,
  crouchMultiplier: 0.58,
  jumpSpeed: 5.7,
  gravity: 14.5,
  verticalVelocity: 0,
  grounded: true,
  crouching: false,
  sprinting: false,
  jumpQueued: false,
  walkCycle: 0
};

const cameraState = {
  mode: 'first',
  thirdPersonDistance: 5.2,
  thirdPersonHeight: 2.25
};

const input = {
  pointerLocked: false,
  gameMode: false,
  keyboardLocked: false
};

const world = {
  room: 18,
  ceiling: 6,
  boxes: [
    { x: -5, z: 2, w: 3, h: 2.2, d: 3, color: [0.42, 0.58, 0.8] },
    { x: 5, z: -4, w: 4, h: 3.1, d: 4, color: [0.56, 0.68, 0.84] },
    { x: -1, z: -8, w: 2.5, h: 1.8, d: 2.5, color: [0.68, 0.76, 0.86] },
    { x: 8, z: 6, w: 3, h: 2.6, d: 3, color: [0.5, 0.62, 0.74] }
  ]
};

const gameplayKeys = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'KeyV',
  'Space',
  'ShiftLeft',
  'ShiftRight',
  'ControlLeft',
  'ControlRight',
  'F8',
  'Tab'
]);

let program;
let attribs;
let uniforms;
let buffers;
let lastTime = performance.now();

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function normalizeAngle(angle) {
  const twoPi = Math.PI * 2;
  angle %= twoPi;
  if (angle < -Math.PI) angle += twoPi;
  if (angle > Math.PI) angle -= twoPi;
  return angle;
}

function resize() {
  const dpr = Math.max(1, window.devicePixelRatio || 1);
  const width = Math.floor(window.innerWidth * dpr);
  const height = Math.floor(window.innerHeight * dpr);

  if (canvas.width !== width || canvas.height !== height) {
    canvas.width = width;
    canvas.height = height;
    canvas.style.width = `${window.innerWidth}px`;
    canvas.style.height = `${window.innerHeight}px`;
    gl.viewport(0, 0, width, height);
  }
}

function shouldCaptureKey(event) {
  return input.gameMode || gameplayKeys.has(event.code);
}

function requestPointerLock() {
  canvas.requestPointerLock?.();
}

async function requestFullscreen() {
  if (!document.fullscreenElement) {
    await document.documentElement.requestFullscreen?.();
  }
}

async function requestKeyboardLock() {
  if (!navigator.keyboard?.lock) {
    input.keyboardLocked = false;
    return;
  }

  try {
    await navigator.keyboard.lock([
      'KeyW',
      'KeyA',
      'KeyS',
      'KeyD',
      'KeyV',
      'Space',
      'ShiftLeft',
      'ShiftRight',
      'ControlLeft',
      'ControlRight',
      'Tab'
    ]);
    input.keyboardLocked = true;
  } catch {
    input.keyboardLocked = false;
  }
}

function releaseKeyboardLock() {
  navigator.keyboard?.unlock?.();
  input.keyboardLocked = false;
}

async function enableGameMode() {
  input.gameMode = true;
  await requestFullscreen();
  requestPointerLock();
  await requestKeyboardLock();
}

function disableGameMode() {
  input.gameMode = false;
  keys.clear();
  releaseKeyboardLock();
  document.exitPointerLock?.();
  document.exitFullscreen?.();
}

async function toggleGameMode() {
  if (input.gameMode) {
    disableGameMode();
  } else {
    await enableGameMode();
  }
}

function updateOverlay() {
  input.pointerLocked = document.pointerLockElement === canvas;
  overlay.style.display = input.pointerLocked || input.gameMode ? 'none' : 'grid';
}

function onFullscreenChange() {
  if (!document.fullscreenElement && input.gameMode) {
    input.gameMode = false;
    releaseKeyboardLock();
    keys.clear();
  }
}

function onKeyDown(event) {
  if (event.code === 'F8' && !event.repeat) {
    event.preventDefault();
    void toggleGameMode();
    return;
  }

  if (shouldCaptureKey(event)) event.preventDefault();
  keys.add(event.code);

  if (event.code === 'KeyV' && !event.repeat) {
    cameraState.mode = cameraState.mode === 'first' ? 'third' : 'first';
    crosshair.style.display = cameraState.mode === 'first' ? 'block' : 'none';
  }

  if (event.code === 'Space' && !event.repeat) {
    player.jumpQueued = true;
  }
}

function onKeyUp(event) {
  if (shouldCaptureKey(event)) event.preventDefault();
  keys.delete(event.code);
}

function onMouseMove(event) {
  if (!input.pointerLocked) return;
  player.cameraYaw -= event.movementX * 0.0024;
  player.pitch -= event.movementY * 0.0019;
  player.pitch = clamp(player.pitch, -1.2, 1.2);
  player.cameraYaw = normalizeAngle(player.cameraYaw);
}

function getForward(yaw) {
  return [Math.sin(yaw), 0, -Math.cos(yaw)];
}

function getRight(yaw) {
  return [Math.cos(yaw), 0, Math.sin(yaw)];
}

function getEyeHeight() {
  return player.crouching ? 1.02 : 1.62;
}

function updateMovement(dt) {
  player.crouching = keys.has('ControlLeft') || keys.has('ControlRight');
  player.sprinting =
    !player.crouching &&
    player.grounded &&
    (keys.has('ShiftLeft') || keys.has('ShiftRight')) &&
    (keys.has('KeyW') || keys.has('KeyA') || keys.has('KeyS') || keys.has('KeyD'));

  let speed = player.moveSpeed;
  if (player.crouching) speed *= player.crouchMultiplier;
  if (player.sprinting) speed *= player.sprintMultiplier;

  const forward = getForward(player.cameraYaw);
  const right = getRight(player.cameraYaw);
  let moveX = 0;
  let moveZ = 0;

  if (keys.has('KeyW')) {
    moveX += forward[0];
    moveZ += forward[2];
  }
  if (keys.has('KeyS')) {
    moveX -= forward[0];
    moveZ -= forward[2];
  }
  if (keys.has('KeyD')) {
    moveX += right[0];
    moveZ += right[2];
  }
  if (keys.has('KeyA')) {
    moveX -= right[0];
    moveZ -= right[2];
  }

  const moveLength = Math.hypot(moveX, moveZ);
  if (moveLength > 0) {
    moveX /= moveLength;
    moveZ /= moveLength;
    player.x += moveX * speed * dt;
    player.z += moveZ * speed * dt;
    player.bodyYaw = Math.atan2(moveX, -moveZ);
    player.walkCycle += dt * (player.sprinting ? 14 : player.crouching ? 5 : 9);
  }

  resolveCollisions();

  if (player.jumpQueued && player.grounded) {
    player.verticalVelocity = player.jumpSpeed;
    player.grounded = false;
  }
  player.jumpQueued = false;

  player.verticalVelocity -= player.gravity * dt;
  player.y += player.verticalVelocity * dt;

  if (player.y <= 0) {
    player.y = 0;
    player.verticalVelocity = 0;
    player.grounded = true;
  }
}

function resolveCollisions() {
  const radius = 0.45;
  const limit = world.room - radius - 0.2;
  player.x = clamp(player.x, -limit, limit);
  player.z = clamp(player.z, -limit, limit);

  for (const box of world.boxes) {
    const minX = box.x - box.w / 2 - radius;
    const maxX = box.x + box.w / 2 + radius;
    const minZ = box.z - box.d / 2 - radius;
    const maxZ = box.z + box.d / 2 + radius;

    if (player.x <= minX || player.x >= maxX || player.z <= minZ || player.z >= maxZ) {
      continue;
    }

    const pushLeft = Math.abs(player.x - minX);
    const pushRight = Math.abs(maxX - player.x);
    const pushBack = Math.abs(player.z - minZ);
    const pushFront = Math.abs(maxZ - player.z);
    const minPush = Math.min(pushLeft, pushRight, pushBack, pushFront);

    if (minPush === pushLeft) player.x = minX;
    else if (minPush === pushRight) player.x = maxX;
    else if (minPush === pushBack) player.z = minZ;
    else player.z = maxZ;
  }
}

function createShader(type, source) {
  const shader = gl.createShader(type);
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const message = gl.getShaderInfoLog(shader);
    gl.deleteShader(shader);
    throw new Error(message || 'Shader compile failed');
  }
  return shader;
}

function createProgram(vertexSource, fragmentSource) {
  const vertexShader = createShader(gl.VERTEX_SHADER, vertexSource);
  const fragmentShader = createShader(gl.FRAGMENT_SHADER, fragmentSource);
  const nextProgram = gl.createProgram();
  gl.attachShader(nextProgram, vertexShader);
  gl.attachShader(nextProgram, fragmentShader);
  gl.linkProgram(nextProgram);
  if (!gl.getProgramParameter(nextProgram, gl.LINK_STATUS)) {
    const message = gl.getProgramInfoLog(nextProgram);
    gl.deleteProgram(nextProgram);
    throw new Error(message || 'Program link failed');
  }
  return nextProgram;
}

function mat4Perspective(fovY, aspect, near, far) {
  const f = 1 / Math.tan(fovY / 2);
  const nf = 1 / (near - far);
  return new Float32Array([
    f / aspect, 0, 0, 0,
    0, f, 0, 0,
    0, 0, (far + near) * nf, -1,
    0, 0, 2 * far * near * nf, 0
  ]);
}

function vec3Subtract(a, b) {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function vec3Normalize(v) {
  const length = Math.hypot(v[0], v[1], v[2]) || 1;
  return [v[0] / length, v[1] / length, v[2] / length];
}

function vec3Cross(a, b) {
  return [
    a[1] * b[2] - a[2] * b[1],
    a[2] * b[0] - a[0] * b[2],
    a[0] * b[1] - a[1] * b[0]
  ];
}

function mat4LookAt(eye, target, up) {
  const zAxis = vec3Normalize(vec3Subtract(eye, target));
  const xAxis = vec3Normalize(vec3Cross(up, zAxis));
  const yAxis = vec3Cross(zAxis, xAxis);

  return new Float32Array([
    xAxis[0], yAxis[0], zAxis[0], 0,
    xAxis[1], yAxis[1], zAxis[1], 0,
    xAxis[2], yAxis[2], zAxis[2], 0,
    -(xAxis[0] * eye[0] + xAxis[1] * eye[1] + xAxis[2] * eye[2]),
    -(yAxis[0] * eye[0] + yAxis[1] * eye[1] + yAxis[2] * eye[2]),
    -(zAxis[0] * eye[0] + zAxis[1] * eye[1] + zAxis[2] * eye[2]),
    1
  ]);
}

function mat4Multiply(a, b) {
  const out = new Float32Array(16);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      out[col * 4 + row] =
        a[0 * 4 + row] * b[col * 4 + 0] +
        a[1 * 4 + row] * b[col * 4 + 1] +
        a[2 * 4 + row] * b[col * 4 + 2] +
        a[3 * 4 + row] * b[col * 4 + 3];
    }
  }
  return out;
}

function mat4Translate(x, y, z) {
  return new Float32Array([
    1, 0, 0, 0,
    0, 1, 0, 0,
    0, 0, 1, 0,
    x, y, z, 1
  ]);
}

function mat4Scale(x, y, z) {
  return new Float32Array([
    x, 0, 0, 0,
    0, y, 0, 0,
    0, 0, z, 0,
    0, 0, 0, 1
  ]);
}

function makeModel(x, y, z, sx, sy, sz) {
  return mat4Multiply(mat4Translate(x, y, z), mat4Scale(sx, sy, sz));
}

function shade(color, amount) {
  return color.map((channel) => clamp(channel + amount, 0, 1));
}

function makeCube(color = [0.55, 0.65, 0.78]) {
  const faces = [
    { normal: 'front', color: shade(color, 0.1), points: [[-0.5, -0.5, 0.5], [0.5, -0.5, 0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5]] },
    { normal: 'back', color: shade(color, -0.18), points: [[0.5, -0.5, -0.5], [-0.5, -0.5, -0.5], [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5]] },
    { normal: 'left', color: shade(color, -0.08), points: [[-0.5, -0.5, -0.5], [-0.5, -0.5, 0.5], [-0.5, 0.5, 0.5], [-0.5, 0.5, -0.5]] },
    { normal: 'right', color: shade(color, 0.0), points: [[0.5, -0.5, 0.5], [0.5, -0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5]] },
    { normal: 'top', color: shade(color, 0.16), points: [[-0.5, 0.5, 0.5], [0.5, 0.5, 0.5], [0.5, 0.5, -0.5], [-0.5, 0.5, -0.5]] },
    { normal: 'bottom', color: shade(color, -0.26), points: [[-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5]] }
  ];

  const positions = [];
  const colors = [];
  for (const face of faces) {
    const triangles = [0, 1, 2, 0, 2, 3];
    for (const index of triangles) {
      positions.push(...face.points[index]);
      colors.push(...face.color);
    }
  }

  return {
    positions: new Float32Array(positions),
    colors: new Float32Array(colors),
    count: positions.length / 3
  };
}

function createArrayBuffer(data, usage = gl.STATIC_DRAW) {
  const buffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
  gl.bufferData(gl.ARRAY_BUFFER, data, usage);
  return buffer;
}

function initGL() {
  const vertexSource = `
    attribute vec3 aPosition;
    attribute vec3 aColor;
    uniform mat4 uProjection;
    uniform mat4 uView;
    uniform mat4 uModel;
    uniform vec3 uTint;
    varying vec3 vColor;

    void main() {
      vColor = aColor * uTint;
      gl_Position = uProjection * uView * uModel * vec4(aPosition, 1.0);
    }
  `;

  const fragmentSource = `
    precision mediump float;
    varying vec3 vColor;

    void main() {
      gl_FragColor = vec4(vColor, 1.0);
    }
  `;

  program = createProgram(vertexSource, fragmentSource);
  attribs = {
    position: gl.getAttribLocation(program, 'aPosition'),
    color: gl.getAttribLocation(program, 'aColor')
  };
  uniforms = {
    projection: gl.getUniformLocation(program, 'uProjection'),
    view: gl.getUniformLocation(program, 'uView'),
    model: gl.getUniformLocation(program, 'uModel'),
    tint: gl.getUniformLocation(program, 'uTint')
  };

  const cube = makeCube();
  buffers = {
    cubePosition: createArrayBuffer(cube.positions),
    cubeColor: createArrayBuffer(cube.colors),
    cubeCount: cube.count,
    linePosition: gl.createBuffer(),
    lineColor: gl.createBuffer()
  };

  gl.enable(gl.DEPTH_TEST);
  gl.depthFunc(gl.LEQUAL);
  gl.disable(gl.CULL_FACE);
  gl.clearColor(0.48, 0.57, 0.64, 1);
}

function bindStaticCube() {
  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.cubePosition);
  gl.enableVertexAttribArray(attribs.position);
  gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.cubeColor);
  gl.enableVertexAttribArray(attribs.color);
  gl.vertexAttribPointer(attribs.color, 3, gl.FLOAT, false, 0, 0);
}

function drawCube(model, tint = [1, 1, 1]) {
  gl.uniformMatrix4fv(uniforms.model, false, model);
  gl.uniform3fv(uniforms.tint, tint);
  gl.drawArrays(gl.TRIANGLES, 0, buffers.cubeCount);
}

function drawLines(points, colors) {
  if (points.length === 0) return;

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.linePosition);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(points), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(attribs.position);
  gl.vertexAttribPointer(attribs.position, 3, gl.FLOAT, false, 0, 0);

  gl.bindBuffer(gl.ARRAY_BUFFER, buffers.lineColor);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(colors), gl.DYNAMIC_DRAW);
  gl.enableVertexAttribArray(attribs.color);
  gl.vertexAttribPointer(attribs.color, 3, gl.FLOAT, false, 0, 0);

  gl.uniformMatrix4fv(uniforms.model, false, makeModel(0, 0, 0, 1, 1, 1));
  gl.uniform3fv(uniforms.tint, [1, 1, 1]);
  gl.drawArrays(gl.LINES, 0, points.length / 3);
}

function setCameraUniforms() {
  const aspect = canvas.width / canvas.height;
  const projection = mat4Perspective(Math.PI / 3, aspect, 0.08, 120);
  const forward = getForward(player.cameraYaw);
  const eyeHeight = getEyeHeight();
  let eye;
  let target;

  if (cameraState.mode === 'first') {
    eye = [player.x, player.y + eyeHeight, player.z];
    target = [
      eye[0] + forward[0] * Math.cos(player.pitch) * 10,
      eye[1] + Math.sin(player.pitch) * 10,
      eye[2] + forward[2] * Math.cos(player.pitch) * 10
    ];
  } else {
    eye = [
      player.x - forward[0] * cameraState.thirdPersonDistance,
      player.y + cameraState.thirdPersonHeight,
      player.z - forward[2] * cameraState.thirdPersonDistance
    ];
    target = [
      player.x + forward[0] * 2,
      player.y + 1.25 + Math.sin(player.pitch) * 1.5,
      player.z + forward[2] * 2
    ];
  }

  gl.uniformMatrix4fv(uniforms.projection, false, projection);
  gl.uniformMatrix4fv(uniforms.view, false, mat4LookAt(eye, target, [0, 1, 0]));
}

function drawRoom() {
  bindStaticCube();

  const s = world.room;
  const h = world.ceiling;
  drawCube(makeModel(0, -0.08, 0, s * 2, 0.16, s * 2), [0.62, 0.63, 0.62]);
  drawCube(makeModel(0, h + 0.08, 0, s * 2, 0.16, s * 2), [0.52, 0.56, 0.58]);
  drawCube(makeModel(0, h / 2, -s, s * 2, h, 0.32), [0.68, 0.7, 0.7]);
  drawCube(makeModel(0, h / 2, s, s * 2, h, 0.32), [0.7, 0.72, 0.72]);
  drawCube(makeModel(-s, h / 2, 0, 0.32, h, s * 2), [0.64, 0.67, 0.68]);
  drawCube(makeModel(s, h / 2, 0, 0.32, h, s * 2), [0.64, 0.67, 0.68]);
}

function drawBoxes() {
  bindStaticCube();
  for (const box of world.boxes) {
    drawCube(makeModel(box.x, box.h / 2, box.z, box.w, box.h, box.d), box.color);
  }
}

function gridColor(value) {
  if (Math.abs(value) < 0.001) return [1, 1, 1];
  if (Math.abs(value % 20) < 0.001) return [1, 0.75, 0.25];
  if (Math.abs(value % 10) < 0.001) return [0.25, 0.85, 1];
  return [0.16, 0.21, 0.25];
}

function pushLine(points, colors, a, b, color) {
  points.push(...a, ...b);
  colors.push(...color, ...color);
}

function drawDistanceLines() {
  const points = [];
  const colors = [];
  const s = world.room - 0.3;
  const y = 0.035;

  for (let v = -world.room; v <= world.room; v += 2) {
    pushLine(points, colors, [v, y, -s], [v, y, s], gridColor(v));
    pushLine(points, colors, [-s, y, v], [s, y, v], gridColor(v));
  }

  pushLine(points, colors, [-s, y + 0.01, 0], [s, y + 0.01, 0], [1, 1, 1]);
  pushLine(points, colors, [0, y + 0.01, -s], [0, y + 0.01, s], [1, 1, 1]);
  drawLines(points, colors);
}

function localPoint(offsetX, offsetY, offsetZ) {
  const right = getRight(player.bodyYaw);
  const forward = getForward(player.bodyYaw);
  return [
    player.x + right[0] * offsetX + forward[0] * offsetZ,
    player.y + offsetY,
    player.z + right[2] * offsetX + forward[2] * offsetZ
  ];
}

function drawPlayer() {
  if (cameraState.mode !== 'third') return;

  bindStaticCube();
  drawCube(makeModel(player.x, player.y + 1.55, player.z, 0.36, 0.36, 0.36), [0.95, 0.98, 1]);

  const bob = Math.sin(player.walkCycle) * 0.05;
  const swing = Math.sin(player.walkCycle) * 0.28;
  const points = [];
  const colors = [];
  const dark = [0.04, 0.07, 0.1];
  const yellow = [1, 0.86, 0.25];

  const neck = localPoint(0, 1.36 + bob, 0);
  const hip = localPoint(0, 0.72 + bob * 0.35, 0);
  const leftShoulder = localPoint(-0.32, 1.24 + bob, 0);
  const rightShoulder = localPoint(0.32, 1.24 + bob, 0);
  const leftHand = localPoint(-0.42, 0.9 + bob + swing * 0.25, 0.08);
  const rightHand = localPoint(0.42, 0.9 + bob - swing * 0.25, 0.08);
  const leftFoot = localPoint(-0.2, 0.08, 0.12 + swing * 0.35);
  const rightFoot = localPoint(0.2, 0.08, 0.12 - swing * 0.35);

  pushLine(points, colors, neck, hip, dark);
  pushLine(points, colors, leftShoulder, rightShoulder, dark);
  pushLine(points, colors, leftShoulder, leftHand, dark);
  pushLine(points, colors, rightShoulder, rightHand, dark);
  pushLine(points, colors, hip, leftFoot, dark);
  pushLine(points, colors, hip, rightFoot, dark);

  const forward = getForward(player.cameraYaw);
  const right = getRight(player.cameraYaw);
  const eye = [
    player.x + forward[0] * 0.22,
    player.y + getEyeHeight(),
    player.z + forward[2] * 0.22
  ];
  const lensA = [eye[0] - right[0] * 0.14, eye[1], eye[2] - right[2] * 0.14];
  const lensB = [eye[0] + right[0] * 0.14, eye[1], eye[2] + right[2] * 0.14];
  const sight = [eye[0] + forward[0] * 1.3, eye[1] + Math.sin(player.pitch) * 0.55, eye[2] + forward[2] * 1.3];
  pushLine(points, colors, lensA, lensB, yellow);
  pushLine(points, colors, eye, sight, yellow);

  drawLines(points, colors);
}

function render() {
  resize();
  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.useProgram(program);
  setCameraUniforms();
  drawRoom();
  drawDistanceLines();
  drawBoxes();
  drawPlayer();
  updateStatus();
}

function updateStatus() {
  const view = cameraState.mode === 'first' ? 'First' : 'Third';
  const inputMode = input.gameMode ? (input.keyboardLocked ? 'locked' : 'game') : 'browser';
  const state = player.crouching ? 'crouch' : player.sprinting ? 'sprint' : player.grounded ? 'stand' : 'jump';
  statusEl.textContent = `View: ${view} | State: ${state} | Input: ${inputMode} | Pos: ${player.x.toFixed(1)}, ${player.z.toFixed(1)}`;
}

function loop(now) {
  const dt = Math.min(0.033, (now - lastTime) / 1000);
  lastTime = now;
  updateMovement(dt);
  render();
  requestAnimationFrame(loop);
}

window.addEventListener('resize', resize);
window.addEventListener('keydown', onKeyDown);
window.addEventListener('keyup', onKeyUp);
window.addEventListener('mousemove', onMouseMove);
document.addEventListener('pointerlockchange', updateOverlay);
document.addEventListener('fullscreenchange', onFullscreenChange);
startBtn.addEventListener('click', requestPointerLock);
canvas.addEventListener('click', requestPointerLock);

initGL();
resize();
updateOverlay();
crosshair.style.display = 'block';
requestAnimationFrame(loop);
