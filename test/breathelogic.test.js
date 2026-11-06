import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createState, step, phase, stop, R_MIN, R_MAX } from '../public/breathelogic.js';

const run = (s, sec) => { for (let t = 0; t < sec - 1e-9; t += 0.05) step(s, 0.05); }; // engine-sized steps

test('4 s in, 2 s hold, 6 s out, three cycles, then done', () => {
  const s = createState();
  assert.equal(phase(s).name, 'in');
  run(s, 4.01); assert.equal(phase(s).name, 'hold'); assert.equal(phase(s).r, R_MAX);
  run(s, 2); assert.equal(phase(s).name, 'out');
  run(s, 6); assert.equal(phase(s).name, 'in'); // second cycle
  run(s, 24); assert.equal(phase(s).name, 'done');
  assert.equal(s.status, 'playing'); // 2 s rest before going back
  run(s, 2.05); assert.equal(s.status, 'won');
});

test('the radius never leaves [40, 110]', () => {
  const s = createState();
  for (let i = 0; i < 800; i++) { step(s, 0.05); const { r } = phase(s); assert.ok(r >= R_MIN - 1e-9 && r <= R_MAX + 1e-9, String(r)); }
});

test('a tap stops it at once', () => {
  const s = createState();
  run(s, 3);
  stop(s);
  assert.equal(s.status, 'won');
});

test('no medical claims anywhere in the UI', () => {
  const dir = new URL('../public/', import.meta.url);
  for (const f of readdirSync(dir).filter((n) => /\.(html|js|json)$/.test(n))) {
    assert.doesNotMatch(readFileSync(new URL(f, dir), 'utf8'), /anxiety|therapy|therapeutic|stress relief/i, f);
  }
});
