// Bay PD: the wanted system. Heat 0..100 maps to 0..5 stars; crimes add heat,
// time bleeds it (slower while a cruiser or the helicopter can see you).
// Cruisers pursue and ram; at 3+ stars roadblocks appear; at 5 the helicopter
// circles overhead. On foot, a cruiser that catches you beats you down — get
// wasted and the run ends. Busted = caught on foot at close range for 2 s.
import * as THREE from 'three';
import { createVehicle } from './vehicle.js';
import { WANTED, POLICE_MAX } from './config.js';

const CRUISERS_PER_STAR = [0, 2, 3, 4, 5, 6];
const BUST_DIST = 3.5;
const BUST_TIME = 2;

function makeHeli() {
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshLambertMaterial({ color: 0x1c2f4a });
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.1, 5), bodyMat);
  const tail = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 4), bodyMat);
  tail.position.set(0, 0.2, -4);
  const rotorMat = new THREE.MeshLambertMaterial({ color: 0x222222 });
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(7, 0.08, 0.4), rotorMat);
  rotor.position.y = 0.8;
  const spot = new THREE.Mesh(
    new THREE.ConeGeometry(6, 40, 12, 1, true),
    new THREE.MeshBasicMaterial({ color: 0xfff2b0, transparent: true, opacity: 0.16, side: THREE.DoubleSide, depthWrite: false }),
  );
  spot.position.y = -20;
  spot.rotation.x = Math.PI;
  g.add(body, tail, rotor, spot);
  g.userData.rotor = rotor;
  g.userData.spot = spot;
  return g;
}

export function createPolice(world, random, scene) {
  const state = { heat: 0, stars: 0, bustTimer: 0 };
  const cruisers = [];
  const heli = makeHeli();
  heli.visible = false;
  scene.add(heli);
  let heliAngle = 0;

  function starsFor(heat) {
    let s = 0;
    for (let i = 1; i < WANTED.starAt.length; i += 1) {
      if (heat >= WANTED.starAt[i]) s = i;
    }
    return s;
  }

  function addHeat(amount, reason) {
    const before = state.stars;
    state.heat = Math.max(0, Math.min(100, state.heat + amount));
    state.stars = starsFor(state.heat);
    return { before, after: state.stars, reason };
  }

  function spawnCruiserNear(game, dist) {
    const p = world.streetPoint();
    // Push the spawn away from the player so cruisers arrive, not teleport in.
    const dx = p.x - game.player.x;
    const dz = p.z - game.player.z;
    const d = Math.hypot(dx, dz) || 1;
    const want = dist ?? 70;
    const x = game.player.x + (dx / d) * want;
    const z = game.player.z + (dz / d) * want;
    const fixed = world.collideCircle(x, z, 3);
    const car = createVehicle(world, 'police', fixed.x, fixed.z, Math.atan2(game.player.x - fixed.x, game.player.z - fixed.z), 0xf2f2f2);
    car.isCruiser = true;
    scene.add(car.mesh);
    cruisers.push(car);
    return car;
  }

  function step(dt, game) {
    // Heat decay: fast when no cruiser is near, slow while seen; the heli pins it.
    const nearest = cruisers.reduce((m, c) => Math.min(m, Math.hypot(c.x - game.player.x, c.z - game.player.z)), Infinity);
    const seen = nearest < 45 || state.stars >= 5;
    const decay = seen ? WANTED.decaySeenPerSec : WANTED.decayPerSec;
    if (state.heat > 0) {
      state.heat = Math.max(0, state.heat - decay * dt);
      state.stars = starsFor(state.heat);
    }

    // Cruiser count tracks the stars.
    const want = CRUISERS_PER_STAR[state.stars];
    while (cruisers.length < want) spawnCruiserNear(game, 70 + random() * 30);
    while (cruisers.length > want) {
      const c = cruisers.pop();
      scene.remove(c.mesh);
    }

    // Pursuit: steer at the player, ram on contact.
    for (const car of cruisers) {
      const tx = game.inCar ? game.vehicle.x : game.player.x;
      const tz = game.inCar ? game.vehicle.z : game.player.z;
      const dx = tx - car.x;
      const dz = tz - car.z;
      const d = Math.hypot(dx, dz) || 0.01;
      const desired = Math.atan2(dx, dz);
      let diff = desired - car.heading;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      const steer = Math.max(-1, Math.min(1, diff * 1.2));
      car.step(dt, { throttle: 1, steer, brake: false }, world);
      // Ram: push the player's car and scrape its speed.
      if (game.inCar && d < 4.8) {
        const ux = dx / d;
        const uz = dz / d;
        game.vehicle.x += ux * 1.2;
        game.vehicle.z += uz * 1.2;
        game.vehicle.speed *= 0.82;
        car.speed *= 0.6;
      }
    }

    // On foot: a cruiser within range beats you down; held there 2 s = busted.
    if (!game.inCar && state.stars > 0) {
      if (nearest < BUST_DIST) {
        state.bustTimer += dt;
        game.player.damage(9 * dt);
        if (state.bustTimer >= BUST_TIME && game.onBusted) game.onBusted();
        if (game.player.health <= 0 && game.onWasted) game.onWasted();
      } else {
        state.bustTimer = Math.max(0, state.bustTimer - dt * 2);
      }
    }

    // Helicopter at 5 stars: circles the player, spotlight follows, heat pinned.
    if (state.stars >= 5) {
      heli.visible = true;
      heliAngle += dt * 0.5;
      heli.position.set(
        game.player.x + Math.cos(heliAngle) * 22,
        42,
        game.player.z + Math.sin(heliAngle) * 22,
      );
      heli.rotation.y = -heliAngle;
      heli.userData.rotor.rotation.y += dt * 18;
      heli.userData.spot.lookAt(game.player.x, 0, game.player.z);
    } else {
      heli.visible = false;
    }
  }

  function reset() {
    state.heat = 0;
    state.stars = 0;
    state.bustTimer = 0;
    for (const c of cruisers) scene.remove(c.mesh);
    cruisers.length = 0;
    heli.visible = false;
  }

  return Object.assign(state, { cruisers, heli, addHeat, step, reset });
}
