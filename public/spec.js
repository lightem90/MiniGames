// GameSpec: the only contract between the LLM and the engine (GDD §6).
// Shared by browser and server. Every input is untrusted: normalizeSpec never throws
// and always returns a playable spec.

export const TEMPLATES = ['sink'];
export const DIFFICULTIES = ['easy', 'normal', 'hard'];
export const PALETTES = {
  'corporate-blue': { bg: '#10243f', fg: '#e8f0ff', accent: '#4da3ff', goal: '#1d3b66' },
  sunset: { bg: '#3b1d2a', fg: '#fff0e8', accent: '#ff8a5c', goal: '#5a2a3c' },
  mint: { bg: '#0f3a33', fg: '#e6fff8', accent: '#3ddc97', goal: '#17564b' },
  mono: { bg: '#1e1e1e', fg: '#f2f2f2', accent: '#bdbdbd', goal: '#333333' },
};

export const MAX_ACTORS = 8;
const DEFAULT_ACTORS = ['Slides', 'Action Items', 'Reply All'];
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
  if (!actors.length) actors.push(...DEFAULT_ACTORS.map((label) => ({ label, role: 'enemy', sprite: 'text' })));

  const goal = r.goal && typeof r.goal === 'object' ? r.goal : {};
  const m = r.messages && typeof r.messages === 'object' ? r.messages : {};
  const dur = Number(r.durationSec);

  return {
    version: 1,
    template: TEMPLATES.includes(r.template) ? r.template : 'sink',
    title: clean(r.title, 60, 'Meeting Survival'),
    subtitle: clean(r.subtitle, 80, 'Sink everything before the sync ends'),
    difficulty: DIFFICULTIES.includes(r.difficulty) ? r.difficulty : 'normal',
    durationSec: Number.isFinite(dur) ? Math.min(90, Math.max(30, Math.round(dur))) : 60,
    palette: Object.hasOwn(PALETTES, r.palette) ? r.palette : 'corporate-blue',
    actors,
    goal: { label: clean(goal.label, 24, 'Trash'), sprite: cleanSprite(goal.sprite) === 'text' ? 'emoji:🗑️' : cleanSprite(goal.sprite) },
    messages: {
      start: clean(m.start, 80, 'The meeting could have been an email.'),
      win: clean(m.win, 80, "Meeting adjourned. You're free."),
      lose: clean(m.lose, 80, "Let's take this offline."),
    },
  };
}

// LLM-free spec from raw text, used when no LLM is configured or the call fails.
// shortcut: actors = capitalised words, which misses lowercase names; the LLM does this better.
export function fallbackSpec(text) {
  const t = typeof text === 'string' ? text : '';
  const words = t.match(/\p{Lu}[\p{L}'-]{2,}/gu) || [];
  const actors = [...new Set(words.slice(1))].slice(0, MAX_ACTORS).map((label) => ({ label, role: 'enemy', sprite: 'text' }));
  const title = t.split(/\r?\n/)[0].trim();
  return normalizeSpec({ title: title || undefined, actors });
}

// Share links carry the spec in the URL fragment. Uploaded images never go in (GDD §7, §9).
export function encodeSpec(spec) {
  const safe = normalizeSpec(spec);
  safe.actors = safe.actors.map((a) => (a.sprite.startsWith('img:') ? { ...a, sprite: 'text' } : a));
  const bytes = new TextEncoder().encode(JSON.stringify(safe));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// Returns a valid spec, or null when the fragment is not decodable.
export function decodeSpec(s) {
  try {
    const b64 = String(s).replace(/-/g, '+').replace(/_/g, '/');
    const bin = atob(b64);
    const json = new TextDecoder().decode(Uint8Array.from(bin, (c) => c.charCodeAt(0)));
    return normalizeSpec(JSON.parse(json));
  } catch {
    return null;
  }
}
