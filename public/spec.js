// GameSpec: the only contract between the LLM and the engine (GDD §6).
// Shared by browser and server. Every input is untrusted: normalizeSpec never throws
// and always returns a playable spec.
import { parseInvite } from './invite.js';

export const TEMPLATES = ['sink', 'whack', 'dodge', 'drive', 'defend', 'merge', 'blast', 'helix', 'hop', 'click', 'trap'];
// What the `goal` slot means per template, and its default when the LLM gives none.
export const TEMPLATE_DEFAULTS = {
  sink: { subtitle: 'Sink everything before the sync ends', goal: 'Trash', sprite: 'emoji:🗑️' },
  whack: { subtitle: 'Mute them before they finish the sentence', goal: 'Mute', sprite: 'emoji:🔇' },
  dodge: { subtitle: 'Dodge the follow-ups until the call ends', goal: 'You', sprite: 'emoji:☕' },
  drive: { subtitle: 'Drive through the agenda, dodge everyone on the road', goal: 'You', sprite: 'emoji:😎' },
  defend: { subtitle: 'Hold the line until the meeting ends', goal: 'Mute', sprite: 'emoji:🔇' },
  merge: { subtitle: 'Merge the attendees until the sync ends', goal: 'Box', sprite: 'emoji:📦' },
  blast: { subtitle: 'Clear the agenda, line by line', goal: 'Grid', sprite: 'emoji:🧱' },
  helix: { subtitle: 'Fall through the gaps, never onto a stakeholder', goal: 'You', sprite: 'emoji:☕' },
  hop: { subtitle: 'Cross the roadmap without getting run over', goal: 'You', sprite: 'emoji:☕' },
  click: { subtitle: 'Mute as fast as you can', goal: 'Mute', sprite: 'emoji:🔇' },
  trap: { subtitle: 'Corner them before they escape the call', goal: 'Block', sprite: 'emoji:🚧' },
};
export const DIFFICULTIES = ['easy', 'normal', 'hard'];
// Bright, hyper-casual palettes: bg0 -> bg1 sky gradient, ink = text outline, colors = one per actor (by label).
export const PALETTES = {
  'corporate-blue': { bg0: '#5ed6ff', bg1: '#3a6dff', ink: '#1b2a6b', accent: '#ffd23f', goal: '#2849b8', colors: ['#ff5e7e', '#ffb627', '#2ed58f', '#a66cff', '#ff7f3f', '#19c3e6'] },
  sunset: { bg0: '#ffc46b', bg1: '#ff5f8f', ink: '#5b1a43', accent: '#fff36b', goal: '#c23a6b', colors: ['#7b5cff', '#2ed58f', '#19c3e6', '#ff3d5a', '#ffb627', '#ff7fd1'] },
  mint: { bg0: '#8ff7cf', bg1: '#1db9a4', ink: '#0d4b44', accent: '#ffe14d', goal: '#12897a', colors: ['#ff5e7e', '#ffb627', '#7b5cff', '#3a8bff', '#ff7f3f', '#f15bb5'] },
  mono: { bg0: '#d9ccff', bg1: '#8a72f5', ink: '#2e1f6b', accent: '#ffd23f', goal: '#5b43c9', colors: ['#ff5e7e', '#ffb627', '#2ed58f', '#7b5cff', '#3a8bff', '#ff7f3f'] },
};

export const MAX_ACTORS = 8;
const DEFAULT_ACTORS = [['Slides', 'emoji:📊'], ['Action Items', 'emoji:📝'], ['Reply All', 'emoji:📧']];
// shortcut: tiny second-net blocklist, extend or swap for a real moderation list before public launch
const BLOCKLIST = /\b(fuck\w*|shit\w*|cazzo|merda|stronz\w*|bastard\w*)\b/gi;

