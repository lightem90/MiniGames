import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createState, setKeys, pointTo, step, score, ROAD_L, ROAD_R, CAR_W } from '../public/drivelogic.js';

const spec = { difficulty: 'normal', durationSec: 60, actors: [{ label: 'Marco', sprite: 'text' }] };
const noSpawn = (s) => { s.spawnIn = 1e9; return s; };

test('WASD moves the car and the road keeps it on the asphalt', () => {
  const s = noSpawn(createState(spec, () => 0.5));
  const x0 = s.car.x, y0 = s.car.y;
  setKeys(s, new Set(['d', 'w']));
  step(s, 0.1);
  assert.ok(s.car.x > x0 && s.car.y < y0);
  for (let i = 0; i < 100; i++) step(s, 0.05);
  assert.equal(s.car.x, ROAD_R - CAR_W / 2);
  setKeys(s, new Set(['arrowleft']));
  for (let i = 0; i < 100; i++) step(s, 0.05);
  assert.equal(s.car.x, ROAD_L + CAR_W / 2);
});

test('gas (up) covers more road than the brake (down)', () => {
  const gas = noSpawn(createState(spec)), brake = noSpawn(createState(spec));
  setKeys(gas, new Set(['w'])); setKeys(brake, new Set(['s']));
  step(gas, 0.1); step(brake, 0.1);
  assert.ok(gas.dist > brake.dist);
});

test('the car drives towards a held pointer and stops there', () => {
  const s = noSpawn(createState(spec));
  pointTo(s, { x: 120, y: 150 });
  for (let i = 0; i < 100; i++) step(s, 0.05);
  assert.ok(Math.abs(s.car.x - 120) < 5 && Math.abs(s.car.y - 150) < 5);
  pointTo(s, null);
  assert.equal(s.target, null);
});

test('a crash costs one life, then the car is briefly invulnerable', () => {
  const s = noSpawn(createState(spec));
  s.obstacles.push({ actor: spec.actors[0], x: s.car.x, y: s.car.y, r: 17 }, { actor: spec.actors[0], x: s.car.x, y: s.car.y, r: 17 });
  step(s, 0.01);
  assert.equal(s.lives, 2);
  assert.equal(s.obstacles.length, 1); // the second one hits during invulnerability: no damage
  assert.ok(s.hurt > 0);
});

test('surviving the clock wins, losing every life loses', () => {
  const s = noSpawn(createState({ ...spec, durationSec: 30 }));
  for (let i = 0; i < 700; i++) step(s, 0.05);
  assert.equal(s.status, 'won');
  assert.ok(score(s) >= s.lives * 100);
  const l = noSpawn(createState(spec));
  l.lives = 1;
  l.obstacles.push({ actor: spec.actors[0], x: l.car.x, y: l.car.y, r: 17 });
  step(l, 0.01);
  assert.equal(l.status, 'lost');
});
