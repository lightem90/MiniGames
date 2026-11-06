import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from '../server.js';
import { generateSpec, redactEmails } from '../llm.js';
import { TEMPLATES } from '../public/spec.js';

let srv, base;
before(async () => {
  srv = createServer({ apiKey: undefined }); // no key: fallback path, no network
  await new Promise((r) => srv.listen(0, '127.0.0.1', r));
  base = `http://127.0.0.1:${srv.address().port}`;
});
after(() => srv.close());

const post = (body) => fetch(base + '/spec', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body) });

test('redactEmails removes addresses but keeps names', () => {
  assert.equal(redactEmails('Marco <marco@corp.it>, giulia.r@x.com ok'), 'Marco <[email]>, [email] ok');
});

test('generateSpec without an API key uses the fallback', async () => {
  const r = await generateSpec('Budget review\nMarco and Giulia', 0, {});
  assert.equal(r.source, 'fallback');
  assert.deepEqual(r.spec.actors.map((a) => a.label), ['Marco', 'Giulia']);
});

test('generateSpec sends no emails to the LLM, mentions image count but sends no image data', async () => {
  let sent;
  const fetchFn = async (_u, init) => {
    sent = JSON.parse(init.body);
    return { ok: true, json: async () => ({ choices: [{ message: { content: '```json\n{"title":"T","actors":[{"label":"Marco"}]}\n```' } }] }) };
  };
  const r = await generateSpec('Marco marco@corp.it', 2, { apiKey: 'k', fetchFn, player: 'Matteo <b>m@x.it' });
  assert.equal(r.source, 'llm');
  assert.equal(r.spec.title, 'T');
  const msg = sent.messages[1].content;
  assert.ok(!msg.includes('@'));
  assert.ok(msg.includes('2 images'));
  assert.ok(msg.includes('the player is Matteo') && !msg.includes('<b>'));
  assert.ok(sent.messages[0].content.includes('defend')); // the prompt knows every template
});

test('generateSpec calls {baseUrl}/chat/completions with a Bearer key (any OpenAI-compatible provider)', async () => {
  let url, headers;
  const fetchFn = async (u, init) => { url = u; headers = init.headers; return { ok: false, status: 500 }; };
  await generateSpec('x', 0, { apiKey: 'secret', baseUrl: 'https://api.deepseek.com/', model: 'm', fetchFn });
  assert.equal(url, 'https://api.deepseek.com/chat/completions');
  assert.equal(headers.authorization, 'Bearer secret');
});

test('generateSpec defaults to Gemini\'s OpenAI-compatible endpoint', async () => {
  let url;
  await generateSpec('x', 0, { apiKey: 'k', fetchFn: async (u) => { url = u; return { ok: false, status: 500 }; } });
  assert.equal(url, 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
});

test('generateSpec: LLM junk, HTTP errors and network errors all fall back', async () => {
  const cases = [
    async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: 'sorry, no JSON here' } }] }) }),
    async () => ({ ok: true, json: async () => ({ choices: [] }) }), // e.g. thinking model ran out of tokens
    async () => ({ ok: false, status: 500 }),
    async () => { throw new Error('network'); },
  ];
  for (const fetchFn of cases) {
    const r = await generateSpec('Marco', 0, { apiKey: 'k', fetchFn });
    assert.equal(r.source, 'fallback');
    assert.ok(r.spec.actors.length >= 1);
  }
});

test('generateSpec: LLM output is validated, not trusted', async () => {
  const fetchFn = async () => ({ ok: true, json: async () => ({ choices: [{ message: { content: '{"template":"evil","title":"<b>x</b>","durationSec":99999}' } }] }) });
  const { spec } = await generateSpec('x', 0, { apiKey: 'k', fetchFn });
  assert.ok(TEMPLATES.includes(spec.template)); // 'evil' is ignored: the server's draw is used
  assert.ok(!spec.title.includes('<'));
  assert.equal(spec.durationSec, 90);
});

