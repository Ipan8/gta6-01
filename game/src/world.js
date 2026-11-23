// Solmara Bay — the city itself: pure data and math, no drawing, no three.js.
// A seeded procedural grid city: streets, buildings (as AABBs for collision),
// palms, lamps, a beach strip south and a harbour east. Deterministic per seed.
import { BLOCK, GRID, CITY_SIZE } from './config.js';

const HALF = CITY_SIZE / 2;
const STREET_W = 10; // road width between blocks
const SIDEWALK = 3;

// Sun-soaked stucco palette (own art direction, no borrowed assets).
const PALETTE = [
  0xf2e3c6, 0xe8b48a, 0x7fb5a8, 0xe07856, 0xf5d76e,
  0x9fc3d8, 0xd98a7a, 0xc9b458, 0x8fb8a8, 0xe8c39e,
];

function aabb(x, z, w, d) {
  return { minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 };
}

export function createWorld(random) {
  const buildings = []; // {x, z, w, d, h, color, aabb}
  const palms = []; // {x, z, h}
  const lamps = []; // {x, z}
  const roads = []; // {x1, z1, x2, z2} centre-line segments (for traffic + minimap)

  // Block centres: streets run on the grid lines between blocks.
  const blockCentres = [];
  for (let i = 0; i < GRID; i += 1) {
    for (let j = 0; j < GRID; j += 1) {
      const cx = -HALF + BLOCK / 2 + i * BLOCK;
      const cz = -HALF + BLOCK / 2 + j * BLOCK;
      blockCentres.push({ cx, cz, i, j });
    }
  }

  // Beach strip: the southern row of blocks is sand, no buildings.
  // Harbour: the eastern column is docks/water, no buildings.
  const isBeach = (j) => j === GRID - 1;
  const isHarbour = (i) => i === GRID - 1;

  for (const { cx, cz, i, j } of blockCentres) {
    if (isBeach(j) || isHarbour(i)) continue;
    // Downtown core (centre 4x4 blocks) gets taller towers.
    const downtown = Math.abs(i - GRID / 2) <= 2 && Math.abs(j - GRID / 2) <= 2;
    const count = 1 + Math.floor(random() * (downtown ? 2 : 3));
    for (let k = 0; k < count; k += 1) {
      const w = 12 + random() * 16;
      const d = 12 + random() * 16;
      const ox = (random() - 0.5) * (BLOCK - STREET_W - w - 4);
      const oz = (random() - 0.5) * (BLOCK - STREET_W - d - 4);
      const h = downtown
        ? 26 + random() * 38
        : 8 + random() * 18;
      const color = PALETTE[Math.floor(random() * PALETTE.length)];
      const x = cx + ox;
      const z = cz + oz;
      buildings.push({ x, z, w, d, h, color, aabb: aabb(x, z, w, d) });
    }
    // Palms at block corners.
    for (let c = 0; c < 2; c += 1) {
      palms.push({
        x: cx + (random() - 0.5) * (BLOCK - STREET_W - 6),
        z: cz + (random() - 0.5) * (BLOCK - STREET_W - 6),
        h: 6 + random() * 4,
      });
    }
  }

  // Road centre-lines: vertical + horizontal streets between blocks.
  for (let i = 0; i <= GRID; i += 1) {
    const pos = -HALF + i * BLOCK;
    roads.push({ x1: pos, z1: -HALF, x2: pos, z2: HALF }); // vertical
    roads.push({ x1: -HALF, z1: pos, x2: HALF, z2: pos }); // horizontal
  }
  // Lamps along every second street.
  for (let i = 0; i <= GRID; i += 2) {
    const pos = -HALF + i * BLOCK;
    for (let t = -HALF + 24; t < HALF; t += 48) {
      lamps.push({ x: pos + STREET_W / 2 + 1, z: t });
    }
  }

  // Landmarks (fixed, mission-relevant).
  const landmarks = {
    garage: { x: -HALF + BLOCK * 2, z: -HALF + BLOCK * 2, name: 'Mama Sol\u2019s Garage' },
    hideout: { x: HALF - BLOCK * 2.5, z: -HALF + BLOCK * 3, name: 'Hideout' },
    harbourLot: { x: HALF - BLOCK * 1.5, z: 0, name: 'Harbour Lot' },
    marina: { x: HALF - BLOCK * 1.5, z: HALF - BLOCK * 1.5, name: 'Marina' },
    beach: { x: 0, z: HALF - BLOCK / 2, name: 'Solmara Beach' },
  };

  // Parked-car spots: along street edges, clear of buildings.
  function streetPoint() {
    const vertical = random() < 0.5;
    const line = -HALF + Math.floor(random() * (GRID + 1)) * BLOCK;
    const along = -HALF + 20 + random() * (CITY_SIZE - 40);
    return vertical
      ? { x: line + STREET_W / 2 + 2.2, z: along, heading: 0 }
      : { x: along, z: line + STREET_W / 2 + 2.2, heading: Math.PI / 2 };
  }

  /** Push a circle (x, z, radius r) out of buildings and the city bounds. Returns corrected {x, z}. */
  function collideCircle(x, z, r) {
    for (const b of buildings) {
      const a = b.aabb;
      const nx = Math.max(a.minX, Math.min(x, a.maxX));
      const nz = Math.max(a.minZ, Math.min(z, a.maxZ));
      const dx = x - nx;
      const dz = z - nz;
      const d2 = dx * dx + dz * dz;
      if (d2 < r * r) {
        if (d2 > 0.0001) {
          const d = Math.sqrt(d2);
          x = nx + (dx / d) * r;
          z = nz + (dz / d) * r;
        } else {
          // Centre inside the box: push out along the smallest penetration axis.
          const px = Math.min(x - a.minX + r, a.maxX - x + r);
          const pz = Math.min(z - a.minZ + r, a.maxZ - z + r);
          if (px < pz) x = x - a.minX < a.maxX - x ? a.minX - r : a.maxX + r;
          else z = z - a.minZ < a.maxZ - z ? a.minZ - r : a.maxZ + r;
        }
      }
    }
    x = Math.max(-HALF + r, Math.min(HALF - r, x));
    z = Math.max(-HALF + r, Math.min(HALF - r, z));
    return { x, z };
  }

  /** True when the point is inside any building (for spawn validation). */
  function insideBuilding(x, z) {
    for (const b of buildings) {
      const a = b.aabb;
      if (x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ) return true;
    }
    return false;
  }

  /** Height of the tallest building covering (x, z); 0 when the point is clear. */
  function buildingHeightAt(x, z) {
    let h = 0;
    for (const b of buildings) {
      const a = b.aabb;
      if (x >= a.minX && x <= a.maxX && z >= a.minZ && z <= a.maxZ && b.h > h) h = b.h;
    }
    return h;
  }

  return {
    buildings, palms, lamps, roads, landmarks,
    half: HALF, citySize: CITY_SIZE, streetWidth: STREET_W,
    collideCircle, insideBuilding, buildingHeightAt, streetPoint,
  };
}
