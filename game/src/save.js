// Save / load: cash + mission progress + best cash, in localStorage.
// A missing or corrupt save is just a fresh start — never a crash.
import { SAVE_KEY, BEST_KEY } from './config.js';

export function saveGame(data) {
  try {
    window.localStorage.setItem(SAVE_KEY, JSON.stringify(data));
  } catch { /* storage can be off: the run lasts this visit only */ }
}

export function loadGame() {
  try {
    const raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    if (typeof data !== 'object' || data === null) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearSave() {
  try {
    window.localStorage.removeItem(SAVE_KEY);
  } catch { /* ignore */ }
}

export function readBestCash() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

export function saveBestCash(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch { /* ignore */ }
}
