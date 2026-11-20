// Palmera Bay — the city itself: layout, buildings, collision.
// One job: build a fixed city from a seed and answer "what is here?"
// (is this point road? does this circle hit a building?).
import { WORLD, ROADS_X, ROADS_Y, COLORS } from './config.js';
import { makeRng, pick, range, rangeInt } from './rng.js';

export function isRoad(x, y) {
  const half = WORLD.roadWidth / 2;
  for (const rx of ROADS_X) if (Math.abs(x - rx) < half) return true;
  for (const ry of ROADS_Y) if (Math.abs(y - ry) < half) return true;
  return false;
}

export function isBeach(x, y) {
  return y > WORLD.height - 260;
}

export function isWater(x, y) {
  return y > WORLD.height - 90;
}

export function isPort(x, y) {
  return x > WORLD.width - 260 && y > 1400 && y < 2200;
}

// Nearest point on a road centreline (used to snap traffic/peds onto roads).
export function nearestRoadPoint(x, y) {
  let best = null;
  let bestD = Infinity;
  for (const rx of ROADS_X) {
    const d = Math.abs(x - rx);
    if (d < bestD) { bestD = d; best = { x: rx, y, vertical: true }; }
  }
  for (const ry of ROADS_Y) {
    const d = Math.abs(y - ry);
    if (d < bestD) { bestD = d; best = { x, y: ry, vertical: false }; }
  }
  return best;
}

export function buildCity(seed) {
  const rng = makeRng(seed);
  const buildings = [];
  const trees = [];
  const parkedSpots = [];

  // Blocks between neighbouring roads.
  for (let i = 0; i < ROADS_X.length - 1; i++) {
    for (let j = 0; j < ROADS_Y.length - 1; j++) {
      const x0 = ROADS_X[i] + WORLD.roadWidth / 2 + 14;
      const x1 = ROADS_X[i + 1] - WORLD.roadWidth / 2 - 14;
      const y0 = ROADS_Y[j] + WORLD.roadWidth / 2 + 14;
      const y1 = ROADS_Y[j + 1] - WORLD.roadWidth / 2 - 14;
      if (x1 - x0 < 120 || y1 - y0 < 100) continue;
      // The block at (2200..2700, 1000..1400) is the central park.
      const isPark = i === 4 && j === 2;
      // The block at (1200..1700, 1800..2200) is the market square.
      const isMarket = i === 2 && j === 4;
      if (isPark) {
        for (let t = 0; t < 26; t++) {
          trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 9, 15) });
        }
        continue;
      }
      if (isMarket) {
        for (let t = 0; t < 8; t++) {
          trees.push({ x: range(rng, x0 + 20, x1 - 20), y: range(rng, y0 + 20, y1 - 20), r: range(rng, 8, 12) });
        }
        buildings.push({
          x: x0 + 30, y: y0 + 30, w: x1 - x0 - 60, h: 60,
          roof: '#b56b8c', label: 'MARKET', kind: 'market',
        });
        continue;
      }
      // 1-3 buildings per block.
      const n = rangeInt(rng, 1, 3);
      for (let b = 0; b < n; b++) {
        const w = range(rng, 90, Math.min(220, (x1 - x0) / n - 16));
        const h = range(rng, 70, Math.min(170, y1 - y0 - 24));
        const bx = range(rng, x0, Math.max(x0 + 1, x1 - w));
        const by = range(rng, y0, Math.max(y0 + 1, y1 - h));
        buildings.push({
          x: bx, y: by, w, h,
          roof: pick(rng, COLORS.buildingRoof),
          label: '',
          kind: 'house',
        });
      }
      // A few palm trees on block corners.
      for (let t = 0; t < rangeInt(rng, 1, 3); t++) {
        trees.push({ x: range(rng, x0, x1), y: range(rng, y0, y1), r: range(rng, 7, 11) });
      }
    }
  }

  // Landmark buildings (named, used by missions).
  const landmarks = [
    { id: 'garage', name: "EDDIE'S GARAGE", x: 1150, y: 150, w: 150, h: 70, roof: '#d9a05b', kind: 'garage' },
    { id: 'bank', name: 'PALMERA BANK', x: 2150, y: 550, w: 170, h: 90, roof: '#7d9bb5', kind: 'bank' },
    { id: 'diner', name: 'SUNSET DINER', x: 650, y: 950, w: 130, h: 70, roof: '#c96f4a', kind: 'diner' },
    { id: 'hideout', name: 'HIDEOUT', x: 3150, y: 2150, w: 140, h: 80, roof: '#5fa08a', kind: 'hideout' },
    { id: 'motel', name: 'PALM MOTEL', x: 1650, y: 1350, w: 150, h: 80, roof: '#b56b8c', kind: 'motel' },
    { id: 'pier', name: 'PIER 9', x: 2650, y: 2320, w: 180, h: 60, roof: '#8a9a5b', kind: 'pier' },
  ];
  for (const lm of landmarks) buildings.push({ ...lm, label: lm.name });

  // Parked cars along road edges (spawn points for stealable cars).
  for (const rx of ROADS_X) {
    for (const ry of ROADS_Y) {
      if (rng() < 0.55) {
        parkedSpots.push({ x: rx + WORLD.roadWidth / 2 + 26, y: ry + range(rng, -160, 160), angle: Math.PI / 2 });
      }
      if (rng() < 0.4) {
        parkedSpots.push({ x: rx - WORLD.roadWidth / 2 - 26, y: ry + range(rng, -160, 160), angle: -Math.PI / 2 });
      }
    }
  }

  // Beach palms.
  for (let t = 0; t < 22; t++) {
    trees.push({ x: range(rng, 60, WORLD.width - 60), y: range(rng, WORLD.height - 250, WORLD.height - 110), r: range(rng, 8, 13) });
  }

  return { buildings, trees, parkedSpots, landmarks, seed };
}

// Circle vs building AABB: push the circle out, return corrected position.
export function collideBuildings(city, x, y, radius) {
  let cx = x;
  let cy = y;
  for (const b of city.buildings) {
    const nx = Math.max(b.x, Math.min(cx, b.x + b.w));
    const ny = Math.max(b.y, Math.min(cy, b.y + b.h));
    const dx = cx - nx;
    const dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      if (d2 > 0.001) {
        const d = Math.sqrt(d2);
        cx = nx + (dx / d) * radius;
        cy = ny + (dy / d) * radius;
      } else {
        cy = b.y - radius;
      }
    }
  }
  return { x: cx, y: cy };
}

export function pointInBuilding(city, x, y) {
  for (const b of city.buildings) {
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Is this point walkable/drivable ground (not water, not inside a building)?
export function isGround(city, x, y) {
  if (x < 20 || y < 20 || x > WORLD.width - 20 || y > WORLD.height - 20) return false;
  if (isWater(x, y)) return false;
  return !pointInBuilding(city, x, y);
}
