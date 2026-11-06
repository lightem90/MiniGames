// Static files, POST /spec, shared-game pages with link previews (/g, /og.png) and POST /event.
// No database, no stored input: logs keep only template, source, latency and event names (GDD §9, §11).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSpec } from './llm.js';
import { decodeSpec } from './public/spec.js';
import { renderCard, CARD_W, CARD_H } from './og.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.json': 'application/json', '.png': 'image/png', '.ttf': 'font/ttf' };
const MAX_BODY = 8 * 1024;
const SHARE = /^[A-Za-z0-9_-]{1,6000}$/; // a share-link spec is base64url, ~1-2 KB; anything else is not ours
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const LIMIT = 20; // requests per IP per minute
// shortcut: in-memory limiter, per process only; use the edge platform's limiter when deployed
const hits = new Map(), shareHits = new Map();

function limited(ip, map = hits) {
  const now = Date.now();
  const recent = (map.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  map.set(ip, recent);
  return recent.length > LIMIT;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on('data', (c) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); }
      else chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString()));
    req.on('error', reject);
  });
}

// Absolute site URL for preview tags: PUBLIC_URL when set, else what the request says (validated, then escaped on output).
function origin(req) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').split(',')[0].trim();
  const proto = String(req.headers['x-forwarded-proto'] || 'http').split(',')[0].trim();
  return `${proto === 'https' ? 'https' : 'http'}://${/^[\w.-]+(:\d+)?$/.test(host) ? host : 'localhost'}`;
}

// index.html with link-preview tags for one game. Slack, Teams, WhatsApp and LinkedIn read these;
// they never see a #fragment, which is why shared links are /g?s=... (GDD §7).
export function sharePage(html, spec, base, s) {
  const names = spec.actors.slice(0, 5).map((a) => a.label).join(', ');
  const desc = spec.lang === 'it' ? `${spec.subtitle}. Con ${names}. Un gioco di 60 secondi.` : `${spec.subtitle}. Starring ${names}. A 60-second game.`;
  const meta = [
    ['og:type', 'website'], ['og:site_name', 'MeetingBreak'], ['og:title', spec.title], ['og:description', desc],
    ['og:url', `${base}/g?s=${s}`], ['og:image', `${base}/og.png?s=${s}`], ['og:image:width', CARD_W], ['og:image:height', CARD_H], ['og:image:alt', spec.title],
  ].map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`);
  meta.push('<meta name="twitter:card" content="summary_large_image">', `<meta name="description" content="${esc(desc)}">`);
  return html.replace('<title>MeetingBreak</title>', `<title>${esc(spec.title)} · MeetingBreak</title>\n${meta.join('\n')}`);
}

export function createServer(opts = {}) {
  const llm = {
    apiKey: process.env.LLM_API_KEY,
    baseUrl: process.env.LLM_BASE_URL || undefined,
    model: process.env.LLM_MODEL || undefined,
    ...opts,
  };
  return http.createServer(async (req, res) => {
    const send = (code, body, type = 'application/json') => {
      res.writeHead(code, { 'content-type': type });
      res.end(typeof body === 'string' || Buffer.isBuffer(body) ? body : JSON.stringify(body));
    };
    try {
      const url = new URL(req.url, 'http://x');
      if (req.method === 'POST' && url.pathname === '/spec') {
        if (limited(req.socket.remoteAddress)) return send(429, { error: 'slow down' });
        let body;
        try { body = JSON.parse(await readBody(req)); } catch { return send(400, { error: 'bad request' }); }
        const t0 = Date.now();
        const { spec, source } = await generateSpec(body?.text, body?.imageCount, { ...llm, player: body?.player, previous: body?.previous, lang: body?.lang });
        const via = body?.via === 'share' ? 'share' : undefined; // a game made by someone who arrived from a shared link: the K-factor numerator
        console.log(JSON.stringify({ template: spec.template, source, via, ms: Date.now() - t0 }));
        return send(200, { spec, source });
      }
      if (req.method === 'POST' && url.pathname === '/event') {
        if (limited(req.socket.remoteAddress, shareHits)) return send(429, { error: 'slow down' });
        let body;
        try { body = JSON.parse(await readBody(req)); } catch { return send(400, { error: 'bad request' }); }
        if (body?.type !== 'share') return send(400, { error: 'unknown event' });
        console.log(JSON.stringify({ event: 'share' })); // the K-factor denominator; nothing about who or what
        res.writeHead(204); return res.end();
      }
      if (req.method === 'GET' && (url.pathname === '/g' || url.pathname === '/og.png')) {
        const s = url.searchParams.get('s') || '';
        const spec = SHARE.test(s) ? decodeSpec(s) : null;
        if (url.pathname === '/og.png') {
          if (!spec) return send(400, 'bad game', 'text/plain');
          // shortcut: no rate limit here (chat crawlers share IPs); put a CDN in front if previews get heavy traffic
          const png = await renderCard(spec);
          if (!png) return send(404, 'no preview renderer installed', 'text/plain');
          // the picture depends only on s, so any cache may keep it
          res.writeHead(200, { 'content-type': 'image/png', 'cache-control': 'public, max-age=604800, immutable' });
          return res.end(png);
        }
        const html = await readFile(path.join(PUBLIC, 'index.html'), 'utf8');
        console.log(JSON.stringify({ event: 'open', valid: !!spec }));
        return send(200, spec ? sharePage(html, spec, origin(req), s) : html, 'text/html');
      }
      if (req.method === 'GET' && url.pathname === '/config') {
        // OAuth client IDs are public by design; the secrets stay with Google/Microsoft.
        return send(200, { googleClientId: process.env.GOOGLE_CLIENT_ID || '', msClientId: process.env.MS_CLIENT_ID || '' });
      }
      if (req.method === 'GET') {
        const file = url.pathname === '/' ? 'index.html' : url.pathname.slice(1);
        const full = path.join(PUBLIC, file);
        if (!full.startsWith(PUBLIC + path.sep)) return send(403, 'forbidden', 'text/plain'); // path traversal
        const data = await readFile(full).catch(() => null);
        if (!data) return send(404, 'not found', 'text/plain');
        return send(200, data, TYPES[path.extname(full)] || 'application/octet-stream');
      }
      send(405, 'method not allowed', 'text/plain');
    } catch {
      send(500, { error: 'server error' });
    }
  });
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 8080;
  createServer().listen(port, () => console.log(`MeetingBreak on :${port} (${process.env.LLM_API_KEY ? 'LLM on' : 'no LLM_API_KEY: fallback specs'})`));
}
