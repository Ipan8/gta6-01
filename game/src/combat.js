// Combat: Rico's pistol and the rival crew. Shooting is a manual ray test
// (no three.js Raycaster needed): the nearest enemy, ped or car whose sphere
// the shot line passes through takes the hit. Enemies chase and shoot back
// with poor aim. Firing scares peds and raises heat; killing a rival pays $25.
import * as THREE from 'three';
import { PISTOL, WANTED } from './config.js';

function makeEnemyMesh() {
  const g = new THREE.Group();
  const shirt = new THREE.MeshLambertMaterial({ color: 0xb03030 });
  const skin = new THREE.MeshLambertMaterial({ color: 0x8a6a4a });
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, 0.95, 8), shirt);
  body.position.y = 1.05;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.24, 10, 8), skin);
  head.position.y = 1.78;
  const gun = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.12, 0.5), new THREE.MeshLambertMaterial({ color: 0x111111 }));
  gun.position.set(0.3, 1.15, 0.4);
  g.add(body, head, gun);
  return g;
}

/** Distance from ray (o, d) to point c, and the along-ray parameter t. */
function raySphere(o, d, c, radius) {
  const ox = c.x - o.x;
  const oy = c.y - o.y;
  const oz = c.z - o.z;
  const t = ox * d.x + oy * d.y + oz * d.z;
  if (t < 0) return null;
  const px = o.x + d.x * t;
  const py = o.y + d.y * t;
  const pz = o.z + d.z * t;
  const dist = Math.hypot(c.x - px, c.y - py, c.z - pz);
  return dist < radius ? { t, dist } : null;
}

export function createCombat(world, scene, renderer) {
  const state = { mag: PISTOL.magSize, reserve: PISTOL.reserveMax, cooldown: 0, flashUntil: 0 };
  const enemies = [];
  // Tracer: a line from the muzzle to the hit point, shown briefly.
  const tracerMat = new THREE.LineBasicMaterial({ color: 0xffe9a8, transparent: true, opacity: 0 });
  const tracerGeo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]);
  const tracer = new THREE.Line(tracerGeo, tracerMat);
  tracer.visible = false;
  scene.add(tracer);

  function spawnEnemy(x, z) {
    const mesh = makeEnemyMesh();
    mesh.position.set(x, 0, z);
    scene.add(mesh);
    const enemy = { x, z, health: 100, mesh, shootTimer: 1 + Math.random() * 2, alive: true };
    enemies.push(enemy);
    return enemy;
  }

  function shoot(game) {
    if (state.cooldown > 0 || state.mag <= 0 || game.inCar) return false;
    state.cooldown = PISTOL.fireInterval;
    state.mag -= 1;
    const cam = renderer.camera;
    const o = { x: cam.position.x, y: cam.position.y, z: cam.position.z };
    const dir = new THREE.Vector3();
    cam.getWorldDirection(dir);
    const d = { x: dir.x, y: dir.y, z: dir.z };
    // Find the nearest hit among enemies, peds and traffic cars.
    let best = null;
    let bestKind = null;
    let bestRef = null;
    for (const e of enemies) {
      if (!e.alive) continue;
      const hit = raySphere(o, d, { x: e.x, y: 1.2, z: e.z }, 0.9);
      if (hit && hit.t < PISTOL.range && (!best || hit.t < best.t)) { best = hit; bestKind = 'enemy'; bestRef = e; }
    }
    if (game.traffic) {
      for (const ped of game.traffic.peds) {
        const hit = raySphere(o, d, { x: ped.x, y: 1.1, z: ped.z }, 0.7);
        if (hit && hit.t < PISTOL.range && (!best || hit.t < best.t)) { best = hit; bestKind = 'ped'; bestRef = ped; }
      }
      for (const car of game.traffic.cars) {
        const hit = raySphere(o, d, { x: car.x, y: 1, z: car.z }, 2.2);
        if (hit && hit.t < PISTOL.range && (!best || hit.t < best.t)) { best = hit; bestKind = 'car'; bestRef = car; }
      }
    }
    const endT = best ? best.t : PISTOL.range;
    const end = new THREE.Vector3(o.x + d.x * endT, o.y + d.y * endT, o.z + d.z * endT);
    const pts = tracer.geometry.attributes.position;
    pts.setXYZ(0, o.x, o.y, o.z);
    pts.setXYZ(1, end.x, end.y, end.z);
    pts.needsUpdate = true;
    tracer.visible = true;
    tracerMat.opacity = 0.9;
    state.flashUntil = game.time + 0.06;

    if (bestKind === 'enemy') {
      bestRef.health -= PISTOL.damage;
      if (bestRef.health <= 0) {
        bestRef.alive = false;
        bestRef.mesh.rotation.x = Math.PI / 2; // fall over
        bestRef.mesh.position.y = 0.3;
        game.cash += 25;
        if (game.banner) game.banner('Rival down', '+$25');
        game.police.addHeat(6, 'kill');
      }
    } else if (bestKind === 'ped') {
      game.police.addHeat(WANTED.crimeHeat.crashPed, 'shot-civilian');
      if (game.traffic) game.traffic.scare(bestRef.x, bestRef.z, 30, 5, game.time);
    } else if (bestKind === 'car') {
      game.police.addHeat(4, 'shot-car');
    }
    game.police.addHeat(4, 'shot');
    if (game.traffic) game.traffic.scare(game.player.x, game.player.z, 35, 4, game.time);
    if (game.sound) game.sound.gunshot();
    return true;
  }

  function reload() {
    if (state.mag === PISTOL.magSize || state.reserve <= 0) return false;
    const need = PISTOL.magSize - state.mag;
    const take = Math.min(need, state.reserve);
    state.mag += take;
    state.reserve -= take;
    return true;
  }

  function step(dt, game) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    if (game.time > state.flashUntil) {
      tracer.visible = false;
      tracerMat.opacity = 0;
    }
    for (const e of enemies) {
      if (!e.alive) continue;
      const dx = game.player.x - e.x;
      const dz = game.player.z - e.z;
      const d = Math.hypot(dx, dz) || 0.01;
      // Chase to 18 units, then hold and shoot.
      if (d > 18) {
        e.x += (dx / d) * 5 * dt;
        e.z += (dz / d) * 5 * dt;
        const fixed = world.collideCircle(e.x, e.z, 0.5);
        e.x = fixed.x;
        e.z = fixed.z;
      }
      e.mesh.position.set(e.x, 0, e.z);
      e.mesh.rotation.y = Math.atan2(dx, dz);
      e.shootTimer -= dt;
      if (e.shootTimer <= 0 && d < 30) {
        e.shootTimer = 1.2 + Math.random() * 0.8;
        // Poor aim: 1 in 4 shots lands.
        if (Math.random() < 0.25) {
          game.player.damage(6);
          if (game.player.health <= 0 && game.onWasted) game.onWasted();
        }
        if (game.sound) game.sound.enemyShot();
      }
    }
  }

  function reset() {
    state.mag = PISTOL.magSize;
    state.reserve = PISTOL.reserveMax;
    state.cooldown = 0;
    for (const e of enemies) scene.remove(e.mesh);
    enemies.length = 0;
  }

  return Object.assign(state, { enemies, shoot, reload, spawnEnemy, step, reset });
}
