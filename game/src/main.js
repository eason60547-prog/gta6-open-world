// Palmera Bay — the game itself: state, loop, and all the rules that
// tie the systems together (stealing, crime, pickups, death, saving).
import { WORLD, PISTOL, PLAYER, WANTED } from './config.js';
import { buildCity } from './world.js';
import { makeRng, range } from './rng.js';
import { Input } from './input.js';
import { SoundBank } from './audio.js';
import { Player } from './player.js';
import { Traffic, makeCar } from './traffic.js';
import { Pedestrians } from './peds.js';
import { Police } from './police.js';
import { Missions } from './missions.js';
import { Renderer } from './render.js';
import { saveGame, loadGame, hasSave, clearSave } from './save.js';
import { stageShot } from './shots.js';

const SEED = 20261120;

class Game {
  constructor() {
    this.canvas = document.getElementById('game');
    this.mapCanvas = document.getElementById('minimap');
    this.input = new Input(this.canvas);
    this.sounds = new SoundBank();
    this.renderer = new Renderer(this.canvas, this.mapCanvas);
    this.city = buildCity(SEED);
    this.rng = makeRng(SEED + 7);
    this.player = new Player(1225, 260);
    this.traffic = new Traffic(this.city, makeRng(SEED + 11));
    this.peds = new Pedestrians(this.city, makeRng(SEED + 13));
    this.police = new Police(this.city, makeRng(SEED + 17));
    this.missions = new Missions();
    this.cars = [];
    this.pickups = [];
    this.effects = [];
    this.skids = [];
    this.state = 'title'; // title | playing | paused | dead
    this.time = 0;
    this.cash = 0;
    this.totalEarned = 0;
    this.missionsDone = 0;
    this.deadReason = '';
    this.bustedTimer = 0;
    this.autoSaveTimer = 0;
    this.healthSpawnTimer = 0;
    this.last = performance.now();
    this.shot = new URLSearchParams(location.search).get('shot');

    this.traffic.spawnInitial(26);
    this.peds.spawnInitial(34);
    this._spawnHealthCrates();

    this._wireMenus();
    this._resize();
    // The title screen starts up without the gameplay minimap.
    if (this.state === 'title') this.mapCanvas.style.display = 'none';
    window.addEventListener('resize', () => this._resize());

    if (this.shot) {
      stageShot(this, this.shot);
      // Staged gameplay shots hide the title overlay; the start shot keeps it.
      if (this.shot !== 'start') this._show(null);
      // Let the staged scene settle briefly: driving/chase shots only a few
      // ticks, so the cars are still moving when the screenshot is taken.
      const settle = this.shot === 'start' ? 0 : this.shot === 'mission' ? 40 : 12;
      for (let i = 0; i < settle; i++) this.update(1 / 60, true);
      // Freeze the staged scene so the screenshot catches it mid-action
      // (the live loop would otherwise let the police ram the car to a stop).
      if (this.shot !== 'start') this.frozen = true;
      window.__shotReady = true;
    }
    requestAnimationFrame((t) => this._frame(t));
  }

  _resize() {
    this.renderer.resize(window.innerWidth, window.innerHeight);
  }

  get totalEarned() { return this._totalEarned; }
  set totalEarned(v) { this._totalEarned = v; }

  // -- menus ---------------------------------------------------------------
  _wireMenus() {
    const $ = (id) => document.getElementById(id);
    $('btn-new').addEventListener('click', () => this.newGame());
    $('btn-continue').addEventListener('click', () => this.continueGame());
    $('btn-resume').addEventListener('click', () => this.resume());
    $('btn-save').addEventListener('click', () => { this.save(); this._flash('Game saved'); });
    $('btn-restart').addEventListener('click', () => this.newGame());
    $('btn-quit').addEventListener('click', () => this.toTitle());
    $('btn-respawn').addEventListener('click', () => this.respawn());
    $('btn-mute').addEventListener('click', () => {
      const muted = this.sounds.toggleMute();
      $('btn-mute').textContent = muted ? 'Sound: Off' : 'Sound: On';
    });
    if (!hasSave()) $('btn-continue').disabled = true;
  }

  _show(id) {
    for (const el of document.querySelectorAll('.overlay')) el.classList.add('hidden');
    if (id) document.getElementById(id).classList.remove('hidden');
    // The minimap belongs to gameplay, not to the title screen.
    this.mapCanvas.style.display = id === 'screen-title' ? 'none' : 'block';
  }

  _flash(text) {
    this.missions.message = text;
    this.missions.messageTimer = 2;
  }

