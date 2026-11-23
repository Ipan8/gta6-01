// Cars: arcade handling for the player, traffic and police alike. One car is
// a Group (body + cabin + wheels + lights); step() advances arcade physics
// and slides along buildings. Colours come from CAR_CLASSES; police cars pass
// their own palette.
import * as THREE from 'three';
import { CAR_CLASSES } from './config.js';

const RADIUS = 2.3;

export function createVehicle(world, cls, x, z, heading, overrideColor) {
  const spec = CAR_CLASSES[cls] || CAR_CLASSES.sedan;
  const color = overrideColor ?? spec.color;
  const state = {
    cls, x, z, heading, speed: 0, steer: 0,
    topSpeed: spec.topSpeed, accel: spec.accel, turn: spec.turn,
  };

  const mesh = new THREE.Group();
  const paint = new THREE.MeshLambertMaterial({ color });
  const glass = new THREE.MeshLambertMaterial({ color: 0x1a2733 });
  const tyre = new THREE.MeshLambertMaterial({ color: 0x141414 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.0, 0.62, 4.4), paint);
  body.position.y = 0.55;
  const cabin = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.55, 2.1), glass);
  cabin.position.set(0, 1.1, -0.2);
  mesh.add(body, cabin);
  const wheelGeo = new THREE.CylinderGeometry(0.38, 0.38, 0.3, 10);
  wheelGeo.rotateZ(Math.PI / 2);
  const wheels = [];
  for (const [wx, wz] of [[-0.95, 1.45], [0.95, 1.45], [-0.95, -1.45], [0.95, -1.45]]) {
    const wheel = new THREE.Mesh(wheelGeo, tyre);
    wheel.position.set(wx, 0.38, wz);
    mesh.add(wheel);
    wheels.push(wheel);
  }
  // Headlights + taillights.
  const headMat = new THREE.MeshLambertMaterial({ color: 0xfff6c8, emissive: 0xaa8800 });
  const tailMat = new THREE.MeshLambertMaterial({ color: 0xcc2222, emissive: 0x660000 });
  for (const s of [-0.6, 0.6]) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), headMat);
    h.position.set(s, 0.6, 2.22);
    mesh.add(h);
    const t = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.18, 0.1), tailMat);
    t.position.set(s, 0.6, -2.22);
    mesh.add(t);
  }
  // Police light bar (only when this car is a cruiser).
  if (cls === 'police') {
    const red = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshLambertMaterial({ color: 0xff2222, emissive: 0x880000 }));
    red.position.set(-0.4, 1.45, -0.2);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.16, 0.3), new THREE.MeshLambertMaterial({ color: 0x2244ff, emissive: 0x000088 }));
    blue.position.set(0.4, 1.45, -0.2);
    mesh.add(red, blue);
  }
  mesh.position.set(x, 0, z);
  mesh.rotation.y = heading;

  /**
   * Arcade step. `drive` = {throttle -1..1, steer -1..1, brake bool}.
   * Returns true when the car hit a building this step (for crash effects).
   */
  function step(dt, drive) {
    const accel = drive.throttle * state.accel;
    state.speed += accel * dt;
    // Drag + rolling resistance; brake is stronger.
    const drag = drive.brake ? 14 : 2.2;
    state.speed -= state.speed * drag * dt * 0.4;
    if (Math.abs(state.speed) < 0.05 && drive.throttle === 0) state.speed = 0;
    state.speed = Math.max(-state.topSpeed * 0.45, Math.min(state.topSpeed, state.speed));
    // Steering scales with speed (no turning while parked) and flips in reverse.
    const steerTarget = drive.steer * state.turn * Math.min(1, Math.abs(state.speed) / 8) * Math.sign(state.speed || 1);
    state.steer += (steerTarget - state.steer) * Math.min(1, dt * 8);
    state.heading += state.steer * dt * (state.speed >= 0 ? 1 : -1);
    const px = state.x;
    const pz = state.z;
    const nx = state.x + Math.sin(state.heading) * state.speed * dt;
    const nz = state.z + Math.cos(state.heading) * state.speed * dt;
    const fixed = world.collideCircle(nx, nz, RADIUS);
    const hit = Math.abs(fixed.x - nx) > 0.01 || Math.abs(fixed.z - nz) > 0.01;
    if (hit) state.speed *= 0.55; // scrape off speed on a wall
    state.x = fixed.x;
    state.z = fixed.z;
    // Keep the car inside the world even when pushed by traffic.
    if (state.x !== px || state.z !== pz) {
      mesh.position.set(state.x, 0, state.z);
      mesh.rotation.y = state.heading;
      for (const w of wheels) w.rotation.x += state.speed * dt * 2.6;
    }
    return hit;
  }

  return Object.assign(state, { mesh, step, radius: RADIUS });
}
