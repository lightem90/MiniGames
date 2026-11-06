import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { pickNews } from '../public/news.js';

const list = JSON.parse(readFileSync(new URL('../public/good-news.json', import.meta.url), 'utf8'));

test('every good-news entry follows the content rules (SPEC-relief 3.2)', () => {
  assert.ok(Array.isArray(list));
  const year = new Date().getFullYear();
  for (const e of list) {
    assert.ok(typeof e.text === 'string' && e.text.length > 0 && e.text.length <= 160, e.text);
    assert.ok(typeof e.source === 'string' && e.source.trim(), e.text);
    assert.match(e.url, /^https:\/\//, e.text);
    assert.ok(Number.isInteger(e.year) && e.year >= 1990 && e.year <= year, e.text);
    assert.doesNotMatch(e.text, /!|\byou(r)?\b|https?:/i, e.text);
  }
  assert.equal(new Set(list.map((e) => e.text)).size, list.length, 'duplicate text');
});

test('pickNews never repeats the last entry and handles tiny lists', () => {
  const l = [1, 2, 3];
  for (const r of [0, 0.34, 0.5, 0.99]) for (let last = 0; last < 3; last++) assert.notEqual(pickNews(l, last, () => r), last);
  assert.equal(pickNews([], 0), -1);
  assert.equal(pickNews([1], 0), 0);
  assert.equal(pickNews(l, -1, () => 0.99), 2);
});