test('POST /spec returns a valid spec', async () => {
  const r = await post({ text: 'Budget review. Marco talks too much', imageCount: 0 });
  assert.equal(r.status, 200);
  const j = await r.json();
  assert.equal(j.source, 'fallback');
  assert.ok(TEMPLATES.includes(j.spec.template));
});

test('GET /config exposes only the OAuth client IDs (empty when unset)', async () => {
  const j = await (await fetch(base + '/config')).json();
  assert.deepEqual(Object.keys(j).sort(), ['googleClientId', 'msClientId']);
});

test('POST /spec rejects bad JSON and oversized bodies', async () => {
  assert.equal((await post('{not json')).status, 400);
  const big = await post(JSON.stringify({ text: 'a'.repeat(20_000) })).catch(() => null);
  assert.ok(big === null || big.status === 400); // connection may be cut before the response
});

test('serves the page and the shared modules', async () => {
  const page = await fetch(base + '/');
  assert.equal(page.status, 200);
  assert.match(page.headers.get('content-type'), /text\/html/);
  assert.match(await page.text(), /^<!doctype html>/i); // real bytes, not a JSON-encoded Buffer
  const js = await fetch(base + '/spec.js');
  assert.match(js.headers.get('content-type'), /javascript/);
  assert.match(await js.text(), /export function normalizeSpec/);
});

test('unknown file is 404, path traversal is refused, other methods are 405', async () => {
  assert.equal((await fetch(base + '/nope.html')).status, 404);
  const traversal = await fetch(base + '/%2e%2e/server.js').catch(() => null);
  assert.ok(!traversal || traversal.status === 403 || traversal.status === 404);
  assert.equal((await fetch(base + '/spec', { method: 'PUT' })).status, 405);
});

test('rate limit: the 21st request in a minute gets 429', async () => {
  const codes = [];
  for (let i = 0; i < 25; i++) codes.push((await post({ text: 'x' })).status);
  assert.ok(codes.includes(429));
});

test('generateSpec draws a random template, never the previous one, and the LLM cannot override it', async () => {
  let sent;
  const fetchFn = async (_u, o) => { sent = JSON.parse(o.body); return { ok: true, json: async () => ({ choices: [{ message: { content: '{"template":"sink","title":"x"}' } }] }) }; };
  const { spec } = await generateSpec('Marco', 0, { apiKey: 'k', fetchFn, previous: 'sink', rng: () => 0 });
  const expected = TEMPLATES.filter((t) => t !== 'sink')[0];
  assert.equal(spec.template, expected);
  assert.ok(sent.messages[1].content.includes(`template: ${expected}`));
  for (let i = 0; i < 50; i++) assert.notEqual((await generateSpec('x', 0, { previous: 'drive' })).spec.template, 'drive');
});

test('the prompt asks for a kind lose message and a plain calm line', async () => {
  let sent;
  await generateSpec('x', 0, { apiKey: 'k', fetchFn: async (_u, o) => { sent = JSON.parse(o.body); return { ok: false, status: 500 }; } });
  assert.ok(sent.messages[0].content.includes('never mocks'));
  assert.ok(sent.messages[0].content.includes('messages.calm'));
});

test('the server serves the good-news list as JSON', async () => {
  const r = await fetch(base + '/good-news.json');
  assert.equal(r.status, 200);
  assert.match(r.headers.get('content-type'), /application\/json/);
  assert.ok(Array.isArray(await r.json()));
});

test('generateSpec asks the LLM for the player language and returns a spec in it', async () => {
  let sent;
  const fetchFn = async (_u, o) => { sent = JSON.parse(o.body); return { ok: true, json: async () => ({ choices: [{ message: { content: '{"title":"Revisione"}' } }] }) }; };
  const { spec } = await generateSpec('Marco', 0, { apiKey: 'k', fetchFn, lang: 'it' });
  assert.ok(sent.messages[1].content.includes('language: Italian'));
  assert.equal(spec.lang, 'it');
  assert.equal((await generateSpec('x', 0, { lang: 'it' })).spec.lang, 'it'); // fallback too
  assert.equal((await generateSpec('x', 0, { lang: '<script>' })).spec.lang, 'en');
});
