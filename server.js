// Static files + POST /spec. No database, no stored input: logs keep only source and latency (GDD §9).
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSpec } from './llm.js';

const PUBLIC = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css' };
const MAX_BODY = 8 * 1024;
const LIMIT = 20; // requests per IP per minute
// shortcut: in-memory limiter, per process only; use the edge platform's limiter when deployed
const hits = new Map();

function limited(ip) {
  const now = Date.now();
  const recent = (hits.get(ip) || []).filter((t) => now - t < 60_000);
  recent.push(now);
  hits.set(ip, recent);
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
        const { spec, source } = await generateSpec(body?.text, body?.imageCount, llm);
        console.log(JSON.stringify({ template: spec.template, source, ms: Date.now() - t0 }));
        return send(200, { spec, source });
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
