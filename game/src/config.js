// SOLMARA HEAT — game configuration (own IP, no Rockstar content).
// A sun-soaked coastal city. You are Rico "Reef" Marlowe, a wheelman fresh
// out of a 3-year stretch, taking jobs for Mama Sol's crew while Bay PD
// breathes down your neck. City: Solmara Bay.

export const GAME_TITLE = 'SOLMARA HEAT';
export const CITY_NAME = 'Solmara Bay';

// City grid: blocks of this size in world units; streets run between them.
export const BLOCK = 48; // world units per city block (incl. street)
export const GRID = 12; // blocks per side -> city spans GRID*BLOCK units
export const CITY_SIZE = BLOCK * GRID; // 576

// Movement (units/second).
export const WALK_SPEED = 7;
export const SPRINT_SPEED = 11;
export const JUMP_SPEED = 9;
export const GRAVITY = 24;

// Cars: 4 classes, arcade handling.
export const CAR_CLASSES = {
  sedan: { accel: 14, topSpeed: 34, turn: 1.9, color: 0x4a7fb5, name: 'Marlin Sedan' },
  taxi: { accel: 12, topSpeed: 30, turn: 1.8, color: 0xf2c200, name: 'Bay Cab' },
  pickup: { accel: 11, topSpeed: 28, turn: 1.6, color: 0x7a4a2b, name: 'Dune Pickup' },
  sports: { accel: 20, topSpeed: 48, turn: 2.4, color: 0xc22e2e, name: 'Vortex GT' },
};
export const CAR_ENTER_DIST = 4.5;

// Wanted: heat 0..100 maps to stars 0..5; crimes add heat, time bleeds it.
export const WANTED = {
  starAt: [0, 12, 30, 55, 80, 100], // heat thresholds per star (index = stars)
  crimeHeat: { stealCar: 14, alarm: 6, crashPed: 10, shoot: 18, killCop: 30, speed: 0 },
  decayPerSec: 0.9, // heat lost per second while unseen
  decaySeenPerSec: 0.25,
  roadblockAtStars: 3,
  heliAtStars: 5,
};
export const POLICE_MAX = 6; // cruisers alive at once

// Combat.
export const PISTOL = { damage: 34, magSize: 12, reserveMax: 120, range: 60, fireInterval: 0.22 };

// Player.
export const PLAYER = { health: 100, startCash: 250 };

// Missions: 5-chain. Each: id, title, briefing lines, objective, reward.
export const MISSIONS = [
  { id: 'm1', title: 'Back on the Street', reward: 300, objective: 'Drive to Mama Sol\u2019s garage' },
  { id: 'm2', title: 'Getaway Driver', reward: 600, objective: 'Lose the cops, then reach the hideout' },
  { id: 'm3', title: 'Repo Job', reward: 900, objective: 'Steal the Vortex GT from the harbour lot' },
  { id: 'm4', title: 'Harbour Heist', reward: 1500, objective: 'Grab the cash, fight the rival crew, escape' },
  { id: 'm5', title: 'Heat Wave', reward: 2500, objective: 'Survive 5 stars and reach the marina' },
];

// Side activities.
export const TAXI_FARE = 120; // per completed fare
export const RACE_REWARD = 400;

// Traffic + pedestrians.
export const TRAFFIC_CARS = 26;
export const PEDESTRIANS = 40;

// Save.
export const SAVE_KEY = 'solmara-heat-save-v1';
export const BEST_KEY = 'solmara-heat-best-v1';

// Fixed-step loop.
export const STEP = 1 / 60;
export const DAY_LENGTH_SEC = 240; // full sun cycle (visual only)
