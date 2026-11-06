import { test } from 'node:test';
import assert from 'node:assert/strict';
import { short, colorFor } from '../public/engine.js';

test('short labels stay, long ones become initials', () => {
  assert.equal(short('Marco'), 'Marco');
  assert.equal(short('Veryverylongname Surnamesuperlong'), 'VS');
  assert.equal(short('Anna Maria De Luca'), 'AMD');
  assert.equal(short('Actionitems'), 'A');
});

import { PALETTES } from '../public/spec.js';

test('colorFor spreads names over the palette and is stable', () => {
  const names = ['Marco', 'Giulia', 'Slide', 'Paolo Bianchi', 'Reply All', 'Luca', 'Anna', 'Sara', 'Matteo', 'Francesca', 'Andrea', 'Chiara',
    'Alessandro', 'Elena', 'Davide', 'Valentina', 'Budget', 'Action Items', 'Slides', 'Gantt chart', 'Lorenzo', 'Martina', 'Simone', 'Federica'];
  const pal = PALETTES['corporate-blue'];
  const count = new Map();
  for (const n of names) count.set(colorFor(pal, n), (count.get(colorFor(pal, n)) || 0) + 1);
  assert.equal(count.size, pal.colors.length, 'every colour used');
  assert.ok(Math.max(...count.values()) <= 8, `one colour took ${Math.max(...count.values())} of ${names.length} names`);
  assert.equal(colorFor(pal, 'Marco'), colorFor(pal, 'Marco'));
});