// Strip HTML-ish chars and control chars, mask rude words, cap length.
export function clean(value, max, fallback = '') {
  if (typeof value !== 'string') return fallback;
  const s = value
    .replace(/[<>&"`\u0000-\u001f\u007f]/g, '')
    .replace(BLOCKLIST, '???')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, max);
  return s || fallback;
}

// 'img:<index>' | 'emoji:<char>' | 'text'. Anything else becomes 'text'.
export function cleanSprite(value) {
  if (typeof value !== 'string') return 'text';
  if (/^img:\d{1,2}$/.test(value)) return value;
  const m = /^emoji:(.+)$/u.exec(value);
  if (m) {
    const glyph = [...m[1]].slice(0, 2).join('');
    if (/\p{Extended_Pictographic}/u.test(glyph)) return 'emoji:' + glyph;
  }
  return 'text';
}

export function normalizeSpec(raw) {
  const r = raw && typeof raw === 'object' ? raw : {};
  const rawActors = Array.isArray(r.actors) ? r.actors : [];
  const actors = rawActors
    .filter((a) => a && typeof a === 'object')
    .slice(0, MAX_ACTORS) // extra attendees are dropped, not merged
    .map((a) => ({
      label: clean(a.label, 24, '???'),
      role: 'enemy',
      sprite: cleanSprite(a.sprite),
    }));
  if (!actors.length) actors.push(...DEFAULT_ACTORS.map(([label, sprite]) => ({ label, role: 'enemy', sprite })));

  const goal = r.goal && typeof r.goal === 'object' ? r.goal : {};
  const m = r.messages && typeof r.messages === 'object' ? r.messages : {};
  const dur = Number(r.durationSec);
  const template = TEMPLATES.includes(r.template) ? r.template : 'sink';
  const td = TEMPLATE_DEFAULTS[template];

  return {
    version: 1,
    template,
    title: clean(r.title, 60, 'Meeting Survival'),
    subtitle: clean(r.subtitle, 80, td.subtitle),
    difficulty: DIFFICULTIES.includes(r.difficulty) ? r.difficulty : 'normal',
    durationSec: Number.isFinite(dur) ? Math.min(90, Math.max(30, Math.round(dur))) : 60,
    palette: Object.hasOwn(PALETTES, r.palette) ? r.palette : 'corporate-blue',
    actors,
    goal: { label: clean(goal.label, 24, td.goal), sprite: cleanSprite(goal.sprite) === 'text' ? td.sprite : cleanSprite(goal.sprite) },
    messages: {
      start: clean(m.start, 80, 'The meeting could have been an email.'),
      win: clean(m.win, 80, "Meeting adjourned. You're free."),
      lose: clean(m.lose, 80, "Let's take this offline."),
    },
  };
}

// LLM-free spec from raw text, used when no LLM is configured or the call fails. Template is random.
// Invite names and duration are used when present (GDD §7: longer meeting -> harder, longer round).
// shortcut: plain prose actors = capitalised words, which misses lowercase names; the LLM does this better.
export function fallbackSpec(text, rng = Math.random) {
  const t = typeof text === 'string' ? text : '';
  const inv = parseInvite(t);
  const words = inv.names.length ? inv.names : (t.match(/\p{Lu}[\p{L}'-]{2,}/gu) || []).slice(1);
  const actors = [...new Set(words)].slice(0, MAX_ACTORS).map((label) => ({ label: label.split(' ')[0], role: 'enemy', sprite: 'text' }));
  const title = inv.title || t.split(/\r?\n/)[0].trim();
  const min = inv.durationMin;
  return normalizeSpec({
    template: TEMPLATES[Math.floor(rng() * TEMPLATES.length)],
    title: title || undefined,
    actors,
    difficulty: min ? (min >= 60 ? 'hard' : min >= 30 ? 'normal' : 'easy') : undefined,
    durationSec: min || undefined,
  });
}

// Share links carry the spec in the URL fragment. Uploaded images never go in (GDD §7, §9).
export function encodeSpec(spec) {
  const safe = normalizeSpec(spec);
  safe.actors = safe.actors.map((a) => (a.sprite.startsWith('img:') ? { ...a, sprite: 'text' } : a));
  const bytes = new TextEncoder().encode(JSON.stringify(safe));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// base64url -> UTF-8 string. Throws on bad input.
export function decodeB64url(s) {
  const bin = atob(String(s).replace(/-/g, '+').replace(/_/g, '/'));
  return new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
}

// Returns a valid spec, or null when the fragment is not decodable.
export function decodeSpec(s) {
  try {
    return normalizeSpec(JSON.parse(decodeB64url(s)));
  } catch {
    return null;
  }
}
