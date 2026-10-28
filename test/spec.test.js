import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec, fallbackSpec, encodeSpec, decodeSpec, cleanSprite, MAX_ACTORS } from '../public/spec.js';

const GDD_EXAMPLE = {
  version: 1, template: 'sink', title: 'Q4 Budget Alignment Survival', subtitle: 'Sink every stakeholder before the sync ends',
  difficulty: 'normal', durationSec: 60, palette: 'corporate-blue',
  actors: [
    { label: 'Marco', role: 'enemy', sprite: 'img:0' },
    { label: 'Giulia', role: 'enemy', sprite: 'emoji:🙄' },
    { label: 'Action Items', role: 'enemy', sprite: 'text' },
  ],
  goal: { label: 'Trash', sprite: 'emoji:🗑️' },
  messages: { start: 'The meeting could have been an email.', win: "Meeting adjourned. You're free.", lose: "Let's take this offline." },
};

test('the GDD example spec passes through unchanged', () => {
  assert.deepEqual(normalizeSpec(GDD_EXAMPLE), GDD_EXAMPLE);
});

test('garbage input gives a playable default spec', () => {
  for (const bad of [null, undefined, 42, 'x', [], {}]) {
    const s = normalizeSpec(bad);
    assert.equal(s.template, 'sink');
    assert.ok(s.actors.length >= 1);
    assert.equal(s.durationSec, 60);
  }
});

test('unknown template falls back to sink, bad enums to defaults', () => {
  const s = normalizeSpec({ template: 'whack', difficulty: 'insane', palette: 'neon', __proto__: { x: 1 } });
  assert.equal(s.template, 'sink');
  assert.equal(s.difficulty, 'normal');
  assert.equal(s.palette, 'corporate-blue');
});

test('palette lookup cannot be tricked with inherited keys', () => {
  assert.equal(normalizeSpec({ palette: 'constructor' }).palette, 'corporate-blue');
});

test('duration is clamped to 30..90', () => {
  assert.equal(normalizeSpec({ durationSec: 5 }).durationSec, 30);
  assert.equal(normalizeSpec({ durationSec: 9999 }).durationSec, 90);
  assert.equal(normalizeSpec({ durationSec: 'abc' }).durationSec, 60);
});

test('more than 8 actors: extras are dropped', () => {
  const actors = Array.from({ length: 12 }, (_, i) => ({ label: 'P' + i }));
  const s = normalizeSpec({ actors });
  assert.equal(s.actors.length, MAX_ACTORS);
  assert.equal(s.actors.at(-1).label, 'P7');
});

test('strings are stripped of HTML, capped, and rude words masked', () => {
  const s = normalizeSpec({
    title: '<img src=x onerror=alert(1)>' + 'a'.repeat(200),
    actors: [{ label: 'Marco is a stronzo' }],
  });
  assert.ok(!/[<>]/.test(s.title));
  assert.ok(s.title.length <= 60);
  assert.equal(s.actors[0].label, 'Marco is a ???');
});

test('sprite validation', () => {
  assert.equal(cleanSprite('img:3'), 'img:3');
  assert.equal(cleanSprite('emoji:🙄'), 'emoji:🙄');
  assert.equal(cleanSprite('emoji:abc'), 'text');
  assert.equal(cleanSprite('img:../../etc'), 'text');
  assert.equal(cleanSprite('http://evil/x.png'), 'text');
  assert.equal(cleanSprite(5), 'text');
});

test('fallbackSpec picks capitalised words as actors and the first line as title', () => {
  const s = fallbackSpec('Budget review\nMarco talks, Giulia nods');
  assert.equal(s.title, 'Budget review');
  assert.deepEqual(s.actors.map((a) => a.label), ['Marco', 'Giulia']);
});

test('fallbackSpec on empty text still returns a valid spec', () => {
  const s = fallbackSpec('');
  assert.ok(s.actors.length >= 1);
  assert.equal(s.title, 'Meeting Survival');
});

test('share link round-trips, including unicode', () => {
  const s = normalizeSpec({ ...GDD_EXAMPLE, title: 'Riunione città ☕' });
  assert.equal(decodeSpec(encodeSpec(s)).title, 'Riunione città ☕');
});

test('share link never carries image references (privacy)', () => {
  const out = decodeSpec(encodeSpec(GDD_EXAMPLE));
  assert.equal(out.actors[0].sprite, 'text');
  assert.equal(out.actors[1].sprite, 'emoji:🙄');
});

test('share link is URL-fragment safe', () => {
  assert.match(encodeSpec(GDD_EXAMPLE), /^[A-Za-z0-9_-]+$/);
});

test('decodeSpec returns null on garbage and re-validates tampered links', () => {
  assert.equal(decodeSpec('%%%not-base64'), null);
  const evil = btoa(JSON.stringify({ title: '<script>', durationSec: 1e9 })).replace(/=+$/, '');
  const s = decodeSpec(evil);
  assert.ok(!s.title.includes('<'));
  assert.equal(s.durationSec, 90);
});
