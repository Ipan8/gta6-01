// The job chain: 5 missions for Mama Sol's crew, plus two side activities
// (taxi fares, time-trial races). Each mission is a target + a condition;
// the beacon in the sky and the objective line always point at the current one.
// Rewards land in game.cash. Finishing all five beats the game.
import * as THREE from 'three';
import { MISSIONS, TAXI_FARE, RACE_REWARD } from './config.js';
import { createVehicle } from './vehicle.js';

const REACH_DIST = 9;

function makeMarker(color) {
  const m = new THREE.Mesh(
    new THREE.ConeGeometry(1.2, 3, 8),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.85 }),
  );
  m.rotation.x = Math.PI; // point down, floating over the target
  return m;
}

export function createMissions(world, scene, random) {
  const state = {
    index: 0, // current mission (0..4); 5 = all done
    phase: 'idle', // idle | active | done
    sub: '', // per-mission sub-phase
    cash: 0,
    taxi: { active: false, ped: null, dest: null, phase: '' },
    race: { active: false, gate: 0, timeLeft: 0 },
  };
  const landmarks = world.landmarks;
  const marker = makeMarker(0xffd23e);
  marker.visible = false;
  scene.add(marker);
  let missionCar = null; // the Vortex GT for M3
  let raceGates = [];
  let raceGateMeshes = [];

  function target() {
    switch (state.index) {
      case 0: return landmarks.garage;
      case 1: return state.sub === 'reachHideout' ? landmarks.hideout : null;
      case 2: return landmarks.harbourLot;
      case 3: return state.sub === 'escape' ? landmarks.hideout : landmarks.harbourLot;
      case 4: return landmarks.marina;
      default: return null;
    }
  }

  function currentObjective() {
    if (state.index >= MISSIONS.length) return 'All jobs done — Solmara is yours.';
    const m = MISSIONS[state.index];
    if (state.index === 1 && state.sub === 'loseCops') return 'M2 Getaway Driver — lose the cops (heat to 0)';
    if (state.index === 3 && state.sub === 'grabCash') return 'M4 Harbour Heist — press F to grab the cash';
    if (state.index === 3 && state.sub === 'escape') return 'M4 Harbour Heist — escape to the hideout';
    return `${m.id.toUpperCase()} ${m.title} — ${m.objective}`;
  }

  function startMission(game) {
    if (state.index >= MISSIONS.length) return;
    state.phase = 'active';
    const i = state.index;
    if (i === 1) {
      state.sub = 'loseCops';
      game.police.addHeat(32, 'scripted'); // Bay PD is on you from the start
      game.banner('M2 — Getaway Driver', 'Lose the cops, then reach the hideout');
    } else if (i === 2) {
      state.sub = 'steal';
      if (!missionCar) {
        missionCar = createVehicle(world, 'sports', landmarks.harbourLot.x, landmarks.harbourLot.z, 0.6);
        missionCar.isMissionCar = true;
        scene.add(missionCar.mesh);
      }
      game.banner('M3 — Repo Job', 'Steal the Vortex GT from the harbour lot');
    } else if (i === 3) {
      state.sub = 'gotoHarbour';
      game.banner('M4 — Harbour Heist', 'Get to the harbour lot');
    } else if (i === 4) {
      state.sub = 'survive';
      game.police.addHeat(100, 'scripted'); // full 5-star heat
      game.banner('M5 — Heat Wave', 'Survive 5 stars. Reach the marina.');
    } else {
      game.banner('M1 — Back on the Street', 'Drive to Mama Sol\u2019s garage');
    }
  }

  function completeMission(game) {
    const m = MISSIONS[state.index];
    state.cash += m.reward;
    game.cash += m.reward;
    game.banner(`${m.id.toUpperCase()} complete`, `+$${m.reward} — ${m.title}`);
    state.index += 1;
    state.sub = '';
    if (state.index >= MISSIONS.length) {
      state.phase = 'done';
      if (game.onAllMissionsDone) game.onAllMissionsDone();
    } else {
      startMission(game);
    }
  }

  /** F pressed near something interactive (cash grab, race start). */
  function interact(game) {
    if (state.index === 3 && state.sub === 'grabCash') {
      const d = Math.hypot(game.player.x - landmarks.harbourLot.x, game.player.z - landmarks.harbourLot.z);
      if (d < REACH_DIST) {
        state.sub = 'escape';
        game.banner('Cash grabbed!', 'Rival crew incoming — escape to the hideout');
        if (game.combat) {
          for (let k = 0; k < 3; k += 1) {
            game.combat.spawnEnemy(landmarks.harbourLot.x + (random() - 0.5) * 20, landmarks.harbourLot.z + (random() - 0.5) * 20);
          }
        }
        if (game.traffic) game.traffic.scare(landmarks.harbourLot.x, landmarks.harbourLot.z, 40, 6, game.time);
        game.police.addHeat(25, 'heist');
        return true;
      }
    }
    // Race start: standing by the garage in a car.
    if (!state.race.active) {
      const d = Math.hypot(game.player.x - landmarks.garage.x, game.player.z - landmarks.garage.z);
      if (d < 12 && game.inCar) {
        startRace(game);
        return true;
      }
    }
    return false;
  }

  function startRace(game) {
    // 4 gates along the main north-south road, then back toward the beach.
    const xs = [-72, -24, 24, 72];
    raceGates = xs.map((x) => ({ x, z: -120 + Math.abs(x) * 1.2 }));
    for (const g of raceGates) {
      const mesh = makeMarker(0x35e0a0);
      mesh.position.set(g.x, 6, g.z);
      scene.add(mesh);
      raceGateMeshes.push(mesh);
    }
    state.race = { active: true, gate: 0, timeLeft: 90 };
    game.banner('Time Trial', '4 gates — 90 seconds. Go!');
  }

  function endRace(game, won) {
    for (const m of raceGateMeshes) scene.remove(m);
    raceGateMeshes = [];
    state.race = { active: false, gate: 0, timeLeft: 0 };
    if (won) {
      game.cash += RACE_REWARD;
      game.banner('Time Trial complete', `+$${RACE_REWARD}`);
    } else {
      game.banner('Time Trial failed', 'Out of time — try again at the garage');
    }
  }

  function step(dt, game) {
    if (state.phase === 'idle') startMission(game);
    const px = game.inCar ? game.vehicle.x : game.player.x;
    const pz = game.inCar ? game.vehicle.z : game.player.z;

    // Mission beacon + marker follow the current target.
    const tgt = target();
    if (tgt) {
      marker.visible = true;
      marker.position.set(tgt.x, 6 + Math.sin(game.time * 2) * 0.5, tgt.z);
      if (game.beacon) {
        game.beacon.visible = true;
        game.beacon.position.set(tgt.x, 45, tgt.z);
      }
    } else {
      marker.visible = false;
      if (game.beacon) game.beacon.visible = false;
    }

    // Mission conditions.
    if (state.phase === 'active') {
      const i = state.index;
      if (i === 0 && Math.hypot(px - landmarks.garage.x, pz - landmarks.garage.z) < REACH_DIST) {
        completeMission(game);
      } else if (i === 1) {
        if (state.sub === 'loseCops' && game.police.stars === 0) {
          state.sub = 'reachHideout';
          game.banner('Cops lost', 'Now reach the hideout');
        } else if (state.sub === 'reachHideout' && Math.hypot(px - landmarks.hideout.x, pz - landmarks.hideout.z) < REACH_DIST) {
          completeMission(game);
        }
      } else if (i === 2 && game.inCar && game.vehicle && game.vehicle.isMissionCar) {
        completeMission(game);
      } else if (i === 3) {
        if (state.sub === 'gotoHarbour' && Math.hypot(px - landmarks.harbourLot.x, pz - landmarks.harbourLot.z) < REACH_DIST) {
          state.sub = 'grabCash';
          game.banner('At the harbour lot', 'Press F to grab the cash');
        } else if (state.sub === 'escape' && Math.hypot(px - landmarks.hideout.x, pz - landmarks.hideout.z) < REACH_DIST) {
          completeMission(game);
        }
      } else if (i === 4 && Math.hypot(px - landmarks.marina.x, pz - landmarks.marina.z) < 10) {
        completeMission(game);
      }
    }

    // Taxi fare: in a car, a nearby ped becomes a fare; deliver them, get paid.
    if (game.inCar && !state.taxi.active && game.traffic) {
      let best = null;
      let bestD = 30;
      for (const ped of game.traffic.peds) {
        const d = Math.hypot(ped.x - px, ped.z - pz);
        if (d < bestD) { bestD = d; best = ped; }
      }
      if (best) {
        const dests = [landmarks.beach, landmarks.marina, landmarks.garage, landmarks.hideout];
        state.taxi = { active: true, ped: best, dest: dests[Math.floor(random() * dests.length)], phase: 'pickup' };
      }
    }
    if (state.taxi.active) {
      const fare = state.taxi;
      if (fare.phase === 'pickup' && Math.hypot(px - fare.ped.x, pz - fare.ped.z) < 6) {
        fare.phase = 'dropoff';
        game.banner('Fare picked up', `Take them to ${fare.dest.name}`);
      } else if (fare.phase === 'dropoff' && Math.hypot(px - fare.dest.x, pz - fare.dest.z) < REACH_DIST) {
        game.cash += TAXI_FARE;
        game.banner('Fare delivered', `+$${TAXI_FARE}`);
        state.taxi = { active: false, ped: null, dest: null, phase: '' };
      }
    }

    // Time trial gates.
    if (state.race.active) {
      state.race.timeLeft -= dt;
      const g = raceGates[state.race.gate];
      if (g && Math.hypot(px - g.x, pz - g.z) < 8) {
        scene.remove(raceGateMeshes[state.race.gate]);
        state.race.gate += 1;
        if (state.race.gate >= raceGates.length) endRace(game, true);
      }
      if (state.race.timeLeft <= 0) endRace(game, false);
    }
  }

  function reset() {
    state.index = 0;
    state.phase = 'idle';
    state.sub = '';
    state.taxi = { active: false, ped: null, dest: null, phase: '' };
    endRace({ cash: 0, banner: () => {} }, false);
    if (missionCar) {
      scene.remove(missionCar.mesh);
      missionCar = null;
    }
  }

  return Object.assign(state, { step, interact, currentObjective, startMission, reset, get missionCar() { return missionCar; } });
}
