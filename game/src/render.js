// Drawing only: the Three.js scene, camera rig and minimap. The static city is
// built once from world data; cars, people and police are Groups other modules
// own and add to this scene. HUD text lives in hud.js (DOM), not here.
import * as THREE from 'three';
import { CITY_SIZE, BLOCK } from './config.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';

const SKY = 0x8ec9ee;
const FOG_COLOR = 0xa8c8e0;

function lighten(hex, amount) {
  const c = new THREE.Color(hex);
  c.offsetHSL(0, 0, amount);
  return c;
}

export function createRenderer(canvas, world) {
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(FOG_COLOR, 220, 700);

  const camera = new THREE.PerspectiveCamera(62, 1, 0.1, 1200);
  camera.position.set(0, 60, 90);

  // Sun + sky fill.
  const sun = new THREE.DirectionalLight(0xfff2d8, 2.2);
  sun.position.set(120, 180, 60);
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0xbfd9ff, 0x8a7a5a, 1.1));

  const half = world.half;
  const groundMat = new THREE.MeshLambertMaterial({ color: 0xb0a184 });
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(CITY_SIZE, CITY_SIZE), groundMat);
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);

  // Roads: dark asphalt strips along every street centre-line.
  const roadMat = new THREE.MeshLambertMaterial({ color: 0x3c3f46 });
  for (const r of world.roads) {
    const len = Math.hypot(r.x2 - r.x1, r.z2 - r.z1);
    const strip = new THREE.Mesh(new THREE.PlaneGeometry(len, world.streetWidth), roadMat);
    strip.rotation.x = -Math.PI / 2;
    strip.rotation.z = r.x1 === r.x2 ? Math.PI / 2 : 0;
    strip.position.set((r.x1 + r.x2) / 2, 0.02, (r.z1 + r.z2) / 2);
    scene.add(strip);
  }

  // Beach (south strip) + harbour water (east strip).
  const beach = new THREE.Mesh(
    new THREE.PlaneGeometry(CITY_SIZE, BLOCK),
    new THREE.MeshLambertMaterial({ color: 0xe8d5a0 }),
  );
  beach.rotation.x = -Math.PI / 2;
  beach.position.set(0, 0.03, half - BLOCK / 2);
  scene.add(beach);
  const water = new THREE.Mesh(
    new THREE.PlaneGeometry(BLOCK, CITY_SIZE),
    new THREE.MeshLambertMaterial({ color: 0x2e7fa8 }),
  );
  water.rotation.x = -Math.PI / 2;
  water.position.set(half - BLOCK / 2, 0.03, 0);
  scene.add(water);

  // Buildings: one box each, top face lightened like a sun-bleached roof.
  const matCache = new Map();
  function materialsFor(color) {
    if (!matCache.has(color)) {
      const side = new THREE.MeshLambertMaterial({ color });
      const top = new THREE.MeshLambertMaterial({ color: lighten(color, 0.12) });
      matCache.set(color, [side, side, top, side, side, side]);
    }
    return matCache.get(color);
  }
  const boxGeo = new THREE.BoxGeometry(1, 1, 1);
  for (const b of world.buildings) {
    const mesh = new THREE.Mesh(boxGeo, materialsFor(b.color));
    mesh.scale.set(b.w, b.h, b.d);
    mesh.position.set(b.x, b.h / 2, b.z);
    scene.add(mesh);
  }

  // Palms: instanced trunks + canopies.
  const palmCount = world.palms.length;
  const trunkGeo = new THREE.CylinderGeometry(0.14, 0.26, 1, 5);
  const trunkMat = new THREE.MeshLambertMaterial({ color: 0x7a5a38 });
  const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, palmCount);
  const canopyGeo = new THREE.IcosahedronGeometry(1.7, 0);
  const canopyMat = new THREE.MeshLambertMaterial({ color: 0x3f8f4f });
  const canopies = new THREE.InstancedMesh(canopyGeo, canopyMat, palmCount);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3();
    const p = new THREE.Vector3();
    for (let i = 0; i < palmCount; i += 1) {
      const palm = world.palms[i];
      m.compose(p.set(palm.x, palm.h / 2, palm.z), q, s.set(1, palm.h, 1));
      trunks.setMatrixAt(i, m);
      m.compose(p.set(palm.x, palm.h + 0.6, palm.z), q, s.set(1, 0.55, 1));
      canopies.setMatrixAt(i, m);
    }
  }
  scene.add(trunks);
  scene.add(canopies);

  // Lamps: instanced poles with a small glowing head.
  const lampCount = world.lamps.length;
  const poleGeo = new THREE.CylinderGeometry(0.08, 0.08, 5, 5);
  const poleMat = new THREE.MeshLambertMaterial({ color: 0x2c2f36 });
  const poles = new THREE.InstancedMesh(poleGeo, poleMat, lampCount);
  const headGeo = new THREE.SphereGeometry(0.28, 6, 5);
  const headMat = new THREE.MeshLambertMaterial({ color: 0xffe9a8, emissive: 0xcc9900 });
  const heads = new THREE.InstancedMesh(headGeo, headMat, lampCount);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const s = new THREE.Vector3(1, 1, 1);
    const p = new THREE.Vector3();
    for (let i = 0; i < lampCount; i += 1) {
      const lamp = world.lamps[i];
      m.compose(p.set(lamp.x, 2.5, lamp.z), q, s);
      poles.setMatrixAt(i, m);
      m.compose(p.set(lamp.x, 5.1, lamp.z), q, s);
      heads.setMatrixAt(i, m);
    }
  }
  scene.add(poles);
  scene.add(heads);

  // Objective beacon: a tall translucent pillar, moved by missions.js.
  // Kept faint (opacity 0.15) so it marks the target without washing the
  // frame when the chase camera passes close by it.
  const beacon = new THREE.Mesh(
    new THREE.CylinderGeometry(1.2, 1.2, 90, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xffd23e, transparent: true, opacity: 0.15, side: THREE.DoubleSide, depthWrite: false }),
  );
  beacon.position.set(0, 45, 0);
  beacon.visible = false;
  scene.add(beacon);

  function resize() {
    const w = window.innerWidth;
    const h = window.innerHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
  }
  window.addEventListener('resize', resize);
  resize();

  // Third-person camera: follows `target` {x, z, heading} with orbit yaw/pitch.
  // In a car the camera chases behind the heading; on foot it orbits freely.
  // The camera never sits inside a building: if the computed spot is blocked,
  // it is pulled in toward the target until it clears the roofline.
  const camState = { yaw: 0, pitch: 0.32, dist: 11 };
  function updateCamera(target, dt, inCar) {
    const desiredDist = inCar ? 13 : 10;
    camState.dist += (desiredDist - camState.dist) * Math.min(1, dt * 6);
    const yaw = inCar ? target.heading + Math.PI : camState.yaw;
    let dist = camState.dist;
    let px = 0;
    let py = 0;
    let pz = 0;
    // Never pull in closer than 7: any closer and the car (or the player)
    // slides out of frame. If the spot is still blocked at 7, accept it —
    // the camera is at worst hugging a wall, never inside one for long.
    for (let tries = 0; tries < 12; tries += 1) {
      px = target.x - Math.sin(yaw) * Math.cos(camState.pitch) * dist;
      pz = target.z - Math.cos(yaw) * Math.cos(camState.pitch) * dist;
      py = (target.y ?? 1.6) + Math.sin(camState.pitch) * dist + 1.2;
      if (world.buildingHeightAt(px, pz) < py - 0.5 || dist <= 7) break;
      dist -= 0.75;
    }
    camera.position.set(px, Math.max(py, 1.2), pz);
    camera.lookAt(target.x, (target.y ?? 1.6) + 1.4, target.z);
  }

  /** One frame: move the camera, paint the scene. */
  function render(game, dt) {
    const target = game.inCar && game.vehicle
      ? { x: game.vehicle.x, z: game.vehicle.z, y: 1, heading: game.vehicle.heading }
      : { x: game.player.x, z: game.player.z, y: game.player.y, heading: game.player.heading };
    updateCamera(target, dt, Boolean(game.inCar));
    renderer.render(scene, camera);
  }

  return {
    scene, camera, beacon, camState,
    render, resize,
    add(group) { scene.add(group); },
    remove(group) { scene.remove(group); },
  };
}
