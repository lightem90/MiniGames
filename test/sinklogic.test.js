import { test } from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSpec } from '../public/spec.js';
import { createState, pickBall, flick, step, score, W, H } from '../public/sinklogic.js';
import { endMessage } from '../public/engine.js';

const spec = (over = {}) => normalizeSpec({ actors: [{ label: 'A' }, { label: 'B' }], durationSec: 30, ...over });
const mid = () => 0.5;

function run(state, seconds) {
  for (let t = 0; t < seconds; t += 1 / 60) step(state, 1 / 60);
}

test('createState: one ball per actor, all inside the arena', () => {
  const s = createState(spec({ actors: Array.from({ length: 8 }, () => ({ label: 'x' })) }), mid);
  assert.equal(s.balls.length, 8);
  for (const b of s.balls) {
    assert.ok(b.x >= b.r && b.x <= W - b.r);
    assert.ok(b.y >= b.r && b.y <= H - b.r);
  }
});

test('difficulty changes the hole size', () => {
  const r = (d) => createState(spec({ difficulty: d }), mid).hole.r;
  assert.ok(r('easy') > r('normal') && r('normal') > r('hard'));
});

test('a ball dropped on the hole sinks', () => {
  const s = createState(spec(), mid);
  Object.assign(s.balls[0], { x: s.hole.x, y: s.hole.y });
  step(s, 1 / 60);
  assert.ok(s.balls[0].sunk);
  assert.equal(s.sunk, 1);
});

test('a ball that is too fast skips over the hole', () => {
  const s = createState(spec(), mid);
  Object.assign(s.balls[0], { x: s.hole.x, y: s.hole.y, vx: 800, vy: 0 });
  step(s, 1 / 600);
  assert.ok(!s.balls[0].sunk);
});

test('friction stops a flicked ball', () => {
  const s = createState(spec(), mid);
  flick(s, 0, 0, -300);
  run(s, 6);
  assert.equal(s.balls[0].vx, 0);
  assert.equal(s.balls[0].vy, 0);
});

test('flick speed is capped', () => {
  const s = createState(spec(), mid);
  flick(s, 0, 0, -1e6);
  assert.ok(Math.hypot(s.balls[0].vx, s.balls[0].vy) <= 900.001);
});

test('balls bounce off the walls and never leave the arena', () => {
  const s = createState(spec(), mid);
  flick(s, 0, 900, 900);
  for (let i = 0; i < 600; i++) {
    step(s, 1 / 60);
    const b = s.balls[0];
    if (b.sunk) break;
    assert.ok(b.x >= 0 && b.x <= W && b.y >= 0 && b.y <= H);
  }
});

test('pickBall finds a ball under the pointer, ignores empty space and sunk balls', () => {
  const s = createState(spec(), mid);
  const b = s.balls[1];
  assert.equal(pickBall(s, b.x, b.y), 1);
  assert.equal(pickBall(s, -500, -500), -1);
  b.sunk = true;
  assert.equal(pickBall(s, b.x, b.y), -1);
});

test('sinking every ball wins; score includes the time bonus', () => {
  const s = createState(spec(), mid);
  for (const b of s.balls) Object.assign(b, { x: s.hole.x, y: s.hole.y });
  step(s, 1 / 60);
  assert.equal(s.status, 'won');
  assert.equal(score(s), 2 * 100 + Math.ceil(s.timeLeft) * 10);
});

test('running out of time loses; no time bonus', () => {
  const s = createState(spec(), mid);
  run(s, 31);
  assert.equal(s.status, 'lost');
  assert.equal(score(s), 0);
});

test('end message matches the outcome', () => {
  const sp = spec({ messages: { win: 'You are free', lose: 'Offline' } });
  const s = createState(sp, mid);
  run(s, 31);
  assert.equal(endMessage(sp, s), 'Offline');
  const w = createState(sp, mid);
  for (const b of w.balls) Object.assign(b, { x: w.hole.x, y: w.hole.y });
  step(w, 1 / 60);
  assert.equal(endMessage(sp, w), 'You are free');
});

test('nothing moves once the round is over', () => {
  const s = createState(spec(), mid);
  run(s, 31);
  const before = JSON.stringify(s);
  step(s, 1);
  flick(s, 0, 100, 100);
  assert.equal(JSON.stringify(s), before);
});

test('hard mode: the hole drifts and stays in the arena', () => {
  const s = createState(spec({ difficulty: 'hard', durationSec: 90 }), mid);
  const x0 = s.hole.x;
  run(s, 3);
  assert.notEqual(s.hole.x, x0);
  run(s, 60);
  assert.ok(s.hole.x >= s.hole.r && s.hole.x <= W - s.hole.r);
});
