// Share-preview card (1200x630 PNG) drawn from a spec: title, subtitle, the actors as emoji or name labels.
// Never faces: share links carry no images. Emoji art: Twemoji (CC-BY 4.0). The renderer is loaded lazily,
// so the server still runs without it (previews then simply have no picture).
import { readFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PALETTES } from './public/spec.js';
import { colorFor, short } from './public/engine.js';

const require = createRequire(import.meta.url);
const FONT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public/fonts/fredoka-700.ttf');
export const CARD_W = 1200, CARD_H = 630;

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

// Twemoji file for an emoji: code points in hex joined by '-', without the FE0F selector unless it is a ZWJ sequence.
let emojiDir;
export function emojiFile(ch) {
  emojiDir ??= path.dirname(require.resolve('@twemoji/svg/1f600.svg'));
  const cps = [...ch].map((c) => c.codePointAt(0).toString(16));
  for (const name of [cps.includes('200d') ? cps : cps.filter((h) => h !== 'fe0f'), cps].map((a) => a.join('-'))) {
    const f = path.join(emojiDir, `${name}.svg`);
    if (/^[0-9a-f-]+$/.test(name) && existsSync(f)) return f;
  }
  return null;
}

const ball = (pal, x, y, r, s, text) => {
  const color = colorFor(pal, text);
  let inner = '';
  const emoji = s.startsWith('emoji:') && emojiFile(s.slice(6));
  if (emoji) {
    inner = `<image href="data:image/svg+xml;base64,${readFileSync(emoji).toString('base64')}" x="${x - r * 0.62}" y="${y - r * 0.62}" width="${r * 1.24}" height="${r * 1.24}"/>`;
  } else {
    const label = short(text);
    const size = Math.min(r * 0.62, (r * 3.2) / Math.max(1, label.length));
    inner = `<text x="${x}" y="${y + size * 0.35}" font-size="${size}" text-anchor="middle" fill="#fff" stroke="${pal.ink}" stroke-width="${size / 5}" paint-order="stroke">${esc(label)}</text>`;
  }
  return `<ellipse cx="${x}" cy="${y + r * 0.95}" rx="${r * 0.8}" ry="${r * 0.25}" fill="rgba(0,0,0,0.18)"/>`
    + `<circle cx="${x}" cy="${y}" r="${r}" fill="${color}" stroke="#fff" stroke-width="${r * 0.12}"/>`
    + `<ellipse cx="${x - r * 0.35}" cy="${y - r * 0.52}" rx="${r * 0.34}" ry="${r * 0.15}" fill="rgba(255,255,255,0.5)" transform="rotate(-28 ${x - r * 0.35} ${y - r * 0.52})"/>`
    + inner;
};

// Title in at most two lines, as large as fits. Fredoka's average glyph is ~0.55 em wide.
export function titleLines(title, maxWidth = 1080) {
  const words = String(title).split(/\s+/).filter(Boolean);
  for (const size of [88, 76, 66, 58, 50, 44]) {
    const perLine = Math.floor(maxWidth / (size * 0.55));
    const lines = [''];
    for (const w of words) {
      const next = lines.at(-1) ? `${lines.at(-1)} ${w}` : w;
      if (next.length <= perLine) lines[lines.length - 1] = next; else lines.push(w);
    }
    if (lines.length <= 2 && lines.every((l) => l.length <= perLine)) return { size, lines };
  }
  const perLine = Math.floor(maxWidth / (44 * 0.55));
  return { size: 44, lines: [String(title).slice(0, perLine - 1) + '…'] };
}

export function cardSvg(spec) {
  const pal = PALETTES[spec.palette] || PALETTES['corporate-blue'];
  const { size, lines } = titleLines(spec.title);
  const top = lines.length === 1 ? 150 : 120;
  const title = lines.map((l, i) => `<text x="600" y="${top + i * size * 1.05}" font-size="${size}" text-anchor="middle" fill="#fff" stroke="${pal.ink}" stroke-width="${size / 6}" paint-order="stroke">${esc(l)}</text>`).join('');
  const subY = top + (lines.length - 1) * size * 1.05 + 62;
  const sub = spec.subtitle.length > 60 ? spec.subtitle.slice(0, 59) + '…' : spec.subtitle;
  const actors = spec.actors.slice(0, 5);
  const r = actors.length > 4 ? 70 : 82, gap = r * 2.5;
  const x0 = 600 - ((actors.length - 1) * gap) / 2;
  const balls = actors.map((a, i) => ball(pal, x0 + i * gap, 395 + (i % 2) * 18, r, a.sprite, a.label)).join('');
  const cta = spec.lang === 'it' ? 'GIOCA ORA' : 'PLAY NOW';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${CARD_W}" height="${CARD_H}" font-family="Fredoka" font-weight="700">
<defs><linearGradient id="bg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${pal.bg0}"/><stop offset="1" stop-color="${pal.bg1}"/></linearGradient></defs>
<rect width="${CARD_W}" height="${CARD_H}" fill="url(#bg)"/>
<g fill="rgba(255,255,255,0.1)"><circle cx="90" cy="120" r="140"/><circle cx="1110" cy="70" r="100"/><circle cx="1130" cy="520" r="170"/><circle cx="230" cy="560" r="100"/></g>
${title}
<text x="600" y="${subY}" font-size="36" text-anchor="middle" fill="#fff" stroke="${pal.ink}" stroke-width="5" paint-order="stroke">${esc(sub)}</text>
${balls}
<rect x="440" y="532" width="320" height="70" rx="35" fill="#2ed58f" stroke="#fff" stroke-width="5"/>
<path d="M486 549 L486 585 L516 567 Z" fill="#fff"/>
<text x="625" y="580" font-size="38" text-anchor="middle" fill="#fff">${cta}</text>
<text x="1176" y="606" font-size="26" text-anchor="end" fill="rgba(255,255,255,0.85)">MeetingBreak</text>
</svg>`;
}

let Resvg;
// PNG bytes, or null when the renderer is not installed.
export async function renderCard(spec) {
  if (Resvg === undefined) Resvg = await import('@resvg/resvg-js').then((m) => m.Resvg).catch(() => null);
  if (!Resvg) return null;
  return new Resvg(cardSvg(spec), { font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: 'Fredoka' } }).render().asPng();
}
