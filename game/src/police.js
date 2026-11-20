// Palmera Bay — the wanted level and the police who respond to it.
// One job: stars go up when the player commits crimes, cops chase and
// try to stop them; stars cool down when the player lies low.
import { WORLD, POLICE, WANTED } from './config.js';
import { makeCar } from './traffic.js';
import { makeRng, range } from './rng.js';

export class Police {
  constructor(city, rng) {
    this.city = city;
    this.rng = rng;
    this.cars = [];
    this.cops = []; // on-foot officers
    this.wanted = 0;
    this.quietTimer = 0; // seconds since the last crime
    this.decayTimer = 0;
    this.spawnTimer = 0;
    this.shootTimer = 0;
  }

  addWanted(stars) {
    const before = this.wanted;
    this.wanted = Math.min(WANTED.maxStars, this.wanted + stars);
    this.quietTimer = 0;
    this.decayTimer = 0;
    return this.wanted > before;
  }

  clearWanted() {
    this.wanted = 0;
    this.cars = [];
    this.cops = [];
  }

  _desiredCars() {
    if (this.wanted === 0) return 0;
    return Math.min(POLICE.maxCars, 1 + this.wanted);
  }

  _desiredCops() {
    if (this.wanted < 2) return 0;
    return Math.min(4, this.wanted);
  }

  _spawnCarNear(x, y) {
    const angle = this.rng() * Math.PI * 2;
    const dist = 700;
    const sx = Math.max(80, Math.min(WORLD.width - 80, x + Math.cos(angle) * dist));
    const sy = Math.max(80, Math.min(WORLD.height - 80, y + Math.sin(angle) * dist));
    const c = makeCar(sx, sy, 0, { driver: 'police', speed: 0 });
    c.color = '#2b4c9b';
    c.siren = true;
    c.name = 'Interceptor';
    this.cars.push(c);
    return c;
  }

  _spawnCopNear(x, y) {
    const angle = this.rng() * Math.PI * 2;
    const cop = {
      x: x + Math.cos(angle) * 260,
      y: y + Math.sin(angle) * 260,
      angle: 0,
      speed: 0,
      shirt: '#2b4c9b',
      shootTimer: range(this.rng, 0.3, 1.2),
      walkPhase: 0,
    };
    this.cops.push(cop);
    return cop;
  }

  update(dt, game) {
    const player = game.player;
    this.quietTimer += dt;

    // Cool down: no crime for a while and no cop nearby -> lose a star.
    if (this.wanted > 0) {
      const nearestCop = this._nearestCopDist(player.x, player.y);
      if (this.quietTimer > WANTED.decayDelay && nearestCop > 520) {
        this.decayTimer += dt;
        if (this.decayTimer > WANTED.decayStep) {
          this.decayTimer = 0;
          this.wanted -= 1;
          if (this.wanted === 0) this.clearWanted();
        }
      }
    }

    // Spawn / despawn to match the wanted level.
    this.spawnTimer -= dt;
    if (this.spawnTimer <= 0) {
      this.spawnTimer = 1.2;
      while (this.cars.length < this._desiredCars()) this._spawnCarNear(player.x, player.y);
      while (this.cops.length < this._desiredCops()) this._spawnCopNear(player.x, player.y);
      if (this.cars.length > this._desiredCars()) this.cars.length = this._desiredCars();
      if (this.cops.length > this._desiredCops()) this.cops.length = this._desiredCops();
    }

    // Police cars chase and ram.
    for (const c of this.cars) {
      const dx = player.x - c.x;
      const dy = player.y - c.y;
      const d = Math.hypot(dx, dy) || 1;
      const targetAngle = Math.atan2(dy, dx);
      let diff = targetAngle - c.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      c.angle += Math.max(-2.8 * dt, Math.min(2.8 * dt, diff));
      const want = d > 60 ? POLICE.carSpeed : POLICE.carSpeed * 0.4;
      c.speed += Math.sign(want - c.speed) * 500 * dt;
      c.x += Math.cos(c.angle) * c.speed * dt;
      c.y += Math.sin(c.angle) * c.speed * dt;
      // Ram the player's car or knock the player down.
      if (d < 40) {
        if (player.car) {
          player.car.speed *= 0.6;
          game.onPoliceRam(c);
        } else {
          player.hurt(POLICE.ramDamage);
          game.onPlayerHit();
        }
        // Bounce the cop car back so it does not stick.
        c.x -= Math.cos(c.angle) * 50;
        c.y -= Math.sin(c.angle) * 50;
        c.speed *= -0.3;
      }
    }

    // Foot cops run at the player and shoot at 3+ stars.
    this.shootTimer -= dt;
    for (const cop of this.cops) {
      const dx = player.x - cop.x;
      const dy = player.y - cop.y;
      const d = Math.hypot(dx, dy) || 1;
      cop.angle = Math.atan2(dy, dx);
      cop.walkPhase += dt * 10;
      if (d > 90) {
        cop.x += (dx / d) * POLICE.footSpeed * dt;
        cop.y += (dy / d) * POLICE.footSpeed * dt;
      } else if (player.onFoot) {
        player.hurt(6);
        game.onPlayerHit();
      }
      cop.shootTimer -= dt;
      if (this.wanted >= 3 && d < POLICE.shootRange && cop.shootTimer <= 0) {
        cop.shootTimer = POLICE.shootCooldown;
        game.policeShoot(cop, cop.angle);
      }
    }
  }

  _nearestCopDist(x, y) {
    let best = Infinity;
    for (const c of this.cars) best = Math.min(best, Math.hypot(c.x - x, c.y - y));
    for (const c of this.cops) best = Math.min(best, Math.hypot(c.x - x, c.y - y));
    return best;
  }
}
