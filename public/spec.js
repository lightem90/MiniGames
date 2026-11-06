// GameSpec: the only contract between the LLM and the engine (GDD §6).
// Shared by browser and server. Every input is untrusted: normalizeSpec never throws
// and always returns a playable spec.
import { parseInvite } from './invite.js';

export const TEMPLATES = ['sink', 'whack', 'dodge', 'drive', 'defend', 'merge', 'blast', 'helix', 'hop', 'click', 'trap'];
export const LANGS = ['en', 'it'];
// What the `goal` slot means per template: its sprite, and its default label and subtitle per language.
export const TEMPLATE_DEFAULTS = {
  sink: { sprite: 'emoji:🗑️', en: { subtitle: 'Sink everything before the sync ends', goal: 'Trash' }, it: { subtitle: 'Butta tutto nel cestino prima che finisca la call', goal: 'Cestino' } },
  whack: { sprite: 'emoji:🔇', en: { subtitle: 'Mute them before they finish the sentence', goal: 'Mute' }, it: { subtitle: 'Silenziali prima che finiscano la frase', goal: 'Muto' } },
  dodge: { sprite: 'emoji:☕', en: { subtitle: 'Dodge the follow-ups until the call ends', goal: 'You' }, it: { subtitle: 'Schiva i follow-up fino alla fine della call', goal: 'Tu' } },
  drive: { sprite: 'emoji:😎', en: { subtitle: 'Drive through the agenda, dodge everyone on the road', goal: 'You' }, it: { subtitle: "Attraversa l'agenda, schiva chiunque sulla strada", goal: 'Tu' } },
  defend: { sprite: 'emoji:🔇', en: { subtitle: 'Hold the line until the meeting ends', goal: 'Mute' }, it: { subtitle: 'Resisti fino alla fine della riunione', goal: 'Muto' } },
  merge: { sprite: 'emoji:📦', en: { subtitle: 'Merge the attendees until the sync ends', goal: 'Box' }, it: { subtitle: 'Unisci i partecipanti fino alla fine della call', goal: 'Scatola' } },
  blast: { sprite: 'emoji:🧱', en: { subtitle: 'Clear the agenda, line by line', goal: 'Grid' }, it: { subtitle: "Svuota l'agenda, riga per riga", goal: 'Griglia' } },
  helix: { sprite: 'emoji:☕', en: { subtitle: 'Fall through the gaps, never onto a stakeholder', goal: 'You' }, it: { subtitle: 'Cadi nei buchi, mai su uno stakeholder', goal: 'Tu' } },
  hop: { sprite: 'emoji:☕', en: { subtitle: 'Cross the roadmap without getting run over', goal: 'You' }, it: { subtitle: 'Attraversa la roadmap senza farti investire', goal: 'Tu' } },
  click: { sprite: 'emoji:🔇', en: { subtitle: 'Mute as fast as you can', goal: 'Mute' }, it: { subtitle: 'Silenzia più veloce che puoi', goal: 'Muto' } },
  trap: { sprite: 'emoji:🚧', en: { subtitle: 'Corner them before they escape the call', goal: 'Block' }, it: { subtitle: 'Bloccali prima che scappino dalla call', goal: 'Blocco' } },
};
// { subtitle, goal, sprite } of a template in a language (English for an unknown one).
export const templateDefaults = (template, lang) => ({ ...TEMPLATE_DEFAULTS[template][LANGS.includes(lang) ? lang : 'en'], sprite: TEMPLATE_DEFAULTS[template].sprite });
// Texts used when the LLM gives none, per language.
const TEXT_DEFAULTS = {
  en: { title: 'Meeting Survival', start: 'The meeting could have been an email.', win: "Meeting adjourned. You're free.", lose: "That's enough for today. The meeting will end.", actors: ['Slides', 'Action Items', 'Reply All'] },
  it: { title: 'Sopravvivi alla riunione', start: 'Questa riunione poteva essere una mail.', win: 'Riunione chiusa. Liberi tutti.', lose: 'Per oggi basta così. Anche questa riunione finirà.', actors: ['Slide', 'Cose da fare', 'Rispondi a tutti'] },
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
const DEFAULT_SPRITES = ['emoji:📊', 'emoji:📝', 'emoji:📧'];
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
  const lang = LANGS.includes(r.lang) ? r.lang : 'en';
  const txt = TEXT_DEFAULTS[lang];
  if (!actors.length) actors.push(...txt.actors.map((label, i) => ({ label, role: 'enemy', sprite: DEFAULT_SPRITES[i] })));

  const goal = r.goal && typeof r.goal === 'object' ? r.goal : {};
  const m = r.messages && typeof r.messages === 'object' ? r.messages : {};
  const dur = Number(r.durationSec);
  const template = TEMPLATES.includes(r.template) ? r.template : 'sink';
  const td = templateDefaults(template, lang);

  return {
    version: 1,
    template,
    lang,
    title: clean(r.title, 60, txt.title),
    subtitle: clean(r.subtitle, 80, td.subtitle),
    difficulty: DIFFICULTIES.includes(r.difficulty) ? r.difficulty : 'normal',
    durationSec: Number.isFinite(dur) ? Math.min(90, Math.max(30, Math.round(dur))) : 60,
    palette: Object.hasOwn(PALETTES, r.palette) ? r.palette : 'corporate-blue',
    actors,
    goal: { label: clean(goal.label, 24, td.goal), sprite: cleanSprite(goal.sprite) === 'text' ? td.sprite : cleanSprite(goal.sprite) },
    messages: {
      start: clean(m.start, 80, txt.start),
      win: clean(m.win, 80, txt.win),
      lose: clean(m.lose, 80, txt.lose),
      calm: clean(m.calm, 120, ''), // optional kind closing line, shown on the end screen
    },
  };
}

// LLM-free spec from raw text, used when no LLM is configured or the call fails. Template is random.
// Invite names and duration are used when present (GDD §7: longer meeting -> harder, longer round).
// shortcut: plain prose actors = capitalised words, which misses lowercase names; the LLM does this better.
// A random template, never `exclude` (the one just played), so every new game is a different one.
export function pickTemplate(exclude, rng = Math.random) {
  const ts = TEMPLATES.filter((t) => t !== exclude);
  return ts[Math.floor(rng() * ts.length)];
}

export function fallbackSpec(text, rng = Math.random, template = pickTemplate(undefined, rng), lang = 'en') {
  const t = typeof text === 'string' ? text : '';
  const inv = parseInvite(t);
  const words = inv.names.length ? inv.names : (t.match(/\p{Lu}[\p{L}'-]{2,}/gu) || []).slice(1);
  const actors = [...new Set(words)].slice(0, MAX_ACTORS).map((label) => ({ label: label.split(' ')[0], role: 'enemy', sprite: 'text' }));
  const title = inv.title || t.split(/\r?\n/)[0].trim();
  const min = inv.durationMin;
  return normalizeSpec({
    template,
    lang,
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
