// Pure logic for the `dodge` template: drag your avatar left/right, dodge the falling actors.
import { W, H } from './engine.js';

const PR = 18; // player radius
const IR = 16; // item radius

export const DIFFICULTY = {
  easy: { speed: 110, every: 0.8, lives: 3 },
  normal: { speed: 160, every: 0.6, lives: 3 },
  hard: { speed: 230, every: 0.42, lives: 2 },
};

export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  return { actors: spec.actors, player: { x: W / 2, y: H - 30, r: PR }, items: [], dodged: 0, ...d, spawnIn: 0.5, timeLeft: spec.durationSec, status: 'playing', rng };
}

export function moveTo(state, x) {
  state.player.x = Math.min(W - PR, Math.max(PR, x));
}

export function step(state, dt) {
  if (state.status !== 'playing') return;
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    state.spawnIn = state.every;
    const actor = state.actors[Math.floor(state.rng() * state.actors.length)];
    state.items.push({ actor, x: IR + state.rng() * (W - 2 * IR), y: -IR, r: IR, vy: state.speed * (0.8 + state.rng() * 0.4) });
  }
  const p = state.player;
  for (let i = state.items.length - 1; i >= 0; i--) {
    const it = state.items[i];
    it.y += it.vy * dt;
    if (Math.hypot(it.x - p.x, it.y - p.y) < it.r + p.r) { state.items.splice(i, 1); state.lives--; }
    else if (it.y > H + it.r) { state.items.splice(i, 1); state.dodged++; }
  }
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.lives <= 0) state.status = 'lost';
  else if (state.timeLeft === 0) state.status = 'won';
}

export const score = (s) => s.dodged * 10 + (s.status === 'won' ? s.lives * 100 : 0);
