import { test } from 'node:test';
import assert from 'node:assert/strict';
import { emojiFile, titleLines, cardSvg } from '../og.js';
import { normalizeSpec } from '../public/spec.js';

let hasTwemoji = true;
try { emojiFile('🙄'); } catch { hasTwemoji = false; }

test('emoji map to Twemoji files, with or without the FE0F selector', { skip: !hasTwemoji && 'twemoji not installed' }, () => {
  assert.ok(emojiFile('🙄').endsWith('1f644.svg'));
  assert.ok(emojiFile('☕').endsWith('2615.svg'));
  assert.ok(emojiFile('🗑️')); // 1f5d1 + fe0f
  assert.equal(emojiFile('x'), null);
});

test('titles fit in two lines, getting smaller as they grow', () => {
  assert.deepEqual(titleLines('Budget review'), { size: 88, lines: ['Budget review'] });
  const long = titleLines('Quarterly alignment of the regional budget with all the stakeholders');
  assert.ok(long.lines.length <= 2 && long.size < 88);
  for (const l of long.lines) assert.ok(l.length * long.size * 0.55 <= 1080, l);
});

test('the card never carries an uploaded face and escapes every label', { skip: !hasTwemoji && 'twemoji not installed' }, () => {
  const svg = cardSvg(normalizeSpec({ title: "Tom's <sync>", actors: [{ label: 'Marco', sprite: 'img:0' }, { label: "O'Neil", sprite: 'text' }, { label: 'x', sprite: 'emoji:🙄' }] }));
  assert.ok(!svg.includes('<sync>') && !svg.includes("O'Neil"));
  assert.ok(svg.includes('Marco')); // a face becomes its name label
  assert.ok(svg.includes('data:image/svg+xml;base64,')); // the emoji
  assert.ok(!svg.includes('data:image/png')); // never a picture of a person
});
