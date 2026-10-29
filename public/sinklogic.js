// Pure game logic for the `sink` template: no DOM, no canvas, so it can be unit-tested.
// Flick balls into the hole before time runs out.

import { W, H } from './engine.js';
export { W, H };
const BALL_R = 20;
const MAX_FLICK = 900; // px/s cap so a wild drag can't teleport a ball
const SINK_SPEED = 260; // a ball faster than this skips over the hole
const STOP_SPEED = 4;

export const DIFFICULTY = {
  easy: { holeR: 44, friction: 1.6, holeDrift: 0 },
  normal: { holeR: 36, friction: 2.0, holeDrift: 0 },
  hard: { holeR: 28, friction: 2.6, holeDrift: 40 },
};

// rng is injectable so tests are deterministic.
export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  const n = spec.actors.length;
  const balls = spec.actors.map((actor, i) => ({
    actor,
    x: BALL_R + 10 + ((W - 2 * (BALL_R + 10)) * (i + rng() * 0.5)) / Math.max(n, 1),
    y: H - BALL_R - 10 - rng() * 40,
    vx: 0,
    vy: 0,
    r: BALL_R,
    sunk: false,
  }));
  return {
    balls,
    hole: { x: W / 2, y: 20 + d.holeR, r: d.holeR, dir: 1, drift: d.holeDrift },
    friction: d.friction,
    timeLeft: spec.durationSec,
    sunk: 0,
    status: 'playing', // playing | won | lost
  };
}

// Topmost unsunk ball under (x, y), or -1. Generous hit area: fingers are not pixels.
export function pickBall(state, x, y) {
  for (let i = state.balls.length - 1; i >= 0; i--) {
    const b = state.balls[i];
    if (!b.sunk && Math.hypot(b.x - x, b.y - y) <= b.r + 12) return i;
  }
  return -1;
}

export function flick(state, i, vx, vy) {
  const b = state.balls[i];
  if (!b || b.sunk || state.status !== 'playing') return;
  const speed = Math.hypot(vx, vy);
  const k = speed > MAX_FLICK ? MAX_FLICK / speed : 1;
  b.vx = vx * k;
  b.vy = vy * k;
}

export function step(state, dt) {
  if (state.status !== 'playing') return;
  const h = state.hole;

  if (h.drift) {
    h.x += h.dir * h.drift * dt;
    if (h.x > W - h.r) { h.x = W - h.r; h.dir = -1; }
    if (h.x < h.r) { h.x = h.r; h.dir = 1; }
  }

  for (const b of state.balls) {
    if (b.sunk) continue;
    b.x += b.vx * dt;
    b.y += b.vy * dt;
    if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
    if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
    if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
    if (b.y > H - b.r) { b.y = H - b.r; b.vy = -Math.abs(b.vy); }

    const decay = Math.exp(-state.friction * dt);
    b.vx *= decay;
    b.vy *= decay;
    if (Math.hypot(b.vx, b.vy) < STOP_SPEED) { b.vx = 0; b.vy = 0; }

    const speed = Math.hypot(b.vx, b.vy);
    if (Math.hypot(b.x - h.x, b.y - h.y) < h.r * 0.8 && speed < SINK_SPEED) {
      b.sunk = true;
      state.sunk++;
    }
  }

  state.timeLeft = Math.max(0, state.timeLeft - dt);
  if (state.sunk === state.balls.length) state.status = 'won';
  else if (state.timeLeft === 0) state.status = 'lost';
}

export function score(state) {
  return state.sunk * 100 + (state.status === 'won' ? Math.ceil(state.timeLeft) * 10 : 0);
}
