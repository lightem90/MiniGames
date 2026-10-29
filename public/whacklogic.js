// Pure logic for the `whack` template: actors pop up, tap them before they vanish.
import { W, H } from './engine.js';

const R = 24;

export const DIFFICULTY = {
  easy: { ttl: 1.6, every: 0.9, maxMisses: 8 },
  normal: { ttl: 1.2, every: 0.7, maxMisses: 6 },
  hard: { ttl: 0.8, every: 0.5, maxMisses: 4 },
};

export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  return { actors: spec.actors, targets: [], hits: 0, misses: 0, ...d, spawnIn: 0.3, timeLeft: spec.durationSec, status: 'playing', rng };
}

// Pops the target under (x, y). Returns true on a hit.
export function whack(state, x, y) {
  if (state.status !== 'playing') return false;
  for (let i = state.targets.length - 1; i >= 0; i--) {
    const t = state.targets[i];
    if (Math.hypot(t.x - x, t.y - y) <= t.r + 10) { state.targets.splice(i, 1); state.hits++; return true; }
  }
  return false;
}

export function step(state, dt) {
  if (state.status !== 'playing') return;
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    state.spawnIn = state.every;
    const actor = state.actors[Math.floor(state.rng() * state.actors.length)];
    state.targets.push({ actor, x: R + state.rng() * (W - 2 * R), y: 30 + R + state.rng() * (H - 30 - 2 * R), r: R, life: state.ttl });
  }
  for (let i = state.targets.length - 1; i >= 0; i--) {
    state.targets[i].life -= dt;
    if (state.targets[i].life <= 0) { state.targets.splice(i, 1); state.misses++; }
  }
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.misses >= state.maxMisses) state.status = 'lost';
  else if (state.timeLeft === 0) state.status = 'won';
}

export const score = (s) => s.hits * 100 + (s.status === 'won' ? (s.maxMisses - s.misses) * 50 : 0);
