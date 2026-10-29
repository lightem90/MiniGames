import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec } from '../public/spec.js';
import { createState, aim, drop, step, radius, TOP, DIFFICULTY } from '../public/mergelogic.js';
import { H } from '../public/engine.js';

const spec = (over = {}) => normalizeSpec({ template: 'merge', actors: [{ label: 'A' }, { label: 'B' }, { label: 'C' }], durationSec: 30, ...over });
const zero = () => 0; // always drops the smallest actor
const run = (s, sec) => { for (let t = 0; t < sec; t += 1 / 60) step(s, 1 / 60); };

test('a dropped ball falls to the floor; two of a kind merge into the next actor', () => {
  const s = createState(spec(), zero);
  aim(s, 200); drop(s);
  run(s, 2);
  assert.equal(s.balls.length, 1);
  assert.equal(Math.round(s.balls[0].y), H - radius(0));
  drop(s);
  run(s, 2);
  assert.equal(s.balls.length, 1);
  assert.equal(s.balls[0].lvl, 1);
  assert.equal(s.merges, 1);
});

test('aim stays inside the box', () => {
  const s = createState(spec(), zero);
  aim(s, -100); assert.equal(s.x, radius(0));
  aim(s, 9999); assert.equal(s.x, 400 - radius(0));
});

test('a stack resting above the line loses; otherwise the clock wins', () => {
  const s = createState(spec({ actors: Array.from({ length: 8 }, (_, i) => ({ label: 'A' + i })) }), zero);
  // a column of three big, different balls is taller than the box
  s.balls.push({ lvl: 7, x: 200, y: H - radius(7), vx: 0, vy: 0 }, { lvl: 6, x: 200, y: H - 2 * radius(7) - radius(6), vx: 0, vy: 0 }, { lvl: 7, x: 200, y: H - 2 * radius(7) - 2 * radius(6) - radius(7), vx: 0, vy: 0 });
  assert.ok(s.balls[2].y - radius(7) < TOP);
  run(s, DIFFICULTY.normal.overflowSec + 0.2);
  assert.equal(s.status, 'lost');
  const w = createState(spec(), zero);
  run(w, 31);
  assert.equal(w.status, 'won');
});
