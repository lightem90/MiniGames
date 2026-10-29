import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec } from '../public/spec.js';
import { createState, whack, step, score, DIFFICULTY } from '../public/whacklogic.js';
import { W, H } from '../public/engine.js';

const spec = (over = {}) => normalizeSpec({ template: 'whack', actors: [{ label: 'A' }, { label: 'B' }], durationSec: 30, ...over });
const mid = () => 0.5;
const run = (s, sec) => { for (let t = 0; t < sec; t += 1 / 60) step(s, 1 / 60); };

test('targets spawn inside the arena below the HUD and vanish after ttl', () => {
  const s = createState(spec(), mid);
  run(s, 0.4);
  assert.equal(s.targets.length, 1);
  const t = s.targets[0];
  assert.ok(t.x > 0 && t.x < W && t.y > 30 && t.y < H);
  run(s, DIFFICULTY.normal.ttl + 0.05);
  assert.equal(s.misses, 1);
});

test('tapping a target pops it; tapping empty space does nothing', () => {
  const s = createState(spec(), mid);
  run(s, 0.4);
  const t = s.targets[0];
  assert.equal(whack(s, 0, 0), false);
  assert.equal(whack(s, t.x, t.y), true);
  assert.equal(s.hits, 1);
  assert.equal(s.targets.length, 0);
});

test('too many misses loses; surviving the clock wins with a bonus', () => {
  const lose = createState(spec(), mid);
  run(lose, 30);
  assert.equal(lose.status, 'lost');
  assert.equal(score(lose), 0);
  const win = createState(spec({ difficulty: 'easy' }), mid);
  for (let t = 0; t < 30; t += 1 / 60) { step(win, 1 / 60); for (const x of win.targets) whack(win, x.x, x.y); }
  assert.equal(win.status, 'won');
  assert.ok(score(win) > win.hits * 100);
});

test('nothing happens once the round is over', () => {
  const s = createState(spec(), mid);
  run(s, 31);
  const hits = s.hits;
  assert.equal(whack(s, 200, 150), false);
  step(s, 1);
  assert.equal(s.hits, hits);
});
