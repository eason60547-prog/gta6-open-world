// Palmera Bay — pedestrians on the sidewalks.
// One job: people who walk the city, stroll, and run when scared.
import { WORLD, PEDS } from './config.js';
import { nearestRoadPoint, isGround } from './world.js';
import { makeRng, pick, range } from './rng.js';

const SHIRTS = ['#d94f3d', '#3d7bd9', '#e8c33c', '#5fa08a', '#c96fb0', '#8a6fd9', '#e8e8e8', '#2b8a4b'];

export function makePed(x, y, rng) {
  return {
    x, y,
    angle: range(rng, 0, Math.PI * 2),
    speed: 0,
    shirt: pick(rng, SHIRTS),
    target: null,
    scared: 0,
    walkPhase: rng() * Math.PI * 2,
    dead: false,
  };
}

export class Pedestrians {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.peds = [];
  }

  spawnInitial(count) {
    for (let i = 0; i < count; i++) {
      const x = range(this.rng, 150, WORLD.width - 150);
      const y = range(this.rng, 150, WORLD.height - 350);
      const p = makePed(x, y, this.rng);
      p.target = this._newTarget(p);
      this.peds.push(p);
    }
  }

  _newTarget(p) {
    // Walk along sidewalks: pick a nearby road, then a point along it.
    const snap = nearestRoadPoint(p.x, p.y);
    const off = 62;
    if (snap.vertical) {
      return { x: snap.x + (this.rng() < 0.5 ? off : -off), y: range(this.rng, 120, WORLD.height - 300) };
    }
    return { x: range(this.rng, 120, WORLD.width - 120), y: snap.y + (this.rng() < 0.5 ? off : -off) };
  }

  scare(x, y, radius) {
    for (const p of this.peds) {
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < radius) {
        p.scared = 3;
        p.target = { x: p.x + (p.x - x) * 2, y: p.y + (p.y - y) * 2 };
      }
    }
  }

  update(dt, game) {
    for (const p of this.peds) {
      p.scared = Math.max(0, p.scared - dt);
      p.walkPhase += dt * (p.scared > 0 ? 14 : 7);
      if (!p.target || Math.hypot(p.target.x - p.x, p.target.y - p.y) < 24) {
        p.target = this._newTarget(p);
      }
      const speed = p.scared > 0 ? PEDS.walkSpeed * 2.6 : PEDS.walkSpeed;
      const dx = p.target.x - p.x;
      const dy = p.target.y - p.y;
      const d = Math.hypot(dx, dy) || 1;
      p.angle = Math.atan2(dy, dx);
      p.speed = speed;
      let nx = p.x + (dx / d) * speed * dt;
      let ny = p.y + (dy / d) * speed * dt;
      if (!isGround(this.city, nx, ny)) {
        // Step around the obstacle: try a sideways move.
        nx = p.x + (dy / d) * speed * dt;
        ny = p.y - (dx / d) * speed * dt;
        if (!isGround(this.city, nx, ny)) {
          p.target = this._newTarget(p);
          continue;
        }
      }
      p.x = nx;
      p.y = ny;
      // Keep peds off the beach water.
      if (p.y > WORLD.height - 100) p.target = this._newTarget(p);
    }
  }
}
