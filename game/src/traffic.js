// Street life: AI traffic cars on the road grid (with traffic lights) and
// pedestrians on the sidewalks who flee gunfire and crashes. Traffic cars are
// solid: the player's car bumps them, and a hard hit raises wanted heat.
import * as THREE from 'three';
import { createVehicle } from './vehicle.js';
import { TRAFFIC_CARS, PEDESTRIANS, BLOCK, WANTED } from './config.js';

const PED_COLORS = [0xd8a05a, 0x5a8fd8, 0xc25a7a, 0x7ac25a, 0xd8d8d8, 0x8a5ad8, 0x3a3a3a];
const CAR_CLASSES = ['sedan', 'taxi', 'pickup', 'sedan', 'sports'];

/** Traffic-light state at time t: true = north-south green, false = east-west green. */
function nsGreen(t) {
  return Math.floor(t / 12) % 2 === 0;
}

function makePedMesh(color) {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color });
  const skin = new THREE.MeshLambertMaterial({ color: 0xc98d64 });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.3, 0.8, 7), shirt);
  body.position.y = 0.85;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 7), skin);
  head.position.y = 1.45;
  g.add(body, head);
  return g;
}

export function createTraffic(world, random, scene) {
  const cars = [];
  const peds = [];
  const half = world.half;

  function randomStreetPoint() {
    const p = world.streetPoint();
    return { x: p.x, z: p.z, heading: p.heading };
  }

  for (let i = 0; i < TRAFFIC_CARS; i += 1) {
    const p = randomStreetPoint();
    const cls = CAR_CLASSES[Math.floor(random() * CAR_CLASSES.length)];
    const car = createVehicle(world, cls, p.x, p.z, p.heading);
    car.targetSpeed = 8 + random() * 6;
    car.nextTurnAt = 0;
    scene.add(car.mesh);
    cars.push(car);
  }

  for (let i = 0; i < PEDESTRIANS; i += 1) {
    // Sidewalk: offset just outside a street edge, inside a block edge.
    const vertical = random() < 0.5;
    const line = -half + Math.floor(random() * 13) * BLOCK;
    const along = -half + 10 + random() * (world.citySize - 20);
    const x = vertical ? line + 7 : along;
    const z = vertical ? along : line + 7;
    const mesh = makePedMesh(PED_COLORS[Math.floor(random() * PED_COLORS.length)]);
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    peds.push({
      x, z, heading: random() * Math.PI * 2, speed: 1.2 + random() * 0.8,
      mesh, fleeUntil: 0, walkCycle: random() * 6,
    });
  }

  /** Nearest intersection centre ahead of (x, z) on the car's axis, or null. */
  function intersectionAhead(car) {
    const gridLine = (v) => Math.round((v + half) / BLOCK) * BLOCK - half;
    // Distance to the next grid line in the car's heading direction.
    const hx = Math.sin(car.heading);
    const hz = Math.cos(car.heading);
    const axis = Math.abs(hx) > Math.abs(hz) ? 'x' : 'z';
    const pos = axis === 'x' ? car.x : car.z;
    const dir = axis === 'x' ? Math.sign(hx) : Math.sign(hz);
    const next = gridLine(pos) + (dir > 0 ? BLOCK : 0);
    const dist = (next - pos) * dir;
    if (dist < 0 || dist > 16) return null;
    return { dist, axis };
  }

  function step(dt, game) {
    const t = game.time;
    const playerCar = game.inCar ? game.vehicle : null;

    for (const car of cars) {
      // The player's car is driven by the player, not by traffic AI.
      if (game.vehicle === car) continue;
      // Traffic light: stop before a red intersection.
      let throttle = 0.6;
      const inter = intersectionAhead(car);
      if (inter) {
        const green = inter.axis === 'z' ? nsGreen(t) : !nsGreen(t);
        if (!green && inter.dist < 12) throttle = 0;
      }
      // Car ahead: slow down instead of rear-ending it.
      for (const other of cars) {
        if (other === car) continue;
        const dx = other.x - car.x;
        const dz = other.z - car.z;
        const d = Math.hypot(dx, dz);
        if (d < 9) {
          const ahead = dx * Math.sin(car.heading) + dz * Math.cos(car.heading);
          if (ahead > 0) throttle = Math.min(throttle, 0.15);
        }
      }
      // Random turns at intersections: pick a new heading sometimes.
      if (game.time > car.nextTurnAt) {
        car.nextTurnAt = game.time + 6 + random() * 10;
        const turn = [-Math.PI / 2, 0, 0, Math.PI / 2][Math.floor(random() * 4)];
        car.heading += turn;
      }
      // Steer back toward the nearest street centre-line.
      const gridLine = (v) => Math.round((v + half) / BLOCK) * BLOCK - half;
      const onVertical = Math.abs(Math.sin(car.heading)) > 0.7;
      const lanePos = onVertical ? gridLine(car.x) + 2.2 : gridLine(car.z) + 2.2;
      const off = onVertical ? car.x - lanePos : car.z - lanePos;
      const steer = Math.max(-1, Math.min(1, -off * 0.25));
      car.step(dt, { throttle, steer, brake: throttle === 0 }, game.world);

      // Solid vs the player's car: push apart, scrape speed, add heat on a hard hit.
      if (playerCar) {
        const dx = playerCar.x - car.x;
        const dz = playerCar.z - car.z;
        const d = Math.hypot(dx, dz);
        if (d < 4.6 && d > 0.01) {
          const push = (4.6 - d) / 2;
          const ux = dx / d;
          const uz = dz / d;
          playerCar.x += ux * push;
          playerCar.z += uz * push;
          car.x -= ux * push;
          car.z -= uz * push;
          const impact = Math.abs(playerCar.speed);
          playerCar.speed *= 0.6;
          car.speed *= 0.5;
          if (impact > 12 && game.addHeat) game.addHeat(WANTED.crimeHeat.crashPed * 0.5, 'crash');
        }
      }
    }

    for (const ped of peds) {
      const fleeing = t < ped.fleeUntil;
      const speed = fleeing ? 5.5 : ped.speed;
      let hx = Math.sin(ped.heading);
      let hz = Math.cos(ped.heading);
      // Flee: run away from the player when gunfire/crashes happen nearby.
      if (fleeing) {
        const dx = ped.x - game.player.x;
        const dz = ped.z - game.player.z;
        const d = Math.hypot(dx, dz) || 1;
        hx = dx / d;
        hz = dz / d;
        ped.heading = Math.atan2(hx, hz);
      }
      let nx = ped.x + hx * speed * dt;
      let nz = ped.z + hz * speed * dt;
      // Turn at block corners / city edge instead of walking through buildings.
      if (world.insideBuilding(nx, nz) || Math.abs(nx) > half - 4 || Math.abs(nz) > half - 4) {
        ped.heading += Math.PI / 2 + (random() - 0.5) * 0.6;
        nx = ped.x;
        nz = ped.z;
      }
      ped.x = nx;
      ped.z = nz;
      ped.walkCycle += dt * speed * 2;
      ped.mesh.position.set(ped.x, Math.abs(Math.sin(ped.walkCycle)) * 0.04, ped.z);
      ped.mesh.rotation.y = ped.heading;
    }
  }

  /** Scare nearby peds (gunfire, explosion, hard crash). */
  function scare(x, z, radius, durationSec, now) {
    for (const ped of peds) {
      if (Math.hypot(ped.x - x, ped.z - z) < radius) ped.fleeUntil = now + durationSec;
    }
  }

  return { cars, peds, step, scare };
}