  newGame() {
    clearSave();
    this.player = new Player(1225, 260);
    this.player.cash = 0;
    this.cash = 0;
    this.totalEarned = 0;
    this.missionsDone = 0;
    this.police.clearWanted();
    this.missions = new Missions();
    this.pickups = [];
    this.effects = [];
    this._spawnHealthCrates();
    this.state = 'playing';
    this._show(null);
    this.sounds.ensure();
    this.sounds.missionStart();
    this.missions.message = 'Welcome to Palmera Bay — press Q to start your first job';
    this.missions.messageTimer = 6;
  }

  continueGame() {
    const data = loadGame();
    if (!data) return;
    this.player = new Player(data.x, data.y);
    this.player.cash = data.cash;
    this.player.health = data.health;
    this.player.ammo = data.ammo;
    this.player.hasPistol = data.hasPistol;
    this.cash = data.cash;
    this.totalEarned = data.totalEarned || 0;
    this.missionsDone = data.missionsDone || 0;
    this.missions.index = data.missionIndex;
    this.missions.done = data.missionsDone || 0;
    this.police.clearWanted();
    this.state = 'playing';
    this._show(null);
    this.sounds.ensure();
    this._flash('Welcome back to Palmera Bay');
  }

  toTitle() {
    this.state = 'title';
    this._show('screen-title');
    if (!hasSave()) document.getElementById('btn-continue').disabled = true;
  }

  pause() {
    if (this.state !== 'playing') return;
    this.state = 'paused';
    this._show('screen-pause');
    this.sounds.engine(0);
    this.sounds.siren(false, 0);
  }

  resume() {
    if (this.state !== 'paused') return;
    this.state = 'playing';
    this._show(null);
  }

  save() {
    this.cash = this.player.cash;
    saveGame(this);
  }

  respawn() {
    const lost = Math.min(this.player.cash, 150);
    this.player.cash -= lost;
    this.player.health = PLAYER.maxHealth;
    this.player.ammo = PISTOL.startAmmo;
    this.player.x = 700;
    this.player.y = 1000;
    if (this.player.car) { this.player.car.driver = 'parked'; this.player.car = null; }
    this.police.clearWanted();
    this.missions.cancel();
    this.state = 'playing';
    this._show(null);
    this._flash(`You lost $${lost} — back on the streets`);
  }

  // -- frame ---------------------------------------------------------------
  _frame(t) {
    const dt = Math.min(0.05, (t - this.last) / 1000);
    this.last = t;
    if (this.state === 'playing' && !this.frozen) this.update(dt, false);
    this.renderer.updateCamera(dt, this.player.x, this.player.y, this.player.car ? Math.abs(this.player.car.speed) : 0);
    this.renderer.draw(this);
    this.input.endFrame();
    requestAnimationFrame((nt) => this._frame(nt));
  }

  update(dt, silent) {
    this.time += dt;
    this.cars = [...this.traffic.cars, ...this.police.cars];

    // Global keys.
    if (this.input.wasPressed('p') || this.input.wasPressed('escape')) { this.pause(); return; }
    if (this.input.wasPressed('m')) this.sounds.toggleMute();
    if (this.input.wasPressed('q') && !this.missions.active && this.missions.index < 6) {
      this.missions.start(this.missions.index, this);
    }

    this.player.update(dt, this.input, this.city, this);
    this.traffic.update(dt, this);
    this.peds.update(dt, this);
    this.police.update(dt, this);
    this.missions.update(dt, this);
    this._updatePickups(dt);
    this._updateEffects(dt);
    this._updateBusted(dt);
    this._updateHealthCrates(dt);

    // Steal a car with E (on foot only).
    if (this.player.onFoot && this.input.wasPressed('e')) this._trySteal();

    // Engine + siren sound.
    const engineLevel = this.player.car ? Math.abs(this.player.car.speed) / 560 : 0;
    this.sounds.engine(engineLevel);
    this.sounds.siren(this.police.cars.length > 0, dt);

    // Skid marks while handbraking at speed.
    if (this.player.car && this.input.down(' ') && Math.abs(this.player.car.speed) > 200) {
      const c = this.player.car;
      this.skids.push({
        x0: c.x - Math.cos(c.angle) * 20, y0: c.y - Math.sin(c.angle) * 20,
        x1: c.x, y1: c.y, life: 1,
      });
      if (this.skids.length > 120) this.skids.shift();
    }

    // Autosave every minute.
    this.autoSaveTimer += dt;
    if (this.autoSaveTimer > 60) { this.autoSaveTimer = 0; this.save(); }

    // Death check.
    if (this.player.health <= 0 && this.state === 'playing') {
      this.state = 'dead';
      this.deadReason = 'WASTED';
      document.getElementById('dead-title').textContent = 'WASTED';
      document.getElementById('dead-sub').textContent = 'Milo went down. The crew will remember him — or not.';
      this._show('screen-dead');
      this.sounds.busted();
      this.sounds.engine(0);
    }
  }

