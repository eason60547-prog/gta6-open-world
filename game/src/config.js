// Palmera Bay — tuning constants and palette.
// One job: every magic number the rest of the game shares lives here.
export const WORLD = {
  width: 3600,
  height: 2600,
  roadWidth: 92,
  blockGap: 400,
};

export const ROADS_X = [200, 700, 1200, 1700, 2200, 2700, 3200];
export const ROADS_Y = [200, 600, 1000, 1400, 1800, 2200];

export const PLAYER = {
  walkSpeed: 185,
  runSpeed: 300,
  radius: 13,
  maxHealth: 100,
  punchDamage: 12,
  punchRange: 34,
  punchCooldown: 0.35,
};

export const PISTOL = {
  damage: 34,
  range: 460,
  cooldown: 0.28,
  startAmmo: 24,
  maxAmmo: 60,
};

export const CAR = {
  accel: 420,
  brake: 700,
  reverseAccel: 260,
  maxSpeed: 560,
  maxReverse: 180,
  steer: 2.6,
  grip: 3.2,
  offroadFactor: 0.45,
  handbrake: 900,
};

export const TRAFFIC = {
  count: 26,
  speed: 150,
  spawnInterval: 4,
};

export const PEDS = {
  count: 34,
  walkSpeed: 55,
};

export const POLICE = {
  maxCars: 6,
  carSpeed: 520,
  ramDamage: 8,
  shootRange: 380,
  shootCooldown: 0.9,
  shootDamage: 7,
  footSpeed: 210,
};

export const WANTED = {
  decayDelay: 18,
  decayStep: 8,
  maxStars: 5,
};

export const COLORS = {
  grass: '#7fb069',
  grassDark: '#6da25c',
  park: '#5e9e4f',
  sand: '#ecd9a0',
  water: '#3d9ec4',
  waterDeep: '#2f86ad',
  road: '#3c3f46',
  roadEdge: '#2e3138',
  lane: '#e8d44d',
  sidewalk: '#cbb89a',
  buildingRoof: ['#c96f4a', '#d9a05b', '#7d9bb5', '#b56b8c', '#8a9a5b', '#6b7fa3', '#d97b6c', '#5fa08a'],
  buildingWall: '#8d8578',
  player: '#e8b13c',
  playerShirt: '#2e6fb0',
  police: '#2b4c9b',
  policeLight: '#ff3b30',
  minimapRoad: '#565b66',
  hudBg: 'rgba(12, 16, 24, 0.72)',
};

export const MISSION_REWARDS = [200, 350, 400, 500, 600, 1500];

export const SAVE_KEY = 'palmera-bay-save-v1';
