import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec } from '../public/spec.js';
import { createState, rotate, step, CX } from '../public/helixlogic.js';

const spec = (over = {}) => normalizeSpec({ template: 'helix', actors: [{ label: 'A' }], durationSec: 30, ...over });
const mid = () => 0.5; // every gap starts at x=200, right under the ball
const run = (s, sec) => { for (let t = 0; t < sec; t += 1 / 60) step(s, 1 / 60); };

test('falls through gaps, bounces on the ring, loses on the actor', () => {
  const s = createState(spec(), mid);
  run(s, 1);
  assert.ok(s.passed >= 2);
  const b = createState(spec(), mid);
  rotate(b, -200); // gap far left, actor at 90..150: solid under the ball
  const y0 = b.rings[0].y;
  run(b, 1);
  assert.equal(b.passed, 0);
  assert.ok(b.ball.y < y0 && b.status === 'playing');
  const l = createState(spec(), mid);
  rotate(l, -100); // actor segment 190..250 covers CX
  run(l, 1);
  assert.equal(l.status, 'lost');
  assert.equal(CX, 200);
});

test('rotation wraps and the clock wins', () => {
  const s = createState(spec(), mid);
  rotate(s, -450); assert.equal(s.rot, 350);
  rotate(s, 100); assert.equal(s.rot, 50);
  run(s, 31);
  assert.equal(s.status, 'won');
});
