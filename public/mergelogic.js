// Pure logic for the `merge` template (Suika-style): drop actors into the box, two of a kind merge into the next actor.
import { W, H } from './engine.js';

export const TOP = 60; // drop line; a ball resting above it overflows the box
const GRAVITY = 700;
const REST = 20; // |vy| below this counts as resting
export const radius = (lvl) => 12 + 6 * lvl;

export const DIFFICULTY = {
  easy: { maxDrop: 1, overflowSec: 2 },
  normal: { maxDrop: 2, overflowSec: 1.5 },
  hard: { maxDrop: 3, overflowSec: 1 },
};

export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  const s = { actors: spec.actors, balls: [], x: W / 2, merges: 0, over: 0, ...d, timeLeft: spec.durationSec, status: 'playing', rng };
  s.next = nextLevel(s);
  return s;
}

const nextLevel = (s) => Math.floor(s.rng() * (Math.min(s.maxDrop, s.actors.length - 1) + 1));

export function aim(state, x) {
  const r = radius(state.next);
  state.x = Math.min(W - r, Math.max(r, x));
}

export function drop(state) {
  if (state.status !== 'playing') return;
  state.balls.push({ lvl: state.next, x: state.x, y: TOP - radius(state.next), vx: (state.rng() - 0.5) * 40, vy: 0 }); // a nudge, so same-x drops do not stack into a column
  state.next = nextLevel(state);
  aim(state, state.x);
}

export function step(state, dt) {
  if (state.status !== 'playing') return;
  const bs = state.balls;
  for (const b of bs) {
    b.vy += GRAVITY * dt;
    b.vx *= Math.exp(-2 * dt);
    b.x += b.vx * dt;
    b.y += b.vy * dt;
  }
  const gone = new Set();
  const born = [];
  for (let i = 0; i < bs.length; i++) {
    for (let j = i + 1; j < bs.length; j++) {
      const a = bs[i], b = bs[j];
      const ra = radius(a.lvl), rb = radius(b.lvl);
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.hypot(dx, dy) || 0.01;
      if (d >= ra + rb) continue;
      if (a.lvl === b.lvl && !gone.has(a) && !gone.has(b)) {
        gone.add(a); gone.add(b);
        state.merges += a.lvl + 1;
        // the last actor merges into nothing: that is the jackpot
        if (a.lvl + 1 < state.actors.length) born.push({ lvl: a.lvl + 1, x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, vx: 0, vy: 0 });
        continue;
      }
      const nx = dx / d, ny = dy / d, push = (ra + rb - d) / 2;
      a.x -= nx * push; a.y -= ny * push;
      b.x += nx * push; b.y += ny * push;
      // inelastic: drop the velocity that points into the other ball
      const va = a.vx * nx + a.vy * ny, vb = b.vx * nx + b.vy * ny;
      if (va > 0) { a.vx -= va * nx; a.vy -= va * ny; }
      if (vb < 0) { b.vx -= vb * nx; b.vy -= vb * ny; }
    }
  }
  state.balls = bs.filter((b) => !gone.has(b)).concat(born);
  let resting = false;
  for (const b of state.balls) {
    const r = radius(b.lvl);
    if (b.x < r) { b.x = r; b.vx = 0; }
    if (b.x > W - r) { b.x = W - r; b.vx = 0; }
    if (b.y > H - r) { b.y = H - r; b.vy = 0; b.vx *= 0.9; }
    if (b.y - r < TOP && Math.abs(b.vy) < REST) resting = true;
  }
  state.over = resting ? state.over + dt : 0;
  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.over >= state.overflowSec) state.status = 'lost';
  else if (state.timeLeft === 0) state.status = 'won';
}

export const score = (s) => s.merges * 10 + (s.status === 'won' ? 100 : 0);
