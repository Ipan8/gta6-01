// The screenshot scenes behind ?shot=cover|drive|mission|start. Each one plays
// the real rules forward from a fresh world for a fixed number of steps, so the
// frame is what a short game really looks like — and the same seed always
// gives (nearly) the same frame. 'play' and 'end' are aliases for drive and
// mission (the kit's starter names).
import { STEP, BLOCK } from './config.js';
import { SCREEN_TITLE, SCREEN_PLAY } from './render.js';
import { createVehicle } from './vehicle.js';

const DRIVE_SECONDS = 12;
const COVER_SECONDS = 14;
const MISSION_SECONDS = 5;

/** Waypoint follower: the car steers toward the next street-grid waypoint
 * (pure pursuit), so it stays on the roads instead of cutting through blocks.
 * The route is a deterministic loop: 2 blocks, turn right, repeat. */
function autopilotDrive(car, world, dt, route, time) {
  const half = world.half;
  const edge = half - BLOCK - 24;
  if (!route.wp) {
    // First waypoint: the intersection 2 blocks AHEAD along the car's heading
    // (never behind — a U-turn from a standstill is how the car gets wedged).
    const gridLine = (v) => Math.round((v + half) / BLOCK) * BLOCK - half;
    const hx = Math.sin(car.heading);
    const hz = Math.cos(car.heading);
    if (Math.abs(hx) > Math.abs(hz)) {
      route.dir = hx > 0 ? 1 : 3; // +x / -x
      const nx = Math.max(-edge, Math.min(edge, gridLine(car.x + (hx > 0 ? 96 : -96))));
      route.wp = { x: nx, z: gridLine(car.z) };
    } else {
      route.dir = hz > 0 ? 0 : 2; // +z / -z
      const nz = Math.max(-edge, Math.min(edge, gridLine(car.z + (hz > 0 ? 96 : -96))));
      route.wp = { x: gridLine(car.x), z: nz };
    }
  }
  const dx = route.wp.x - car.x;
  const dz = route.wp.z - car.z;
  if (Math.hypot(dx, dz) < 7) {
    // Reached the waypoint: advance 2 blocks in the next (right-turn) direction.
    route.dir = (route.dir + 1) % 4;
    const step = BLOCK * 2;
    const dirs = [[0, 1], [1, 0], [0, -1], [-1, 0]];
    const [ux, uz] = dirs[route.dir];
    // Keep waypoints off the beach (south strip) and harbour (east strip):
    // those are sand/water, not streets.
    route.wp = {
      x: Math.max(-edge, Math.min(edge, route.wp.x + ux * step)),
      z: Math.max(-edge, Math.min(edge, route.wp.z + uz * step)),
    };
  }
  const desired = Math.atan2(route.wp.x - car.x, route.wp.z - car.z);
  let diff = desired - car.heading;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  const steer = Math.max(-1, Math.min(1, diff * 1.4));
  // Sharp turn (>60 deg): slow down so the car turns tight instead of
  // wide-arcing into a building. Stuck (barely moving for 1 s): reverse out
  // for 0.7 s, then carry on.
  const sharp = Math.abs(diff) > 1.05;
  route.slowUntil = sharp ? time + 0.5 : route.slowUntil;
  const slow = time < (route.slowUntil || 0);
  if (Math.abs(car.speed) < 2) {
    route.stuckFor = (route.stuckFor || 0) + dt;
  } else {
    route.stuckFor = 0;
  }
  if (route.stuckFor > 1 && !route.reverseUntil) route.reverseUntil = time + 0.7;
  if (route.reverseUntil && time >= route.reverseUntil) {
    route.reverseUntil = 0;
    route.stuckFor = 0;
  }
  const reversing = Boolean(route.reverseUntil);
  car.step(dt, { throttle: reversing ? -1 : slow ? 0.4 : 1, steer: reversing ? -steer : steer, brake: false }, world);
}

function simSteps(game, seconds, driveCar) {
  const route = {};
  const steps = Math.floor(seconds / STEP);
  for (let i = 0; i < steps; i += 1) {
    game.time += STEP;
    if (driveCar) autopilotDrive(driveCar, game.world, STEP, route, game.time);
    game.traffic.step(STEP, game);
    game.police.step(STEP, game);
    game.missions.step(STEP, game);
    game.combat.step(STEP, game);
  }
}

function freshState(game, renderer) {
  const world = game.world;
  game.player.reset(world.landmarks.garage);
  game.police.reset();
  game.combat.reset();
  game.missions.reset();
  game.cash = 250;
  game.time = 0;
  game.inCar = false;
  game.vehicle = null;
  renderer.add(game.player.mesh);
}

function enterCar(game, renderer, car) {
  game.vehicle = car;
  game.inCar = true;
  renderer.remove(game.player.mesh);
}

/**
 * Set the game to the named scene and return the screen to draw over it.
 * Cover is the hero shot: a dusk chase with Bay PD on your tail.
 */
