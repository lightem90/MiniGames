import { test } from 'node:test';
import assert from 'node:assert/strict';
import { short } from '../public/engine.js';

test('short labels stay, long ones become initials', () => {
  assert.equal(short('Marco'), 'Marco');
  assert.equal(short('Veryverylongname Surnamesuperlong'), 'VS');
  assert.equal(short('Anna Maria De Luca'), 'AMD');
  assert.equal(short('Actionitems'), 'A');
});
