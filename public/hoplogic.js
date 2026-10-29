// Pure logic for the `hop` template (Crossy Road-style): tap ahead to hop a lane, tap aside to step; actors drive across the roads.
import { W, H } from './engine.js';

export const LANE = 30;
export const PR = 14, CR = 16;
const VISIBLE = 9;

export const DIFFICULTY = {
  easy: { speed: 90, lives: 3, roadP: 0.5 },
  normal: { speed: 130, lives: 3, roadP: 0.65 },
  hard: { speed: 180, lives: 2, roadP: 0.8 },
};

export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  const s = { actors: spec.actors, lanes: [], player: { row: 0, x: W / 2 }, best: 0, ...d, timeLeft: spec.durationSec, status: 'playing', rng };
  ensureLanes(s);
  return s;
}

export const cam = (s) => Math.max(0, s.player.row - 4);
export const rowY = (s, row) => H - 20 - (row - cam(s)) * LANE;

function ensureLanes(s) {
  while (s.lanes.length < cam(s) + VISIBLE + 1) {
    const k = s.lanes.length;
    const road = k > 1 && s.rng() < s.roadP;
    const n = 2 + Math.floor(s.rng() * 2);
    s.lanes.push({ road, dir: s.rng() < 0.5 ? -1 : 1, actor: Math.floor(s.rng() * s.actors.length), cars: road ? Array.from({ length: n }, (_, i) => (i * W) / n) : [] });
  }
}

export function tap(s, x) {
  if (s.status !== 'playing') return;
  const p = s.player;
  if (x < p.x - 30) p.x = Math.max(PR, p.x - 40);
  else if (x > p.x + 30) p.x = Math.min(W - PR, p.x + 40);
  else { p.row++; s.best = Math.max(s.best, p.row); }
  ensureLanes(s);
}

export function step(s, dt) {
  if (s.status !== 'playing') return;
  for (const l of s.lanes) for (let i = 0; i < l.cars.length; i++) l.cars[i] = (((l.cars[i] + l.dir * s.speed * dt) % W) + W) % W;
  const p = s.player;
  if (s.lanes[p.row].cars.some((x) => Math.abs(x - p.x) < PR + CR)) {
    s.lives--;
    while (s.lanes[p.row].road) p.row--; // knocked back to the last safe lane
  }
  s.timeLeft = Math.max(0, s.timeLeft - dt);
  if (s.lives <= 0) s.status = 'lost';
  else if (s.timeLeft === 0) s.status = 'won';
}

export const score = (s) => s.best * 10 + (s.status === 'won' ? s.lives * 50 : 0);
