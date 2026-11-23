// Rico "Reef" Marlowe on foot: third-person movement, sprint, jump, health.
// Pure movement + a simple humanoid mesh; the loop owns screens and actions.
import * as THREE from 'three';
import { WALK_SPEED, SPRINT_SPEED, JUMP_SPEED, GRAVITY, PLAYER } from './config.js';

const RADIUS = 0.55;

export function createPlayer(world, start) {
  const state = {
    x: start.x, z: start.z, y: 0, heading: 0,
    vy: 0, onGround: true, health: PLAYER.health,
    walkCycle: 0, moving: false,
  };

  // Simple humanoid: jacket body, head, legs — readable at third-person range.
  const mesh = new THREE.Group();
  const jacket = new THREE.MeshLambertMaterial({ color: 0x2e6f8e });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const denim = new THREE.MeshLambertMaterial({ color: 0x2c3e55 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.95, 8), jacket);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.78;
  const legL = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.6, 0.22), denim);
  legL.position.set(-0.14, 0.3, 0);
  const legR = legL.clone();
  legR.position.x = 0.14;
  mesh.add(body, head, legL, legR);
  mesh.position.set(state.x, 0, state.z);

  function step(dt, move, camYaw) {
    const speed = move.sprint ? SPRINT_SPEED : WALK_SPEED;
    // Movement is camera-relative: W walks away from the camera, i.e. along
    // (sin yaw, cos yaw) — the direction the camera looks.
    const sin = Math.sin(camYaw);
    const cos = Math.cos(camYaw);
    let mx = (sin * move.fwd + cos * move.strafe);
    let mz = (cos * move.fwd - sin * move.strafe);
    const len = Math.hypot(mx, mz);
    state.moving = len > 0.01;
    if (state.moving) {
      mx /= len;
      mz /= len;
      const targetHeading = Math.atan2(mx, mz);
      // Turn toward the movement direction (shortest arc).
      let diff = targetHeading - state.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      state.heading += diff * Math.min(1, dt * 12);
      state.walkCycle += dt * speed * 1.6;
    }
    let nx = state.x + mx * speed * dt;
    let nz = state.z + mz * speed * dt;
    const fixed = world.collideCircle(nx, nz, RADIUS);
    state.x = fixed.x;
    state.z = fixed.z;

    // Jump + gravity.
    if (state.onGround && move.jump) {
      state.vy = JUMP_SPEED;
      state.onGround = false;
    }
    state.vy -= GRAVITY * dt;
    state.y += state.vy * dt;
    if (state.y <= 0) {
      state.y = 0;
      state.vy = 0;
      state.onGround = true;
    }

    mesh.position.set(state.x, state.y + (state.moving ? Math.abs(Math.sin(state.walkCycle)) * 0.06 : 0), state.z);
    mesh.rotation.y = state.heading;
  }

  function damage(amount) {
    state.health = Math.max(0, state.health - amount);
    return state.health <= 0;
  }

  function heal(amount) {
    state.health = Math.min(PLAYER.health, state.health + amount);
  }

  function reset(pos) {
    state.x = pos.x;
    state.z = pos.z;
    state.y = 0;
    state.vy = 0;
    state.health = PLAYER.health;
    mesh.position.set(state.x, 0, state.z);
  }

  return Object.assign(state, { mesh, step, damage, heal, reset });
}
