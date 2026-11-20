// Palmera Bay — the story: six missions for Milo Reyes.
// One job: define each mission, its objectives, and when it is done.
// A mission is a small state machine: start -> objectives -> complete/fail.
import { MISSION_REWARDS } from './config.js';

export const MISSION_INTRO = [
  "Eddie needs wheels. Steal any car and bring it to his garage.",
  "A package is waiting at the pier. Pick it up and deliver it to the docks — fast.",
  "You made the list. Lose the heat: stay out of sight until the stars cool off.",
  "Three drops of cash are stashed around the bay. Collect them all.",
  "The shops on Coral Row owe the crew. Visit all three and collect.",
  "The big one: hit Palmera Bank, then lose the cops and reach the hideout.",
];

export const MISSION_TITLES = [
  'First Wheels',
  'Package Run',
  'Hot Pursuit',
  'The Collector',
  'Shake Down',
  'The Big Score',
];

// Objective kinds: goto | pickup | survive | collect | hold | escape
export function missionObjective(index) {
  switch (index) {
    case 0:
      return { kind: 'goto', x: 1225, y: 185, label: "Drive to Eddie's Garage", needsCar: true };
    case 1:
      return { kind: 'pickup', x: 2740, y: 2350, label: 'Pick up the package at Pier 9', then: { kind: 'deliver', x: 3340, y: 1800, label: 'Deliver to the docks', timer: 90 } };
    case 2:
      return { kind: 'survive', label: 'Lose the heat — stay unseen for 60s', timer: 60, setWanted: 2 };
    case 3:
      return {
        kind: 'collect', label: 'Collect the cash drops (0/3)',
        points: [
          { x: 700, y: 600, taken: false },
          { x: 2200, y: 1000, taken: false },
          { x: 1200, y: 1800, taken: false },
        ],
      };
    case 4:
      return {
        kind: 'collect', label: 'Collect from the shops (0/3)',
        hold: 3,
        points: [
          { x: 700, y: 1200, taken: false },
          { x: 1700, y: 800, taken: false },
          { x: 2700, y: 1600, taken: false },
        ],
      };
    case 5:
      return { kind: 'hold', x: 2235, y: 690, label: 'Rob Palmera Bank — hold the vault (10s)', hold: 10, then: { kind: 'escape', x: 3220, y: 2190, label: 'Escape to the hideout', setWanted: 3 } };
    default:
      return null;
  }
}

export class Missions {
  constructor() {
    this.index = 0; // next mission to start
    this.active = null; // { index, objective, timer, holdTimer, collected, stage }
    this.done = 0;
    this.message = '';
    this.messageTimer = 0;
  }

  get currentTitle() {
    return MISSION_TITLES[this.index] ?? 'Free Roam';
  }

  start(index, game) {
    const obj = missionObjective(index);
    if (!obj) return false;
    this.active = {
      index,
      objective: obj,
      timer: obj.timer ?? 0,
      holdTimer: 0,
      collected: 0,
      stage: 0,
      nearTimer: 0,
    };
    if (obj.setWanted) game.police.addWanted(obj.setWanted);
    this.message = `MISSION: ${MISSION_TITLES[index]} — ${obj.label}`;
    this.messageTimer = 5;
    game.sounds.missionStart();
    return true;
  }

  cancel() {
    this.active = null;
  }

  complete(game) {
    const idx = this.active.index;
    const reward = MISSION_REWARDS[idx];
    game.player.cash += reward;
    game.totalEarned += reward;
    this.done += 1;
    this.index = Math.min(idx + 1, MISSION_TITLES.length);
    this.active = null;
    this.message = `MISSION COMPLETE — $${reward} earned`;
    this.messageTimer = 5;
    game.sounds.missionDone();
    game.save();
  }

  fail(game, reason) {
    this.active = null;
    this.message = `MISSION FAILED — ${reason}`;
    this.messageTimer = 5;
    game.sounds.busted();
  }

  update(dt, game) {
    if (this.messageTimer > 0) this.messageTimer -= dt;
    const m = this.active;
    if (!m) return;
    const p = game.player;
    const obj = m.objective;
    if (m.timer > 0) {
      m.timer -= dt;
      if (m.timer <= 0) {
        this.fail(game, 'Out of time');
        return;
      }
    }
    const dist = (x, y) => Math.hypot(p.x - x, p.y - y);

    switch (obj.kind) {
      case 'goto':
        if (obj.needsCar && p.onFoot) break;
        if (dist(obj.x, obj.y) < 70) this.complete(game);
        break;
      case 'pickup':
        if (dist(obj.x, obj.y) < 60) {
          m.objective = obj.then;
          m.timer = obj.then.timer ?? 0;
          this.message = obj.then.label;
          this.messageTimer = 4;
          game.sounds.pickup();
        }
        break;
      case 'deliver':
        if (dist(obj.x, obj.y) < 70) this.complete(game);
        break;
      case 'survive':
        if (game.police.wanted === 0) this.complete(game);
        break;
      case 'collect': {
        let changed = false;
        for (const pt of obj.points) {
          if (pt.taken) continue;
          if (dist(pt.x, pt.y) < 55) {
            if (obj.hold) {
              m.nearTimer += dt;
              if (m.nearTimer >= obj.hold) {
                pt.taken = true;
                m.collected += 1;
                m.nearTimer = 0;
                game.sounds.pickup();
                changed = true;
              }
            } else {
              pt.taken = true;
              m.collected += 1;
              game.sounds.pickup();
              changed = true;
            }
          }
        }
        if (m.nearTimer > 0 && !obj.points.some((pt) => !pt.taken && dist(pt.x, pt.y) < 55)) m.nearTimer = 0;
        if (changed) {
          this.message = `${obj.label.split('(')[0].trim()} (${m.collected}/${obj.points.length})`;
          this.messageTimer = 2.5;
        }
        if (m.collected >= obj.points.length) this.complete(game);
        break;
      }
      case 'hold':
        if (dist(obj.x, obj.y) < 80) {
          m.holdTimer += dt;
          if (m.holdTimer >= obj.hold) {
            m.objective = obj.then;
            this.message = obj.then.label;
            this.messageTimer = 4;
            game.police.addWanted(obj.then.setWanted);
            game.sounds.wantedUp();
          }
        } else {
          m.holdTimer = Math.max(0, m.holdTimer - dt * 2);
        }
        break;
      case 'escape':
        if (dist(obj.x, obj.y) < 80 && game.police.wanted === 0) this.complete(game);
        break;
      default:
        break;
    }
  }

  // Where should the HUD arrow and minimap point right now?
  get target() {
    const m = this.active;
    if (!m) return null;
    const obj = m.objective;
    if (obj.kind === 'collect') {
      const next = obj.points.find((pt) => !pt.taken);
      return next ? { x: next.x, y: next.y, label: obj.label } : null;
    }
    if (obj.kind === 'survive') return null;
    return { x: obj.x, y: obj.y, label: obj.label };
  }

  get objectiveText() {
    const m = this.active;
    if (!m) return '';
    const obj = m.objective;
    let text = obj.label;
    if (obj.kind === 'collect') text = `${obj.label.split('(')[0].trim()} (${m.collected}/${obj.points.length})`;
    if (obj.kind === 'hold') text = `${obj.label} — ${Math.max(0, obj.hold - m.holdTimer).toFixed(0)}s`;
    if (m.timer > 0) text += ` — ${Math.ceil(m.timer)}s`;
    return text;
  }
}
