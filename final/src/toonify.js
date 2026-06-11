import * as THREE from "three";

// Converts a built scene to an anime / cel-shaded look:
//  - MeshStandardMaterial -> MeshToonMaterial with a stepped gradient ramp
//    (hard cel shadow bands instead of smooth shading)
//  - adds black inverted-hull outlines around objects (manga line art)
// Runs as a post-build pass so the scene code stays untouched.

// 4-step toon ramp (dark -> light), nearest-filtered for hard bands.
const ramp = new Uint8Array([
  92, 92, 92, 255,
  150, 150, 150, 255,
  214, 214, 214, 255,
  255, 255, 255, 255,
]);
const gradient = new THREE.DataTexture(ramp, 4, 1, THREE.RGBAFormat);
gradient.magFilter = THREE.NearestFilter;
gradient.minFilter = THREE.NearestFilter;
gradient.needsUpdate = true;

const outlineMat = new THREE.MeshBasicMaterial({ color: 0x0a0f16, side: THREE.BackSide });

function toToon(m) {
  const toon = new THREE.MeshToonMaterial({
    color: m.color ? m.color.clone() : 0xffffff,
    map: m.map || null,
    gradientMap: gradient,
    emissive: m.emissive ? m.emissive.clone() : 0x000000,
    emissiveMap: m.emissiveMap || null,
    emissiveIntensity: m.emissiveIntensity ?? 1,
    transparent: m.transparent,
    opacity: m.opacity,
    side: m.side,
  });
  return toon;
}

function addOutline(mesh, scale) {
  const o = new THREE.Mesh(mesh.geometry, outlineMat);
  o.scale.multiplyScalar(scale);
  o.castShadow = false;
  o.receiveShadow = false;
  o.raycast = () => {}; // never block shooting / interaction rays
  mesh.add(o);
}

// root: scene or an object (e.g. camera holding the weapon view-model).
// outlineMaxRadius: only objects smaller than this get an outline, so big
// surfaces (floor/walls/ceiling/pipes) stay clean.
export function toonify(root, { outline = true, outlineMaxRadius = 5, outlineScale = 1.045 } = {}) {
  const meshes = [];
  root.traverse((o) => {
    if (o.isMesh) meshes.push(o);
  });
  for (const mesh of meshes) {
    const std = mesh.material && mesh.material.isMeshStandardMaterial;
    if (std) mesh.material = toToon(mesh.material);
    if (outline && std) {
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      const r = mesh.geometry.boundingSphere ? mesh.geometry.boundingSphere.radius : 0;
      if (r <= outlineMaxRadius) addOutline(mesh, outlineScale);
    }
  }
}
