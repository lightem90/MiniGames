// Pure logic for the `defend` template: actors walk in from the left, tap to place turrets that stop them.
import { W, H } from './engine.js';

const ER = 16; // enemy radius
const TR = 14; // turret radius
export const LANES = [70, 150, 230];

export const DIFFICULTY = {
  easy: { speed: 40, every: 1.6, hp: 2, range: 90, baseTurrets: 6, maxLeaks: 5 },
  normal: { speed: 55, every: 1.2, hp: 3, range: 80, baseTurrets: 5, maxLeaks: 4 },
  hard: { speed: 75, every: 0.9, hp: 3, range: 70, baseTurrets: 5, maxLeaks: 3 },
};
const FIRE_EVERY = 0.6;

export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  return { actors: spec.actors, turrets: [], enemies: [], shots: [], kills: 0, leaks: 0, ...d, spawnIn: 0.8, timeLeft: spec.durationSec, status: 'playing', rng };
}

// Every 5 kills earns one more turret.
export const turretsAllowed = (s) => s.baseTurrets + Math.floor(s.kills / 5);

// Tap places a turret. Refused when none are left, outside the arena, or on top of another turret.
export function place(state, x, y) {
  if (state.status !== 'playing' || state.turrets.length >= turretsAllowed(state)) return false;
  if (x < TR || x > W - TR || y < 30 + TR || y > H - TR) return false;
  if (state.turrets.some((t) => Math.hypot(t.x - x, t.y - y) < 2 * TR)) return false;
  state.turrets.push({ x, y, r: TR, cd: 0 });
  return true;
}

export function step(state, dt) {
  if (state.status !== 'playing') return;
  state.spawnIn -= dt;
  if (state.spawnIn <= 0) {
    state.spawnIn = state.every;
    const actor = state.actors[Math.floor(state.rng() * state.actors.length)];
    state.enemies.push({ actor, x: -ER, y: LANES[Math.floor(state.rng() * LANES.length)], r: ER, hp: state.hp, maxHp: state.hp, speed: state.speed * (0.85 + state.rng() * 0.3) });
  }
  for (let i = state.enemies.length - 1; i >= 0; i--) {
    const e = state.enemies[i];
    e.x += e.speed * dt;
    if (e.x > W + ER) { state.enemies.splice(i, 1); state.leaks++; }
  }
  for (const t of state.turrets) {
    t.cd -= dt;
    if (t.cd > 0) continue;
    // shoot the enemy closest to leaking among those in range
    let target = null;
    for (const e of state.enemies) if (Math.hypot(e.x - t.x, e.y - t.y) <= state.range && (!target || e.x > target.x)) target = e;
    if (!target) continue;
    t.cd = FIRE_EVERY;
    target.hp--;
    state.shots.push({ x1: t.x, y1: t.y, x2: target.x, y2: target.y, ttl: 0.08 });
    if (target.hp <= 0) { state.enemies.splice(state.enemies.indexOf(target), 1); state.kills++; }
  }
  for (let i = state.shots.length - 1; i >= 0; i--) if ((state.shots[i].ttl -= dt) <= 0) state.shots.splice(i, 1);

  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.leaks >= state.maxLeaks) state.status = 'lost';
  else if (state.timeLeft === 0) state.status = 'won';
}

export const score = (s) => s.kills * 50 + (s.status === 'won' ? (s.maxLeaks - s.leaks) * 100 : 0);