export function stageShot(name, game, renderer, random) {
  const world = game.world;
  freshState(game, renderer);
  const norm = name === 'play' || name === 'drive' ? 'drive'
    : name === 'end' || name === 'mission' ? 'mission'
    : name === 'cover' ? 'cover' : 'start';

  if (norm === 'start') {
    // Title backdrop: Rico on foot by the garage, city behind.
    renderer.camState.yaw = 0.6;
    renderer.camState.pitch = 0.5;
    renderer.camState.dist = 60;
    return {
      screen: SCREEN_TITLE,
      title: 'SOLMARA HEAT',
      lines: [
        'Solmara Bay. You are Rico \u201cReef\u201d Marlowe, wheelman fresh out of a 3-year stretch.',
        'Take jobs for Mama Sol\u2019s crew. Steal cars, lose the cops, survive the heat.',
        'WASD move / drive \u00b7 mouse drag to look \u00b7 E enter or exit a car \u00b7 click to shoot \u00b7 R reload \u00b7 F interact \u00b7 P pause.',
      ],
      prompt: 'Press Space or click to start',
    };
  }

  if (norm === 'drive') {
    // A straight run down a long street: Rico in a sedan at speed, the city
    // streaming past. No turns — the frame catches the car moving, not turning.
    const car = game.traffic.cars.find((c) => c.cls === 'sedan') || game.traffic.cars[0];
    // Place the car on the x=-144 street near the south end, heading north.
    car.x = -144 + 2.2;
    car.z = -180;
    car.heading = 0;
    car.speed = 0;
    car.mesh.position.set(car.x, 0, car.z);
    car.mesh.rotation.y = car.heading;
    game.player.x = car.x - 3;
    game.player.z = car.z;
    game.player.mesh.position.set(game.player.x, 0, game.player.z);
    enterCar(game, renderer, car);
    // Straight run: steer to the street centre-line, throttle open.
    const gridLine = (v) => Math.round((v + world.half) / BLOCK) * BLOCK - world.half;
    const steps = Math.floor(DRIVE_SECONDS / STEP);
    for (let i = 0; i < steps; i += 1) {
      game.time += STEP;
      const laneX = gridLine(car.x) + 2.2;
      const steer = Math.max(-1, Math.min(1, (laneX - car.x) * 0.3));
      car.step(STEP, { throttle: 1, steer, brake: false }, world);
      game.traffic.step(STEP, game);
      game.police.step(STEP, game);
      game.missions.step(STEP, game);
      game.combat.step(STEP, game);
    }
    return { screen: SCREEN_PLAY };
  }

  if (norm === 'mission') {
    // M3 Repo Job: Rico on foot at the harbour lot, the Vortex GT in front of
    // him, two rivals closing in, 2 stars of heat.
    game.missions.index = 2;
    game.player.x = world.landmarks.harbourLot.x - 12;
    game.player.z = world.landmarks.harbourLot.z + 6;
    game.player.mesh.position.set(game.player.x, 0, game.player.z);
    game.police.addHeat(32, 'scripted');
    simSteps(game, 1, null); // start M3 (creates the Vortex GT) + spawn a cruiser
    game.combat.spawnEnemy(world.landmarks.harbourLot.x + 14, world.landmarks.harbourLot.z - 8);
    game.combat.spawnEnemy(world.landmarks.harbourLot.x + 18, world.landmarks.harbourLot.z + 10);
    simSteps(game, MISSION_SECONDS, null);
    renderer.camState.yaw = Math.atan2(
      world.landmarks.harbourLot.x - game.player.x,
      world.landmarks.harbourLot.z - game.player.z,
    );
    renderer.camState.pitch = 0.45;
    renderer.camState.dist = 10;
    return { screen: SCREEN_PLAY };
  }

  // Cover: 3 stars, a sports car at full speed down a long street, Bay PD in
  // pursuit behind (visible on the minimap). A straight run, like the drive
  // shot — the frame catches the car moving, not turning into a wall.
  const sports = game.traffic.cars.find((c) => c.cls === 'sports')
    || createVehicle(world, 'sports', -60, -60, 0);
  if (!game.traffic.cars.includes(sports)) {
    renderer.add(sports.mesh);
  }
  // Place the car on the x=-144 street near the south end, heading north.
  sports.x = -144 + 2.2;
  sports.z = -180;
  sports.heading = 0;
  sports.speed = 0;
  sports.mesh.position.set(sports.x, 0, sports.z);
  sports.mesh.rotation.y = sports.heading;
  game.player.x = sports.x - 3;
  game.player.z = sports.z;
  game.player.mesh.position.set(game.player.x, 0, game.player.z);
  enterCar(game, renderer, sports);
  const gridLine = (v) => Math.round((v + world.half) / BLOCK) * BLOCK - world.half;
  // Straight run in two parts: first 6 s alone, so the car is already at
  // speed when Bay PD is called in — then 8 s of chase. If the cruisers spawn
  // on top of a standing car they ram it to a stop; at 80 km/h they trail it.
  function straightRun(seconds) {
    const steps = Math.floor(seconds / STEP);
    for (let i = 0; i < steps; i += 1) {
      game.time += STEP;
      const laneX = gridLine(sports.x) + 2.2;
      const steer = Math.max(-1, Math.min(1, (laneX - sports.x) * 0.3));
      sports.step(STEP, { throttle: 1, steer, brake: false }, world);
      game.traffic.step(STEP, game);
      game.police.step(STEP, game);
      game.missions.step(STEP, game);
      game.combat.step(STEP, game);
    }
  }
  straightRun(6);
  game.police.addHeat(58, 'scripted');
  straightRun(COVER_SECONDS - 6);
  // Heat bled off during the chase; top it back up so the cover shows 3 stars.
  game.police.addHeat(25, 'scripted');
  return { screen: SCREEN_PLAY };
}
