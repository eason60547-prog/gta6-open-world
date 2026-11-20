// Palmera Bay — save and load.
// One job: persist progress to localStorage and read it back.
import { SAVE_KEY } from './config.js';

export function saveGame(state) {
  try {
    const data = {
      cash: state.player.cash,
      missionIndex: state.missions.index,
      health: state.player.health,
      ammo: state.player.ammo,
      hasPistol: state.player.hasPistol,
      x: state.player.x,
      y: state.player.y,
      totalEarned: state.totalEarned,
      missionsDone: state.missionsDone,
      savedAt: Date.now(),
    };
    localStorage.setItem(SAVE_KEY, JSON.stringify(data));
    return true;
  } catch {
    return false;
  }
}

export function loadGame() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data.cash !== 'number' || typeof data.missionIndex !== 'number') return null;
    return data;
  } catch {
    return null;
  }
}

export function hasSave() {
  return loadGame() !== null;
}

export function clearSave() {
  try { localStorage.removeItem(SAVE_KEY); } catch { /* ignore */ }
}