  screenToWorld(sx, sy) {
    return this.renderer.screenToWorld(sx, sy);
  }

  // -- interactions --------------------------------------------------------
  _trySteal() {
    const car = this.traffic.nearestStealable(this.player.x, this.player.y, 64);
    if (!car) return;
    const witnessed = car.driver === 'traffic' || this.police._nearestCopDist(this.player.x, this.player.y) < 500;
    this.player.enterCar(car);
    this.sounds.doorSlam();
    if (witnessed && this.police.addWanted(1)) {
      this.sounds.wantedUp();
      this._flash('Car stolen — the law saw that!');
    } else {
      this._flash(`You took the ${car.name}`);
    }
  }

  exitCar() {
    const car = this.player.car;
    if (!car) return;
    car.driver = 'parked';
    car.speed = 0;
    this.player.car = null;
    // Step out to the side of the car.
    this.player.x = car.x - Math.sin(car.angle) * 30;
    this.player.y = car.y + Math.cos(car.angle) * 30;
    this.sounds.doorSlam();
  }

  playerPunch() {
    this.sounds.punch();
    const reach = 46;
    const px = this.player.x + Math.cos(this.player.angle) * 26;
    const py = this.player.y + Math.sin(this.player.angle) * 26;
    // Knock a pedestrian down.
    for (const p of this.peds.peds) {
      if (Math.hypot(p.x - px, p.y - py) < reach) {
        p.scared = 5;
        p.target = { x: p.x + (p.x - this.player.x) * 3, y: p.y + (p.y - this.player.y) * 3 };
        this._dropCash(p.x, p.y, 15 + Math.floor(this.rng() * 20));
        this._commitCrime(1, 'Assault');
        return;
      }
    }
    for (const cop of this.police.cops) {
      if (Math.hypot(cop.x - px, cop.y - py) < reach) {
        cop.x += Math.cos(this.player.angle) * 30;
        cop.y += Math.sin(this.player.angle) * 30;
        this._commitCrime(1, 'Assaulting an officer');
        return;
      }
    }
  }

  playerShoot(angle) {
    this.sounds.gunshot();
    this._commitCrime(1, 'Shots fired');
    const rangePx = PISTOL.range;
    const ox = this.player.x;
    const oy = this.player.y;
    const ex = ox + Math.cos(angle) * rangePx;
    const ey = oy + Math.sin(angle) * rangePx;
    let hitX = ex;
    let hitY = ey;
    let bestD = rangePx;
    // Hit the nearest ped / cop / car along the shot line.
    const tryTarget = (tx, ty, radius) => {
      const dx = tx - ox;
      const dy = ty - oy;
      const along = dx * Math.cos(angle) + dy * Math.sin(angle);
      if (along < 0 || along > bestD) return null;
      const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
      if (perp < radius + 8) return { along, tx, ty };
      return null;
    };
    let hit = null;
    for (const p of this.peds.peds) {
      const h = tryTarget(p.x, p.y, 10);
      if (h && h.along < bestD) { bestD = h.along; hit = { kind: 'ped', obj: p }; hitX = h.tx; hitY = h.ty; }
    }
    for (const cop of this.police.cops) {
      const h = tryTarget(cop.x, cop.y, 11);
      if (h && h.along < bestD) { bestD = h.along; hit = { kind: 'cop', obj: cop }; hitX = h.tx; hitY = h.ty; }
    }
    for (const c of this.cars) {
      if (c === this.player.car) continue;
      const h = tryTarget(c.x, c.y, 22);
      if (h && h.along < bestD) { bestD = h.along; hit = { kind: 'car', obj: c }; hitX = h.tx; hitY = h.ty; }
    }
    this.effects.push({ kind: 'shot', x0: ox, y0: oy, x1: hitX, y1: hitY, life: 0.12, max: 0.12 });
    if (hit) {
      this.effects.push({ kind: 'boom', x: hitX, y: hitY, life: 0.25, max: 0.25 });
      this.peds.scare(hitX, hitY, 320);
      if (hit.kind === 'ped') {
        hit.obj.scared = 5;
        this._dropCash(hit.obj.x, hit.obj.y, 20 + Math.floor(this.rng() * 25));
      } else if (hit.kind === 'cop') {
        hit.obj.x += Math.cos(angle) * 40;
        hit.obj.y += Math.sin(angle) * 40;
      } else if (hit.kind === 'car') {
        hit.obj.wrecked = true;
        hit.obj.speed = 0;
        this.effects.push({ kind: 'smoke', x: hit.obj.x, y: hit.obj.y, life: 1.2, max: 1.2 });
      }
    }
  }

