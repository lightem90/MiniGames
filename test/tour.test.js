import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { CONTROLS, STEPS } from '../public/tour.js';
import { TEMPLATES } from '../public/spec.js';

test('every template has a controls text', () => {
  assert.deepEqual(Object.keys(CONTROLS), TEMPLATES);
  for (const t of TEMPLATES) assert.ok(CONTROLS[t].length > 20, t);
});

test('every tour step points at an element in index.html', () => {
  const html = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  for (const s of STEPS) {
    assert.ok(html.includes(`id="${s.target}"`), s.target);
    assert.ok(['setup', 'play'].includes(s.screen), s.target);
    assert.ok((typeof s.text === 'function' ? s.text('sink') : s.text).length > 20, s.target);
  }
});
