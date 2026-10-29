import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec } from '../public/spec.js';
import { createState, place, step, score, turretsAllowed, LANES } from '../public/defendlogic.js';
import { W } from '../public/engine.js';

const spec = (over = {}) => normalizeSpec({ template: 'defend', actors: [{ label: 'A' }], durationSec: 30, ...over });
const mid = () => 0.5;
const run = (s, sec) => { for (let t = 0; t < sec; t += 1 / 60) step(s, 1 / 60); };

test('placing turrets: budget, arena bounds and no stacking', () => {
  const s = createState(spec(), mid);
  assert.equal(place(s, 100, 150), true);
  assert.equal(place(s, 105, 152), false); // on top of the first
  assert.equal(place(s, 100, 10), false); // under the HUD
  assert.equal(place(s, -5, 150), false);
  for (let i = 0; i < 10; i++) place(s, 40 + i * 35, 100);
  assert.equal(s.turrets.length, turretsAllowed(s));
});

test('an undefended enemy walks across and leaks; enough leaks lose the round', () => {
  const s = createState(spec(), mid);
  run(s, 1);
  assert.equal(s.enemies.length, 1);
  assert.equal(s.enemies[0].y, LANES[1]);
  run(s, 29);
  assert.ok(s.leaks >= s.maxLeaks);
  assert.equal(s.status, 'lost');
});

test('a turret in range shoots the enemy dead; kills earn turrets', () => {
  const s = createState(spec({ difficulty: 'easy' }), mid);
  place(s, 60, LANES[1]);
  run(s, 30);
  assert.ok(s.kills > 0, 'turret killed something');
  assert.equal(s.leaks, 0);
  assert.equal(s.status, 'won');
  assert.ok(turretsAllowed(s) > s.baseTurrets);
  assert.equal(score(s), s.kills * 50 + s.maxLeaks * 100);
  assert.ok(s.enemies.every((e) => e.x <= W + 16));
});

test('turrets prefer the enemy closest to leaking', () => {
  const s = createState(spec(), mid);
  s.enemies.push({ x: 100, y: 150, r: 16, hp: 9, maxHp: 9, speed: 0 }, { x: 140, y: 150, r: 16, hp: 9, maxHp: 9, speed: 0 });
  place(s, 120, 150);
  step(s, 1 / 60);
  assert.equal(s.enemies[1].hp, 8);
  assert.equal(s.enemies[0].hp, 9);
});
