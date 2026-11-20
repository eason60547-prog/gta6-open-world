// Palmera Bay — the player: on foot, in a car, fighting.
// One job: move the player, drive cars, punch and shoot.
import { PLAYER, PISTOL, CAR, WORLD } from './config.js';
import { collideBuildings, isRoad, isWater, isBeach } from './world.js';

export class Player {
  constructor(x, y) {
    this.x = x;
    this.y = y;
    this.angle = -Math.PI / 2;
    this.speed = 0;
    this.health = PLAYER.maxHealth;
    this.cash = 0;
    this.ammo = PISTOL.startAmmo;
    this.hasPistol = true;
    this.car = null; // the car object the player is driving, or null
    this.punchTimer = 0;
    this.shootTimer = 0;
    this.hurtTimer = 0;
    this.moving = false;
    this.aimAngle = -Math.PI / 2;
  }

  get onFoot() { return this.car === null; }

  hurt(amount) {
    if (this.hurtTimer > 0) return;
    this.health = Math.max(0, this.health - amount);
    this.hurtTimer = 0.5;
  }

  update(dt, input, city, game) {
    this.punchTimer = Math.max(0, this.punchTimer - dt);
    this.shootTimer = Math.max(0, this.shootTimer - dt);
    this.hurtTimer = Math.max(0, this.hurtTimer - dt);
    this.moving = false;

    if (this.car) {
      this.updateDriving(dt, input, city, game);
      return;
    }

    // On foot: WASD / arrows move, Shift runs.
    let mx = 0;
    let my = 0;
    if (input.down('w', 'arrowup')) my -= 1;
    if (input.down('s', 'arrowdown')) my += 1;
    if (input.down('a', 'arrowleft')) mx -= 1;
    if (input.down('d', 'arrowright')) mx += 1;
    if (mx !== 0 || my !== 0) {
      const len = Math.hypot(mx, my);
      const run = input.down('shift') ? PLAYER.runSpeed : PLAYER.walkSpeed;
      this.x += (mx / len) * run * dt;
      this.y += (my / len) * run * dt;
      this.angle = Math.atan2(my, mx);
      this.moving = true;
    }
    const fixed = collideBuildings(city, this.x, this.y, PLAYER.radius);
    this.x = fixed.x;
    this.y = fixed.y;
    if (isWater(this.x, this.y)) {
      // The sea pushes you back onto the sand.
      this.y = WORLD.height - 96;
    }
    this.x = Math.max(24, Math.min(WORLD.width - 24, this.x));
    this.y = Math.max(24, Math.min(WORLD.height - 24, this.y));

    // Aim follows the mouse (screen space -> world space).
    const aim = game.screenToWorld(input.mouse.x, input.mouse.y);
    this.aimAngle = Math.atan2(aim.y - this.y, aim.x - this.x);

    // F: punch. Mouse click / Space: shoot.
    if (input.wasPressed('f') && this.punchTimer <= 0) {
      this.punchTimer = PLAYER.punchCooldown;
      game.playerPunch();
    }
    if ((input.mouse.down || input.down(' ')) && this.shootTimer <= 0 && this.hasPistol && this.ammo > 0) {
      this.shootTimer = PISTOL.cooldown;
      this.ammo -= 1;
      game.playerShoot(this.aimAngle);
    }
  }

  updateDriving(dt, input, city, game) {
    const car = this.car;
    const forward = input.down('w', 'arrowup') ? 1 : 0;
    const reverse = input.down('s', 'arrowdown') ? 1 : 0;
    const steer = (input.down('a', 'arrowleft') ? -1 : 0) + (input.down('d', 'arrowright') ? 1 : 0);
    const handbrake = input.down(' ');

    const onRoad = isRoad(car.x, car.y);
    const maxSpeed = CAR.maxSpeed * (onRoad ? 1 : CAR.offroadFactor);
    const dir = Math.sign(car.speed) || 1;

    if (forward) car.speed += CAR.accel * dt;
    if (reverse) {
      if (car.speed > 30) car.speed -= CAR.brake * dt;
      else car.speed -= CAR.reverseAccel * dt;
    }
    if (!forward && !reverse) car.speed -= Math.sign(car.speed) * 160 * dt;
    if (handbrake) car.speed -= Math.sign(car.speed) * CAR.handbrake * dt;
    car.speed = Math.max(-CAR.maxReverse, Math.min(maxSpeed, car.speed));
    if (Math.abs(car.speed) < 4 && !forward && !reverse) car.speed = 0;

    // Steering scales with speed; reversing flips it.
    const steerAmount = CAR.steer * dir * Math.min(1, Math.abs(car.speed) / 140);
    car.angle += steer * steerAmount * dt;

    const nx = car.x + Math.cos(car.angle) * car.speed * dt;
    const ny = car.y + Math.sin(car.angle) * car.speed * dt;
    const blocked = this._carBlocked(city, game, nx, ny, car);
    if (!blocked) {
      car.x = nx;
      car.y = ny;
    } else {
      if (Math.abs(car.speed) > 240) game.carCrash(car);
      car.speed *= -0.25;
    }
    car.x = Math.max(30, Math.min(WORLD.width - 30, car.x));
    car.y = Math.max(30, Math.min(WORLD.height - 30, car.y));
    if (isWater(car.x, car.y)) {
      car.y = WORLD.height - 110;
      car.speed *= 0.3;
    }

    this.x = car.x;
    this.y = car.y;
    this.angle = car.angle;
    this.moving = Math.abs(car.speed) > 20;
    this.speed = car.speed;

    // E: hop out. Space: handbrake already handled.
    if (input.wasPressed('e')) game.exitCar();
  }

  _carBlocked(city, game, nx, ny, self) {
    // Buildings block cars.
    const r = 16;
    const fixed = collideBuildings(city, nx, ny, r);
    if (fixed.x !== nx || fixed.y !== ny) return true;
    // Other cars are solid.
    for (const c of game.cars) {
      if (c === self || c.wrecked) continue;
      const dx = c.x - nx;
      const dy = c.y - ny;
      if (dx * dx + dy * dy < 34 * 34) return true;
    }
    return false;
  }

  enterCar(car) {
    this.car = car;
    car.driver = 'player';
    car.speed = 0;
  }
}
