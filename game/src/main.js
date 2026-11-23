// SOLMARA HEAT — boot and the one loop. Input is read every frame, the world
// advances in fixed 1/60 s steps, and the renderer paints what is there.
// Screens: title, play, paused, game over, complete (all five jobs done).
//
// ?seed=N fixes the city and the traffic. ?shot=cover|drive|mission|start
// (with &seed=N) stages that scene instead of running the loop, paints it
// twice and sets window.__shotReady for a screenshot.
import { STEP, WANTED, CAR_ENTER_DIST, PLAYER } from './config.js';
import { createRandom } from './random.js';
import { createWorld } from './world.js';
import { createRenderer } from './render.js';
import { createInput, ACTION_CONFIRM, ACTION_PAUSE, ACTION_ENTER, ACTION_JUMP, ACTION_INTERACT, ACTION_RELOAD } from './input.js';
import { createPlayer } from './player.js';
import { createTraffic } from './traffic.js';
import { createPolice } from './police.js';
import { createMissions } from './missions.js';
import { createCombat } from './combat.js';
import { createHud } from './hud.js';
import { createSound } from './sound.js';
import { saveGame, loadGame, readBestCash, saveBestCash } from './save.js';
import { stageShot } from './shots.js';

export const SCREEN_TITLE = 'title';
export const SCREEN_PLAY = 'play';
export const SCREEN_PAUSED = 'paused';
export const SCREEN_OVER = 'over';
export const SCREEN_COMPLETE = 'complete';

const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);
const random = createRandom(seed);

const world = createWorld(random);
const canvas = document.getElementById('game');
const renderer = createRenderer(canvas, world);
const hud = createHud(world);
const sound = createSound();
const input = createInput(canvas);

const player = createPlayer(world, world.landmarks.garage);
renderer.add(player.mesh);
const traffic = createTraffic(world, random, renderer.scene);
const police = createPolice(world, random, renderer.scene);
const missions = createMissions(world, renderer.scene, random);
const combat = createCombat(world, renderer.scene, renderer);

const saved = loadGame();
const game = {
  world, player, vehicle: null, inCar: false,
  cash: saved?.cash ?? PLAYER.startCash,
  time: 0,
  police, traffic, combat, missions,
  beacon: renderer.beacon,
  hud, sound,
  addHeat(amount, reason) {
    const r = police.addHeat(amount, reason);
    if (r.after > r.before) hud.banner(`${r.after} star${r.after > 1 ? 's' : ''} wanted`, 'Bay PD is on you');
    return r;
  },
  banner(title, sub) { hud.banner(title, sub); },
  onBusted() { endRun('busted'); },
  onWasted() { endRun('wasted'); },
  onAllMissionsDone() { endRun('complete'); },
};
if (saved?.missionIndex) {
  missions.index = Math.min(saved.missionIndex, 5);
}

let screen = SCREEN_TITLE;
let best = readBestCash();
let runEnded = false;

function nearestCar(maxDist) {
  let bestCar = null;
  let bestD = maxDist;
  const candidates = [...traffic.cars];
  if (missions.missionCar) candidates.push(missions.missionCar);
  for (const car of candidates) {
    const d = Math.hypot(car.x - player.x, car.z - player.z);
    if (d < bestD) { bestD = d; bestCar = car; }
  }
  return bestCar;
}

function enterCar() {
  const car = nearestCar(CAR_ENTER_DIST);
  if (!car) return;
  game.vehicle = car;
  game.inCar = true;
  renderer.remove(player.mesh);
  sound.setEngineOn(true);
  if (!car.isMissionCar && !car.wasStolen) {
    car.wasStolen = true;
    game.addHeat(WANTED.crimeHeat.stealCar, 'steal');
    if (Math.random() < 0.3) game.addHeat(WANTED.crimeHeat.alarm, 'alarm');
    hud.banner('Car stolen', 'Bay PD is on you');
  }
  hud.announce('Driving.');
}

function exitCar() {
  if (!game.vehicle) return;
  const car = game.vehicle;
  const side = world.collideCircle(car.x - Math.cos(car.heading) * 3, car.z + Math.sin(car.heading) * 3, 0.6);
  player.x = side.x;
  player.z = side.z;
  player.y = 0;
  player.mesh.position.set(player.x, 0, player.z);
  renderer.add(player.mesh);
  game.vehicle = null;
  game.inCar = false;
  sound.setEngineOn(false);
  hud.announce('On foot.');
}

function persist() {
  saveGame({ cash: game.cash, missionIndex: missions.index, time: game.time });
  if (game.cash > best) {
    best = game.cash;
    saveBestCash(best);
  }
}

function endRun(kind) {
  if (runEnded) return;
  runEnded = true;
  persist();
  if (kind === 'complete') {
    screen = SCREEN_COMPLETE;
    hud.showOverlay('SOLMARA HEAT — COMPLETE', [
      'All five jobs done. Solmara Bay is yours, Reef.',
      `Final cash: $${game.cash}. Best: $${best}.`,
    ], 'Press Space or click to play again');
    hud.announce(`Complete. Final cash $${game.cash}.`);
  } else if (kind === 'busted') {
    screen = SCREEN_OVER;
    game.cash = Math.max(0, game.cash - 150);
    hud.showOverlay('BUSTED', [
      'Bay PD hauled you in. They kept $150 of your cash.',
      `Cash: $${game.cash}. Best: $${best}.`,
    ], 'Press Space or click to try again');
    hud.announce('Busted. Bay PD took $150.');
  } else {
    screen = SCREEN_OVER;
    hud.showOverlay('WASTED', [
      'Rico Marlowe is down. The crew will remember the heat.',
      `Cash: $${game.cash}. Best: $${best}.`,
    ], 'Press Space or click to try again');
    hud.announce('Wasted.');
  }
  sound.setEngineOn(false);
  sound.siren(false);
}

