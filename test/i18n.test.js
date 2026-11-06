import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { STRINGS } from '../public/i18n.js';
import { STEPS } from '../public/tour.js';
import { TEMPLATES } from '../public/spec.js';

const dir = new URL('../public/', import.meta.url);
const read = (f) => readFileSync(new URL(f, dir), 'utf8');

test('English and Italian have the same keys, none empty', () => {
  assert.deepEqual(Object.keys(STRINGS.it).sort(), Object.keys(STRINGS.en).sort());
  for (const lang of ['en', 'it']) for (const [k, v] of Object.entries(STRINGS[lang])) assert.ok(v.trim(), `${lang} ${k}`);
});

test('placeholders like {n} match between the two languages', () => {
  const vars = (s) => (s.match(/\{\w+\}/g) || []).sort().join();
  for (const k of Object.keys(STRINGS.en)) assert.equal(vars(STRINGS.it[k]), vars(STRINGS.en[k]), k);
});

test('every key the page and the scripts use exists', () => {
  const used = new Set();
  for (const m of read('index.html').matchAll(/data-i18n(?:-html|-placeholder|-aria)?="([\w.]+)"/g)) used.add(m[1]);
  for (const f of readdirSync(dir).filter((n) => n.endsWith('.js'))) for (const m of read(f).matchAll(/\bt\('([\w.]+)'/g)) used.add(m[1]);
  assert.ok(used.size > 60, `only ${used.size} keys found`);
  for (const k of used) assert.ok(k in STRINGS.en, k);
});

test('every template has its rules and every tour step its texts, in both languages', () => {
  for (const lang of ['en', 'it']) {
    for (const g of TEMPLATES) assert.ok(STRINGS[lang][`controls.${g}`]?.length > 20, `${lang} controls.${g}`);
    for (const s of STEPS) for (const part of ['title', 'text']) assert.ok(STRINGS[lang][`tour.${s.key}.${part}`], `${lang} tour.${s.key}.${part}`);
  }
});

test('every tour step points at an element in index.html', () => {
  const html = read('index.html');
  for (const s of STEPS) assert.ok(html.includes(`id="${s.target}"`), s.target);
});
