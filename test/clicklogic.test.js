import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec } from '../public/spec.js';
import { createState, tap, step, score, DIFFICULTY } from '../public/clicklogic.js';

const spec = (over = {}) => normalizeSpec({ template: 'click', actors: [{ label: 'A' }], durationSec: 30, ...over });

test('taps on the button count, taps elsewhere do not; reaching the goal wins, the clock loses', () => {
  const s = createState(spec(), () => 0);
  assert.equal(tap(s, 0, 0), false);
  assert.equal(tap(s, s.x, s.y), true);
  assert.equal(s.taps, 1);
  assert.equal(s.pop.actor.label, 'A');
  for (let i = 1; i < DIFFICULTY.normal.goal; i++) tap(s, s.x, s.y);
  assert.equal(s.status, 'won');
  assert.ok(score(s) > DIFFICULTY.normal.goal * 10);
  const l = createState(spec());
  for (let t = 0; t < 31; t += 1 / 60) step(l, 1 / 60);
  assert.equal(l.status, 'lost');
  assert.equal(tap(l, l.x, l.y), false);
});
