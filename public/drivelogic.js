// Pure logic for the `drive` template: steer the car with WASD/arrows (or drag), dodge the actors standing on the road.
import { W, H } from './engine.js';

export const ROAD_L = 80, ROAD_R = 320; // road edges; the car cannot leave the road
export const CAR_W = 26, CAR_H = 44, OR = 17; // car size, obstacle radius
const MOVE = 240; // px/s, from keys or towards the pointer
const HURT = 1.2; // seconds of invulnerability after a crash

export const DIFFICULTY = {
  easy: { speed: 150, every: 0.85, lives: 3 },
  normal: { speed: 190, every: 0.65, lives: 3 },
  hard: { speed: 240, every: 0.5, lives: 2 },
};

export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  return {
    actors: spec.actors, car: { x: W / 2, y: H - 50, vx: 0 }, obstacles: [], dist: 0, dodged: 0, hurt: 0,
    input: { x: 0, y: 0 }, target: null, ...d, spawnIn: 0.6, duration: spec.durationSec, timeLeft: spec.durationSec, status: 'playing', rng,
  };
}

const has = (keys, ...names) => names.some((n) => keys.has(n));
// keys: a Set of lower-case key names ('w', 'arrowleft', ...)
export function setKeys(s, keys) {
  s.input = { x: has(keys, 'd', 'arrowright') - has(keys, 'a', 'arrowleft'), y: has(keys, 's', 'arrowdown') - has(keys, 'w', 'arrowup') };
}

// Touch/mouse: the car drives towards the held pointer; null releases it.
export const pointTo = (s, p) => { s.target = p ? { x: p.x, y: p.y } : null; };

const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

export function step(s, dt) {
  if (s.status !== 'playing') return;
  const c = s.car;
  let dx = s.input.x, dy = s.input.y;
  if (s.target) {
    const tx = s.target.x - c.x, ty = s.target.y - c.y, d = Math.hypot(tx, ty);
    const k = d > 4 ? Math.min(1, d / 30) / d : 0; // slow down near the finger so the car does not jitter
    dx = tx * k; dy = ty * k;
  } else if (dx && dy) { dx *= Math.SQRT1_2; dy *= Math.SQRT1_2; }
  c.vx = dx * MOVE;
  c.x = clamp(c.x + dx * MOVE * dt, ROAD_L + CAR_W / 2, ROAD_R - CAR_W / 2);
  c.y = clamp(c.y + dy * MOVE * dt, 40 + CAR_H / 2, H - CAR_H / 2 - 4);
  // the road speeds up by half over the round; driving up is the gas, down the brake
  const v = s.speed * (1 + 0.5 * (1 - s.timeLeft / s.duration)) * (1 - 0.25 * dy);
  s.dist += v * dt;

  s.spawnIn -= dt;
  if (s.spawnIn <= 0) {
    s.spawnIn = s.every;
    const actor = s.actors[Math.floor(s.rng() * s.actors.length)];
    s.obstacles.push({ actor, x: ROAD_L + OR + s.rng() * (ROAD_R - ROAD_L - 2 * OR), y: -OR, r: OR });
  }
  for (let i = s.obstacles.length - 1; i >= 0; i--) {
    const o = s.obstacles[i];
    o.y += v * dt;
    if (s.hurt <= 0 && Math.abs(o.x - c.x) < o.r + CAR_W / 2 - 3 && Math.abs(o.y - c.y) < o.r + CAR_H / 2 - 4) {
      s.obstacles.splice(i, 1); s.lives--; s.hurt = HURT;
    } else if (o.y > H + o.r) { s.obstacles.splice(i, 1); s.dodged++; }
  }
  s.hurt = Math.max(0, s.hurt - dt);
  s.timeLeft = Math.max(0, s.timeLeft - dt);
  if (s.lives <= 0) s.status = 'lost';
  else if (s.timeLeft === 0) s.status = 'won';
}

export const meters = (s) => Math.floor(s.dist / 10);
export const score = (s) => meters(s) + s.dodged * 5 + (s.status === 'won' ? s.lives * 100 : 0);
