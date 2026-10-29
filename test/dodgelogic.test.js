import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec } from '../public/spec.js';
import { createState, moveTo, step, score } from '../public/dodgelogic.js';
import { W, H } from '../public/engine.js';

const spec = (over = {}) => normalizeSpec({ template: 'dodge', actors: [{ label: 'A' }], durationSec: 30, ...over });
const mid = () => 0.5;
const run = (s, sec) => { for (let t = 0; t < sec; t += 1 / 60) step(s, 1 / 60); };

test('player stays inside the arena', () => {
  const s = createState(spec(), mid);
  moveTo(s, -50); assert.equal(s.player.x, s.player.r);
  moveTo(s, 9999); assert.equal(s.player.x, W - s.player.r);
});

test('items fall; one that passes the player counts as dodged', () => {
  const s = createState(spec(), mid);
  moveTo(s, 20); // rng=0.5 spawns items at the centre, so the player is out of the way
  run(s, 0.6);
  assert.equal(s.items.length, 1);
  assert.ok(s.items[0].y > -20);
  run(s, 4);
  assert.ok(s.dodged >= 1);
  assert.equal(s.lives, 3);
});

test('getting hit costs a life; no lives left loses', () => {
  const s = createState(spec({ difficulty: 'hard' }), mid);
  moveTo(s, W / 2); // right under the centre spawn
  run(s, 30);
  assert.equal(s.status, 'lost');
  assert.equal(s.lives, 0);
  assert.equal(score(s), s.dodged * 10);
});

test('surviving the clock wins with a life bonus', () => {
  const s = createState(spec(), mid);
  moveTo(s, 20);
  run(s, 31);
  assert.equal(s.status, 'won');
  assert.equal(score(s), s.dodged * 10 + 300);
  assert.ok(s.items.every((i) => i.y < H + 50));
});
