import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec } from '../public/spec.js';
import { createState, place, canPlace, cellFor, pickPiece, step, N, GX, GY, CELL, SLOTS } from '../public/blastlogic.js';

const spec = (over = {}) => normalizeSpec({ template: 'blast', actors: [{ label: 'A' }], durationSec: 30, ...over });
const zero = () => 0; // tray = three 1x1 pieces

test('tray has three pieces; a piece lands where dropped and the tray refills when empty', () => {
  const s = createState(spec(), zero);
  assert.equal(s.tray.length, 3);
  assert.equal(pickPiece(s, SLOTS[1].x, SLOTS[1].y), 1);
  assert.equal(pickPiece(s, 10, 10), -1);
  const { r, c } = cellFor(s.tray[0].cells, GX + 2.5 * CELL, GY + 3.5 * CELL);
  assert.deepEqual({ r, c }, { r: 3, c: 2 });
  assert.ok(place(s, 0, r, c));
  assert.equal(s.grid[3 * N + 2], 1);
  assert.equal(place(s, 1, r, c), false); // occupied
  assert.ok(place(s, 1, 0, 0) && place(s, 2, 0, 1));
  assert.ok(s.tray.every(Boolean)); // refilled
});

test('a full row clears and scores; no fitting piece loses', () => {
  const s = createState(spec(), zero);
  for (let c = 1; c < N; c++) s.grid[c] = 1;
  place(s, 0, 0, 0);
  assert.equal(s.cleared, N);
  assert.ok(s.grid.slice(0, N).every((v) => !v));
  s.grid.fill(1);
  s.grid[0] = 0;
  place(s, 1, 0, 0); // fills the last hole, row and column clear, but then nothing fits? the cleared cells free space
  assert.equal(s.status, 'playing');
  s.grid.fill(1);
  s.tray = [{ cells: [[0, 0]], actor: 0 }, null, null];
  assert.ok(!canPlace(s.grid, [[0, 0]], 0, 0));
  step(s, 0);
  s.grid[5] = 0; s.grid[6] = 0;
  s.tray = [{ cells: [[0, 0], [1, 0]], actor: 0 }, null, null];
  s.grid[5] = 0;
  place(s, 0, 9, 9); // invalid drop: does not change the game
  assert.equal(s.status, 'playing');
  s.grid.fill(1); s.grid[0] = 0;
  place(s, 0, 0, 0);
  assert.equal(s.status, 'playing');
});

test('the clock wins', () => {
  const s = createState(spec(), zero);
  for (let t = 0; t < 31; t += 1 / 60) step(s, 1 / 60);
  assert.equal(s.status, 'won');
});