function resetRun() {
  player.reset(world.landmarks.garage);
  police.reset();
  combat.reset();
  missions.reset();
  traffic.scare(0, 0, 0, 0, 0);
  if (game.inCar) {
    game.vehicle = null;
    game.inCar = false;
    sound.setEngineOn(false);
  }
  renderer.add(player.mesh);
  game.cash = PLAYER.startCash;
  game.time = 0;
  runEnded = false;
  persist();
}

function startGame() {
  resetRun();
  screen = SCREEN_PLAY;
  hud.hideOverlay();
  sound.unlock();
  sound.uiClick();
  hud.announce('Playing. Drive to Mama Sol\u2019s garage.');
  hud.banner('M1 — Back on the Street', 'Drive to Mama Sol\u2019s garage');
}

function runShot(name) {
  const scene = stageShot(name, game, renderer, random);
  let painted = 0;
  function paint() {
    renderer.render(game, 1 / 60);
    hud.update(game);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  if (scene.screen === SCREEN_TITLE) {
    hud.showOverlay(scene.title || 'SOLMARA HEAT', scene.lines || [], scene.prompt || '');
  } else {
    hud.hideOverlay();
  }
  requestAnimationFrame(paint);
}

function runGame() {
  let accumulator = 0;
  let last = performance.now();

  hud.showOverlay('SOLMARA HEAT', [
    'Solmara Bay. You are Rico \u201cReef\u201d Marlowe, wheelman fresh out of a 3-year stretch.',
    'Take jobs for Mama Sol\u2019s crew. Steal cars, lose the cops, survive the heat.',
    'WASD move / drive \u00b7 mouse drag to look \u00b7 E enter or exit a car \u00b7 click to shoot \u00b7 R reload \u00b7 F interact \u00b7 P pause.',
  ], 'Press Space or click to start');
  hud.announce('SOLMARA HEAT. Press Space or click to start.');

  function handleActions(actions) {
    if (actions & ACTION_CONFIRM) {
      if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_COMPLETE) startGame();
    }
    if (actions & ACTION_PAUSE) {
      if (screen === SCREEN_PLAY) {
        screen = SCREEN_PAUSED;
        persist();
        hud.showOverlay('PAUSED', ['The city waits for you.'], 'Press P to resume');
        hud.announce('Paused.');
      } else if (screen === SCREEN_PAUSED) {
        screen = SCREEN_PLAY;
        hud.hideOverlay();
        hud.announce('Playing.');
      }
    }
    if (screen !== SCREEN_PLAY) return;
    if (actions & ACTION_ENTER) {
      if (game.inCar) exitCar();
      else enterCar();
    }
    if (actions & ACTION_INTERACT) missions.interact(game);
    if (actions & ACTION_RELOAD) combat.reload();
  }

  function step(actions) {
    game.time += STEP;
    const look = input.takeLook();
    renderer.camState.yaw -= look.dx * 0.005;
    renderer.camState.pitch = Math.max(0.05, Math.min(1.2, renderer.camState.pitch + look.dy * 0.003));
    const move = input.move();

    if (game.inCar && game.vehicle) {
      game.vehicle.step(STEP, {
        throttle: move.fwd,
        steer: move.strafe,
        brake: false, // S reverses and drags the car to a stop
      }, world);
      sound.engine(Math.min(1, Math.abs(game.vehicle.speed) / game.vehicle.topSpeed));
    } else {
      player.step(STEP, { ...move, jump: Boolean(actions & ACTION_JUMP) }, renderer.camState.yaw);
      if (input.shooting()) combat.shoot(game);
      sound.engine(0);
    }
    traffic.step(STEP, game);
    police.step(STEP, game);
    missions.step(STEP, game);
    combat.step(STEP, game);
    sound.siren(police.stars > 0);
    sound.sirenTick(STEP);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    // One take per frame: handleActions consumes menus, step() gets the same
    // flags (jump is one-shot; the player's onGround gate stops double jumps).
    const actions = input.takeActions();
    handleActions(actions);
    if (screen === SCREEN_PLAY) {
      while (accumulator >= STEP && screen === SCREEN_PLAY) {
        step(actions);
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    if (screen === SCREEN_PLAY || screen === SCREEN_PAUSED) {
      renderer.render(game, 1 / 60);
      hud.update(game);
    } else if (screen === SCREEN_TITLE) {
      // Slow orbit over the city behind the title overlay.
      renderer.camState.yaw += 0.0006;
      renderer.camState.pitch = 0.55;
      renderer.camState.dist = 110;
      renderer.render(game, 1 / 60);
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      persist();
      hud.showOverlay('PAUSED', ['The city waits for you.'], 'Press P to resume');
      hud.announce('Paused.');
    }
  });

  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
