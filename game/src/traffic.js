// Palmera Bay — traffic and parked cars.
// One job: cars that drive the roads, cars parked at the kerb, and stealing.
import { ROADS_X, ROADS_Y, WORLD, TRAFFIC, CAR } from './config.js';
import { nearestRoadPoint, isRoad } from './world.js';
import { makeRng, pick, range } from './rng.js';

const CAR_COLORS = ['#d94f3d', '#3d7bd9', '#e8c33c', '#e8e8e8', '#2b2b2b', '#5fa08a', '#c96fb0', '#8a6fd9'];
const CAR_NAMES = ['Comet', 'Sandstorm', 'Vagabond', 'Cortez', 'Sunrunner', 'Marlin', 'Dune Buggy', 'Pelican'];

export function makeCar(x, y, angle, opts = {}) {
  return {
    x, y, angle,
    speed: opts.speed ?? 0,
    color: opts.color ?? pick(makeRng((Math.random() * 1e9) | 0), CAR_COLORS),
    name: opts.name ?? pick(makeRng((Math.random() * 1e9) | 0), CAR_NAMES),
    driver: opts.driver ?? 'traffic', // traffic | parked | player | police
    wrecked: false,
    vertical: opts.vertical ?? true,
    dir: opts.dir ?? 1,
    targetSpeed: opts.targetSpeed ?? TRAFFIC.speed,
    honkTimer: 0,
    brakeLight: false,
    siren: false,
  };
}

export class Traffic {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.spawnTimer = 0;
  }

  spawnInitial(count) {
    for (let i = 0; i < count; i++) this.spawnCar(true);
    // Parked cars at the kerb (stealable).
    for (const spot of this.city.parkedSpots.slice(0, 14)) {
      const c = makeCar(spot.x, spot.y, spot.angle, { driver: 'parked', speed: 0 });
      this.cars.push(c);
    }
  }

  spawnCar(anywhere = false) {
    const rng = this.rng;
    const vertical = rng() < 0.5;
    let x;
    let y;
    let angle;
    let dir = rng() < 0.5 ? 1 : -1;
    if (vertical) {
      const rx = pick(rng, ROADS_X);
      x = rx + (dir > 0 ? 22 : -22);
      y = anywhere ? range(rng, 100, WORLD.height - 100) : (dir > 0 ? 40 : WORLD.height - 40);
      angle = dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      const ry = pick(rng, ROADS_Y);
      y = ry + (dir > 0 ? 22 : -22);
      x = anywhere ? range(rng, 100, WORLD.width - 100) : (dir > 0 ? 40 : WORLD.width - 40);
      angle = dir > 0 ? 0 : Math.PI;
    }
    const c = makeCar(x, y, angle, { driver: 'traffic', speed: TRAFFIC.speed, vertical, dir });
    this.cars.push(c);
    return c;
  }

  update(dt, game) {
    this.spawnTimer -= dt;
    const trafficCount = this.cars.filter((c) => c.driver === 'traffic').length;
    if (this.spawnTimer <= 0 && trafficCount < TRAFFIC.count) {
      this.spawnCar();
      this.spawnTimer = TRAFFIC.spawnInterval;
    }

    for (const c of this.cars) {
      if (c.driver !== 'traffic') continue;
      // Follow the road; at an intersection, sometimes turn.
      const snap = nearestRoadPoint(c.x, c.y);
      const onRoad = isRoad(c.x, c.y);
      if (!onRoad) {
        // Steer back toward the nearest road centreline.
        const targetAngle = Math.atan2(snap.y - c.y, snap.x - c.x);
        c.angle = this._turnToward(c.angle, targetAngle, 2.4 * dt);
        c.speed = Math.min(c.speed, 120);
      } else {
        // Lane keeping: drift toward the lane offset.
        const lane = c.vertical
          ? { x: (c.dir > 0 ? 22 : -22), y: 0 }
          : { x: 0, y: (c.dir > 0 ? 22 : -22) };
        const roadLine = c.vertical ? snap.x + lane.x : snap.y + lane.y;
        const off = c.vertical ? c.x - roadLine : c.y - roadLine;
        const desired = c.vertical
          ? (c.dir > 0 ? Math.PI / 2 : -Math.PI / 2)
          : (c.dir > 0 ? 0 : Math.PI);
        c.angle = this._turnToward(c.angle, desired - off * 0.004, 1.6 * dt);
        // Slow down for a car ahead.
        const ahead = this._carAhead(c, game);
        c.targetSpeed = ahead ? Math.max(0, ahead.speed - 20) : TRAFFIC.speed;
        c.speed += Math.sign(c.targetSpeed - c.speed) * 140 * dt;
      }
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;

      // Leave the map: despawn and let a fresh one spawn.
      if (c.x < -60 || c.x > WORLD.width + 60 || c.y < -60 || c.y > WORLD.height + 60) {
        c.dead = true;
      }
      // At a junction, occasionally turn onto the crossing road.
      if (this.rng() < dt * 0.12 && this._atJunction(c)) {
        const turn = this.rng() < 0.5 ? 1 : -1;
        c.angle += turn * Math.PI / 2;
        c.vertical = !c.vertical;
        c.dir = c.vertical ? (Math.abs(c.angle - Math.PI / 2) < 0.1 ? 1 : -1) : (Math.abs(c.angle) < 0.1 ? 1 : -1);
      }
    }
    this.cars = this.cars.filter((c) => !c.dead);
  }

  _atJunction(c) {
    const nearX = ROADS_X.some((rx) => Math.abs(c.x - rx) < 46);
    const nearY = ROADS_Y.some((ry) => Math.abs(c.y - ry) < 46);
    return nearX && nearY;
  }

  _carAhead(self, game) {
    let best = null;
    let bestD = 130;
    for (const c of game.cars) {
      if (c === self || c.wrecked) continue;
      const dx = c.x - self.x;
      const dy = c.y - self.y;
      const d = Math.hypot(dx, dy);
      if (d > bestD) continue;
      const dot = (dx * Math.cos(self.angle) + dy * Math.sin(self.angle)) / (d || 1);
      if (dot > 0.86 && d < bestD) { best = c; bestD = d; }
    }
    return best;
  }

  _turnToward(angle, target, maxStep) {
    let diff = target - angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    return angle + Math.max(-maxStep, Math.min(maxStep, diff));
  }

  nearestStealable(x, y, maxDist) {
    let best = null;
    let bestD = maxDist;
    for (const c of this.cars) {
      if (c.driver !== 'parked' && c.driver !== 'traffic') continue;
      const d = Math.hypot(c.x - x, c.y - y);
      if (d < bestD) { best = c; bestD = d; }
    }
    return best;
  }
}
