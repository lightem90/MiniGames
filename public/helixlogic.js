// Pure logic for the `helix` template (Helix Jump-style): the ball bounces down; drag to slide the rings so it falls through the gaps, never onto an actor.
import { W, H } from './engine.js';

export const CX = W / 2;
export const BALL_R = 10;
export const RING_H = 8;
const SPACING = 60;
const GRAVITY = 900;
const BOUNCE = -300; // rises ~50px, less than one ring spacing, so a passed ring is never hit again
const FOLLOW_Y = 150;

export const DIFFICULTY = {
  easy: { gapW: 110, badW: 40 },
  normal: { gapW: 90, badW: 60 },
  hard: { gapW: 70, badW: 80 },
};

export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  const s = { actors: spec.actors, rings: [], ball: { y: 60, vy: 0 }, rot: 0, passed: 0, ...d, timeLeft: spec.durationSec, status: 'playing', rng };
  fill(s);
  return s;
}

function fill(s) {
  while (!s.rings.length || s.rings[s.rings.length - 1].y < H + SPACING) {
    const y = s.rings.length ? s.rings[s.rings.length - 1].y + SPACING : 120;
    s.rings.push({ y, gap: s.rng() * W, actor: Math.floor(s.rng() * s.actors.length) });
  }
}

export const rotate = (s, dx) => { s.rot = (((s.rot + dx) % W) + W) % W; };
export const gapX = (s, ring) => (ring.gap + s.rot) % W; // the gap spans [gapX, gapX + gapW), the actor sits right after it

export function step(s, dt) {
  if (s.status !== 'playing') return;
  const b = s.ball;
  const bottom = b.y + BALL_R;
  b.vy += GRAVITY * dt;
  b.y += b.vy * dt;
  const ring = s.rings[0];
  if (b.vy > 0 && bottom <= ring.y && b.y + BALL_R > ring.y) {
    const off = ((CX - gapX(s, ring)) % W + W) % W;
    if (off < s.gapW) { s.rings.shift(); s.passed++; }
    else if (off < s.gapW + s.badW) { s.status = 'lost'; return; }
    else { b.y = ring.y - BALL_R; b.vy = BOUNCE; }
  }
  if (b.y > FOLLOW_Y) {
    const shift = b.y - FOLLOW_Y;
    b.y = FOLLOW_Y;
    for (const r of s.rings) r.y -= shift;
  }
  fill(s);
  s.timeLeft = Math.max(0, s.timeLeft - dt);
  if (s.timeLeft === 0) s.status = 'won';
}

export const score = (s) => s.passed * 10 + (s.status === 'won' ? 100 : 0);
