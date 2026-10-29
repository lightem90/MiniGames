// Invite parsing (GDD §7): .ics files and pasted Outlook / Teams / Google invite text -> title, duration, names.
// Pure and DOM-free, shared by browser and server. Emails are dropped here, before anything leaves the browser.

const EMAIL = /[^\s<>()"',;]+@[^\s<>()"',;]+/g;
// "Required: A; B", "Optional attendees: ...", "Guests: ...", Italian Outlook "Obbligatorio:", "Facoltativo:"
const PEOPLE_LINE = /^(required|optional|attendees|guests|participants|to|cc|obbligatori[oa]?|facoltativ[oa]?|partecipanti|invitati)(\s+attendees)?\s*:\s*(.+)$/i;
const TITLE_LINE = /^(subject|title|oggetto|titolo)\s*:\s*(.+)$/i;
const TIME_RANGE = /(\d{1,2})[:.](\d{2})\s*(am|pm)?\s*[-–—]\s*(\d{1,2})[:.](\d{2})\s*(am|pm)?/i;
const MINUTES = /(\d{1,3})\s*(?:min|mins|minutes|minuti)\b/i;
const HOURS = /(\d{1,2})\s*(?:h|hr|hrs|hour|hours|ora|ore)(?![a-z])(?:\s*(\d{1,2})\s*(?:min|m)?)?/i;

const toMin = (h, m, ap) => {
  let hh = Number(h);
  if (ap) { hh %= 12; if (ap.toLowerCase() === 'pm') hh += 12; }
  return hh * 60 + Number(m);
};

// Minutes implied by a line of text, or 0.
export function durationFromText(line) {
  const r = TIME_RANGE.exec(line);
  if (r) {
    const b = toMin(r[4], r[5], r[6]);
    // "10:00-11:30 AM": the start inherits AM/PM from the end; "11:00-1:00 PM": it flips
    const tries = r[3] || !r[6] ? [r[3]] : [r[6], r[6].toLowerCase() === 'pm' ? 'am' : 'pm'];
    for (const ap of tries) {
      const d = (b - toMin(r[1], r[2], ap) + 1440) % 1440;
      if (d > 0 && d <= 720) return d;
    }
  }
  const m = MINUTES.exec(line);
  if (m) return Number(m[1]);
  const h = HOURS.exec(line);
  if (h) return Number(h[1]) * 60 + Number(h[2] || 0);
  return 0;
}

// "Marco Rossi <m@x.it>; Giulia Bianchi (Guest)" -> ['Marco Rossi', 'Giulia Bianchi']
function splitNames(s) {
  return s.replace(EMAIL, '').replace(/<[^>]*>|\([^)]*\)/g, '').split(/[;,]/)
    .map((n) => n.replace(/["']/g, '').replace(/\s+/g, ' ').trim())
    .filter((n) => n && /\p{L}/u.test(n));
}

function parseIcs(raw) {
  const lines = raw.replace(/\r\n[ \t]/g, '').replace(/\r?\n[ \t]/g, '').split(/\r?\n/); // unfold continuation lines
  const inv = { title: '', durationMin: 0, names: [], description: '', isInvite: true };
  const stamps = {};
  for (const line of lines) {
    const i = line.indexOf(':');
    if (i < 0) continue;
    const head = line.slice(0, i), value = line.slice(i + 1);
    const key = head.split(';')[0].toUpperCase();
    const unescape = (v) => v.replace(/\\n/gi, '\n').replace(/\\([,;\\])/g, '$1');
    if (key === 'SUMMARY' && !inv.title) inv.title = unescape(value).trim();
    else if (key === 'DESCRIPTION' && !inv.description) inv.description = unescape(value).trim();
    else if (key === 'DTSTART' || key === 'DTEND') {
      const m = /(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2}))?/.exec(value);
      if (m) stamps[key] = Date.UTC(+m[1], +m[2] - 1, +m[3], +(m[4] || 0), +(m[5] || 0));
    } else if (key === 'DURATION') {
      const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?/.exec(value);
      if (m) inv.durationMin = (+m[1] || 0) * 1440 + (+m[2] || 0) * 60 + (+m[3] || 0);
    } else if (key === 'ATTENDEE' || key === 'ORGANIZER') {
      const cn = /CN="?([^";:]+)"?/i.exec(head);
      if (cn && !EMAIL.test(cn[1])) inv.names.push(cn[1].trim());
      EMAIL.lastIndex = 0;
    }
  }
  if (!inv.durationMin && stamps.DTSTART && stamps.DTEND) inv.durationMin = Math.round((stamps.DTEND - stamps.DTSTART) / 60000);
  return inv;
}

function parseText(raw) {
  const inv = { title: '', durationMin: 0, names: [], description: '', isInvite: false };
  const rest = [];
  for (const line of raw.split(/\r?\n/).map((l) => l.trim())) {
    let m;
    if ((m = PEOPLE_LINE.exec(line))) { inv.names.push(...splitNames(m[3])); inv.isInvite = true; }
    else if ((m = TITLE_LINE.exec(line))) { inv.title = m[2].trim(); inv.isInvite = true; }
    else {
      if (!inv.durationMin) inv.durationMin = durationFromText(line);
      if (line) rest.push(line);
    }
  }
  inv.description = rest.join('\n');
  return inv;
}

// -> { title, durationMin, names (unique, no emails, max 8), description, isInvite }
export function parseInvite(raw) {
  const text = typeof raw === 'string' ? raw : '';
  const inv = /BEGIN:VCALENDAR|BEGIN:VEVENT/i.test(text) ? parseIcs(text) : parseText(text);
  inv.names = [...new Set(inv.names.map((n) => n.replace(EMAIL, '').trim()).filter(Boolean))].slice(0, 8);
  inv.durationMin = Math.min(600, Math.max(0, inv.durationMin | 0));
  inv.description = inv.description.replace(EMAIL, '').replace(/https?:\/\/\S+/g, '').replace(/\n{2,}/g, '\n').trim();
  return inv;
}

// Compact text for the LLM: no emails, no links, description capped. Plain prose passes through unchanged.
export function inviteToText(inv, raw) {
  if (!inv.isInvite && !inv.durationMin) return typeof raw === 'string' ? raw : '';
  const lines = [];
  if (inv.title) lines.push(`Subject: ${inv.title}`);
  if (inv.durationMin) lines.push(`${inv.durationMin} minutes`);
  if (inv.names.length) lines.push(`Attendees: ${inv.names.join(', ')}`);
  if (inv.description) lines.push(inv.description.slice(0, 1500));
  return lines.join('\n');
}
