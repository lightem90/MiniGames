// Pure logic for the `click` template (clicker): tap the goal as fast as you can; reach the count before the clock.
import { W, H } from './engine.js';

export const DIFFICULTY = { easy: { goal: 60 }, normal: { goal: 100 }, hard: { goal: 150 } };

export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  return { actors: spec.actors, taps: 0, x: W / 2, y: H / 2 + 15, r: 40, pop: null, ...d, timeLeft: spec.durationSec, status: 'playing', rng };
}

// Returns true on a hit. Each hit grows the button a little and shows which actor got muted.
export function tap(s, x, y) {
  if (s.status !== 'playing' || Math.hypot(x - s.x, y - s.y) > s.r + 10) return false;
  s.taps++;
  s.r = Math.min(90, s.r + 0.3);
  s.pop = { actor: s.actors[Math.floor(s.rng() * s.actors.length)], t: 0.5 };
  if (s.taps >= s.goal) s.status = 'won';
  return true;
}

export function step(s, dt) {
  if (s.status !== 'playing') return;
  if (s.pop && (s.pop.t -= dt) <= 0) s.pop = null;
  s.timeLeft = Math.max(0, s.timeLeft - dt);
  if (s.timeLeft === 0) s.status = 'lost';
}

export const score = (s) => s.taps * 10 + (s.status === 'won' ? Math.ceil(s.timeLeft) * 10 : 0);
