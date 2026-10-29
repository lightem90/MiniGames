import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec } from '../public/spec.js';
import { createState, tap, step, cam, PR } from '../public/hoplogic.js';
import { W } from '../public/engine.js';

const spec = (over = {}) => normalizeSpec({ template: 'hop', actors: [{ label: 'A' }], durationSec: 30, ...over });
const mid = () => 0.5;
const run = (s, sec) => { for (let t = 0; t < sec; t += 1 / 60) step(s, 1 / 60); };

test('tap ahead hops a lane, tap aside steps, never outside the road', () => {
  const s = createState(spec(), mid);
  tap(s, s.player.x); assert.equal(s.player.row, 1);
  tap(s, 0); assert.equal(s.player.x, W / 2 - 40);
  for (let i = 0; i < 4; i++) tap(s, 0);
  assert.equal(s.player.x, PR);
  assert.equal(s.player.row, 1);
  for (let i = 0; i < 20; i++) tap(s, s.player.x); // lanes are generated ahead of the camera
  assert.ok(s.lanes.length > cam(s) + 9);
  assert.equal(s.best, 21);
});

test('a car hit costs a life and knocks you back to a safe lane; no lives loses', () => {
  const s = createState(spec(), mid);
  s.lanes[2] = { road: true, dir: 1, actor: 0, cars: [s.player.x] };
  tap(s, s.player.x); tap(s, s.player.x);
  assert.equal(s.player.row, 2);
  step(s, 1 / 60);
  assert.equal(s.lives, 2);
  assert.equal(s.player.row, 1);
  s.lives = 1;
  tap(s, s.player.x);
  s.lanes[2].cars = [s.player.x];
  step(s, 1 / 60);
  assert.equal(s.status, 'lost');
  const w = createState(spec(), mid);
  run(w, 31);
  assert.equal(w.status, 'won');
});
