// Checks every game is wired in the same way (CONTRIBUTING.md). A failure names the game and the missing step.
// The rules text in English and Italian is checked in i18n.test.js.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { TEMPLATES, TEMPLATE_DEFAULTS, LANGS, normalizeSpec } from '../public/spec.js';

const read = (p) => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const has = (p) => existsSync(new URL('../' + p, import.meta.url));
const app = read('public/app.js'), llm = read('llm.js'), readme = read('README.md');
// What a game may not do: talk to the network or store anything (faces and names stay in the browser, for one round).
const FORBIDDEN = /\bfetch\s*\(|XMLHttpRequest|WebSocket|sendBeacon|localStorage|sessionStorage|indexedDB|document\.cookie|https?:\/\/|\beval\s*\(|new Function/;

test('no runtime dependencies', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.deepEqual(Object.keys({ ...pkg.dependencies, ...pkg.devDependencies }), [], 'the project has no dependencies: write it with the browser and Node only');
});

for (const t of TEMPLATES) {
  test(`game "${t}" is complete`, async () => {
    assert.match(t, /^[a-z]{2,12}$/, 'game name: one lowercase word, 2-12 letters');
    for (const f of [`public/${t}.js`, `public/${t}logic.js`, `test/${t}logic.test.js`]) assert.ok(has(f), `missing file ${f}`);
    assert.match(read(`public/${t}.js`), /export function init\(/, `public/${t}.js must export init(canvas, params)`);
    for (const f of [`public/${t}.js`, `public/${t}logic.js`]) assert.doesNotMatch(read(f), FORBIDDEN, `${f}: no network, storage or eval`);

    const logic = await import(`../public/${t}logic.js`); // importing in Node proves the logic needs no DOM
    for (const fn of ['createState', 'step', 'score']) assert.equal(typeof logic[fn], 'function', `${t}logic.js must export ${fn}`);
    const s = logic.createState(normalizeSpec({ template: t, durationSec: 30 }), () => 0.5);
    for (let i = 0; i < 40 * 60 && s.status === 'playing'; i++) logic.step(s, 1 / 60); // nobody plays: the clock must end the round
    assert.notEqual(s.status, 'playing', `${t}: the round must end (status 'won' or 'lost') when time runs out`);
    assert.ok(Number.isFinite(logic.score(s)), `${t}: score() must return a number`);

    const d = TEMPLATE_DEFAULTS[t];
    assert.ok(/^emoji:/.test(d?.sprite) && LANGS.every((l) => d[l]?.subtitle && d[l]?.goal), `add "${t}" to TEMPLATE_DEFAULTS in public/spec.js (sprite, plus subtitle and goal in ${LANGS.join(' and ')})`);
    assert.ok(app.includes(`import * as ${t} from './${t}.js'`) && new RegExp(`GAMES = \\{[^}]*\\b${t}\\b`).test(app), `import ${t} and add it to GAMES in public/app.js`);
    assert.ok(llm.includes(`${t} = `), `describe "${t}" in the Templates line of llm.js`);
    assert.ok(readme.includes(`\`${t}\``), `add "${t}" to the game list in README.md`);
  });
}