  policeShoot(cop, angle) {
    this.sounds.gunshot();
    const ox = cop.x;
    const oy = cop.y;
    const ex = ox + Math.cos(angle) * 380;
    const ey = oy + Math.sin(angle) * 380;
    this.effects.push({ kind: 'shot', x0: ox, y0: oy, x1: ex, y1: ey, life: 0.12, max: 0.12 });
    // Rough aim: hits if the player is roughly on the line.
    const dx = this.player.x - ox;
    const dy = this.player.y - oy;
    const along = dx * Math.cos(angle) + dy * Math.sin(angle);
    const perp = Math.abs(-dx * Math.sin(angle) + dy * Math.cos(angle));
    if (along > 0 && along < 400 && perp < 26) {
      this.player.hurt(7);
      this.onPlayerHit();
    }
  }

  carCrash(car) {
    this.sounds.crash();
    this.renderer.shake = 14;
    this.effects.push({ kind: 'smoke', x: car.x, y: car.y, life: 0.8, max: 0.8 });
    if (car.driver === 'player') this.player.hurt(5);
    // Running over a pedestrian while crashing into things counts.
    for (const p of this.peds.peds) {
      if (Math.hypot(p.x - car.x, p.y - car.y) < 40) {
        p.scared = 5;
        this._dropCash(p.x, p.y, 10 + Math.floor(this.rng() * 15));
        this._commitCrime(1, 'Hit and run');
      }
    }
  }

  onPoliceRam(car) {
    this.sounds.crash();
    this.renderer.shake = 10;
    this.effects.push({ kind: 'smoke', x: car.x, y: car.y, life: 0.6, max: 0.6 });
  }

  onPlayerHit() {
    this.sounds.hurt();
    this.renderer.shake = Math.max(this.renderer.shake, 6);
  }

  _commitCrime(stars, label) {
    if (this.police.addWanted(stars)) {
      this.sounds.wantedUp();
      this._flash(label + ' — wanted level up!');
    }
  }

  _dropCash(x, y, amount) {
    this.pickups.push({ x, y, kind: 'cash', amount, life: 25 });
  }

  _spawnHealthCrates() {
    this.pickups.push(
      { x: 700, y: 1000, kind: 'health', amount: 30, life: Infinity },
      { x: 1700, y: 1400, kind: 'health', amount: 30, life: Infinity },
      { x: 2700, y: 600, kind: 'health', amount: 30, life: Infinity },
    );
  }

  _updateHealthCrates(dt) {
    this.healthSpawnTimer += dt;
    if (this.healthSpawnTimer > 45) {
      this.healthSpawnTimer = 0;
      const spots = [{ x: 700, y: 1000 }, { x: 1700, y: 1400 }, { x: 2700, y: 600 }];
      for (const s of spots) {
        if (!this.pickups.some((p) => p.kind === 'health' && Math.hypot(p.x - s.x, p.y - s.y) < 30)) {
          this.pickups.push({ x: s.x, y: s.y, kind: 'health', amount: 30, life: Infinity });
        }
      }
    }
  }

  _updatePickups(dt) {
    for (const pk of this.pickups) {
      if (pk.life !== Infinity) pk.life -= dt;
      if (Math.hypot(pk.x - this.player.x, pk.y - this.player.y) < 34) {
        if (pk.kind === 'cash') {
          this.player.cash += pk.amount;
          this._flash(`+$${pk.amount}`);
        } else {
          this.player.health = Math.min(100, this.player.health + pk.amount);
          this._flash(`+${pk.amount} health`);
        }
        this.sounds.pickup();
        pk.taken = true;
      }
    }
    this.pickups = this.pickups.filter((p) => !p.taken && p.life > 0);
  }

  _updateEffects(dt) {
    for (const e of this.effects) e.life -= dt;
    this.effects = this.effects.filter((e) => e.life > 0);
    for (const s of this.skids) s.life -= dt * 0.25;
    this.skids = this.skids.filter((s) => s.life > 0);
  }

  _updateBusted(dt) {
    // A cop standing on the player while wanted -> busted.
    if (this.police.wanted > 0 && this.player.onFoot) {
      const near = this.police.cops.some((c) => Math.hypot(c.x - this.player.x, c.y - this.player.y) < 34);
      if (near) {
        this.bustedTimer += dt;
        if (this.bustedTimer > 2.5) {
          this.bustedTimer = 0;
          this.state = 'dead';
          this.deadReason = 'BUSTED';
          document.getElementById('dead-title').textContent = 'BUSTED';
          document.getElementById('dead-sub').textContent = 'The Palmera Bay PD hauled Milo in. The crew posted bail.';
          this._show('screen-dead');
          this.sounds.busted();
          this.sounds.engine(0);
        }
      } else {
        this.bustedTimer = 0;
      }
    }
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.__game = new Game();
});
