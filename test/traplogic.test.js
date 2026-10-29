import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec } from '../public/spec.js';
import { createState, block, cellAt, center, key, step, ROWS, COLS } from '../public/traplogic.js';

const spec = (over = {}) => normalizeSpec({ template: 'trap', actors: [{ label: 'Cat' }], durationSec: 30, ...over });
const none = () => 0.99; // pre-blocks only the far corner

test('the cat starts in the middle and walks to the edge when nothing stops it', () => {
  const s = createState(spec(), none);
  assert.deepEqual(s.cat, { r: 4, c: 5 });
  assert.deepEqual(cellAt(center(2, 3).x, center(2, 3).y), { r: 2, c: 3 });
  assert.equal(cellAt(-50, -50), null);
  let taps = 0;
  while (s.status === 'playing' && taps < 10) { block(s, ROWS - 1, taps++); } // tap along the bottom row, away from the cat
  assert.equal(s.status, 'lost');
  assert.ok(taps <= 5);
});

test('a surrounded cat is a win; blocked or taken cells cannot be tapped', () => {
  const s = createState(spec(), none);
  for (const [r, c] of [[4, 4], [4, 6], [3, 4], [3, 5], [5, 4]]) s.blocked.add(key(r, c));
  assert.equal(block(s, 4, 5), false); // the cat's own cell
  assert.equal(block(s, 4, 4), false); // already blocked
  assert.equal(block(s, 5, 5), true);
  assert.equal(s.status, 'won');
  assert.equal(s.moves, 1);
  assert.ok(COLS > ROWS);
});

test('the clock loses', () => {
  const s = createState(spec());
  for (let t = 0; t < 31; t += 1 / 60) step(s, 1 / 60);
  assert.equal(s.status, 'lost');
});
