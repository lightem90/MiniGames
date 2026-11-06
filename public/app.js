// UI glue: input -> /spec -> template -> share. Kept dumb on purpose; the logic lives in the tested modules.
import { PALETTES, normalizeSpec, fallbackSpec, pickTemplate, encodeSpec, decodeSpec, DIFFICULTIES, TEMPLATES, TEMPLATE_DEFAULTS } from './spec.js';
import { destroy } from './engine.js';
import { parseInvite, inviteToText } from './invite.js';
import { initAuth } from './auth.js';
import { startTour } from './tour.js';
import * as sink from './sink.js';
import * as whack from './whack.js';
import * as dodge from './dodge.js';
import * as drive from './drive.js';
import * as defend from './defend.js';
import * as merge from './merge.js';
import * as blast from './blast.js';
import * as helix from './helix.js';
import * as hop from './hop.js';
import * as click from './click.js';
import * as trap from './trap.js';
import * as breathe from './breathe.js';
import { pickNews } from './news.js';

const GAMES = { sink, whack, dodge, drive, defend, merge, blast, helix, hop, click, trap };

const $ = (id) => document.getElementById(id);
const images = []; // 128x128 circle-cropped canvases, in memory only
let spec = null;
let game = null;
let me = null; // { name, email } after sign-in; memory only

async function cropFace(file) {
  const bmp = await createImageBitmap(file);
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.beginPath(); g.arc(64, 64, 64, 0, 7); g.clip();
  const s = Math.min(bmp.width, bmp.height);
  g.drawImage(bmp, (bmp.width - s) / 2, (bmp.height - s) / 2, s, s, 0, 0, 128, 128);
  return c;
}

// Picked or pasted images join the list, up to 5. Still memory only.
async function addImages(files) {
  for (const f of [...files]) {
    if (images.length >= 5) break;
    try {
      const c = await cropFace(f);
      images.push(c);
      const img = new Image();
      img.src = c.toDataURL();
      img.alt = `face ${images.length}`;
      img.className = 'slot';
      $('thumbs').children[images.length - 1].replaceWith(img); // fills the next empty circle
      $('faces-title').textContent = images.length < 5 ? `📸 ${images.length} in the game, add another` : '📸 5 in the game, ready!';
      $('faces').classList.remove('got'); void $('faces').offsetWidth; $('faces').classList.add('got'); // replay the pop
    } catch { /* not an image: skip it */ }
  }
}

$('files').onchange = (e) => addImages(e.target.files);
// The faces box: click / Enter to pick, drop images on it; the shortcut shown matches the device.
$('faces').onclick = () => $('files').click();
$('faces').onkeydown = (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); $('files').click(); } };
$('faces').ondragover = (e) => { e.preventDefault(); $('faces').classList.add('over'); };
$('faces').ondragleave = () => $('faces').classList.remove('over');
$('faces').ondrop = (e) => { e.preventDefault(); $('faces').classList.remove('over'); addImages(e.dataTransfer.files); };
if (matchMedia('(pointer: coarse)').matches && !matchMedia('(pointer: fine)').matches) { $('faces-how').textContent = 'Tap to add photos of your colleagues'; $('faces-how').nextElementSibling.textContent = 'Up to 5. They never leave this phone.'; }
else if (/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) $('faces-how').innerHTML = '<kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>Ctrl</kbd>+<kbd>4</kbd> a face from the call, then <kbd>⌘</kbd>+<kbd>V</kbd> here';
// Ctrl+V a screenshot (Win+Shift+S, Cmd+Shift+Ctrl+4) anywhere on the setup screen; pasting text into the box stays as it is.
document.onpaste = (e) => {
  if ($('setup').hidden || !e.clipboardData.files.length) return;
  e.preventDefault();
  addImages(e.clipboardData.files);
};

// Give uploaded images to actors that have no image yet, in order.
function attachImages(s) {
  const used = new Set(s.actors.map((a) => a.sprite).filter((x) => x.startsWith('img:')));
  for (let i = 0; i < images.length; i++) {
    if (used.has('img:' + i)) continue;
    const a = s.actors.find((x) => !x.sprite.startsWith('img:'));
    if (a) a.sprite = 'img:' + i;
  }
  return s;
}

// A picked or dropped .ics (or any text file) lands in the text box; parsing happens here, in the browser.
// Dropping straight from Outlook gives the browser no readable file, hence the picker.
$('ics').onchange = async (e) => { if (e.target.files[0]) $('text').value = await e.target.files[0].text(); };
$('text').ondragover = (e) => e.preventDefault();
$('text').ondrop = async (e) => {
  const f = e.dataTransfer.files[0];
  if (f) { e.preventDefault(); if (f.type.startsWith('image/')) addImages(e.dataTransfer.files); else $('text').value = await f.text(); }
};

$('generate').onclick = async () => {
  const text = inviteToText(parseInvite($('text').value), $('text').value); // names and text only, never emails
  $('err').textContent = 'Building...';
  let s;
  try {
    const r = await fetch('spec', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, imageCount: images.length, player: me?.name.split(' ')[0], previous: spec?.template }),
    });
    if (!r.ok) throw new Error(r.status);
    s = normalizeSpec((await r.json()).spec);
  } catch {
    s = fallbackSpec(text, Math.random, pickTemplate(spec?.template)); // server down or static hosting: still playable
  }
  $('err').textContent = '';
  start(attachImages(s));
};

// The page takes the game's colours (SPEC-relief 1.1); the setup screen keeps the default ones.
function pageColours(pal) {
  for (const [k, v] of [['--bg0', pal?.bg0], ['--bgm', pal?.bg1], ['--bg1', pal?.goal]]) {
    if (v) document.body.style.setProperty(k, v); else document.body.style.removeProperty(k);
  }
}

// One line of long-run good news on the end screen (SPEC-relief 3). The list is fetched once; if it fails the line just stays hidden.
let news = [], lastNews = -1;
fetch('good-news.json').then((r) => r.json())
  .then((l) => { if (Array.isArray(l)) news = l.filter((e) => e && typeof e.text === 'string' && typeof e.source === 'string' && /^https:\/\//.test(e.url)); })
  .catch(() => {});
function showNews() {
  lastNews = pickNews(news, lastNews);
  const e = news[lastNews];
  $('news').hidden = !e;
  if (!e) return;
  const link = document.createElement('a');
  link.href = e.url; link.target = '_blank'; link.rel = 'noopener'; link.textContent = e.source;
  $('news').replaceChildren(`${e.text} — `, link);
}

function start(s) {
  spec = s;
  pageColours(PALETTES[s.palette]);
  $('setup').hidden = true;
  $('play').hidden = false;
  $('title').textContent = s.title;
  $('subtitle').textContent = s.subtitle;
  const picker = (key, values) => values.map((v) => {
    const b = document.createElement('button');
    b.textContent = v;
    b.className = v === s[key] ? 'on' : '';
    b.onclick = () => { spec[key] = v; start(spec); };
    return b;
  });
  $('levels').replaceChildren(...picker('difficulty', DIFFICULTIES));
  $('games').replaceChildren(...picker('template', TEMPLATES).map((b) => {
    const to = TEMPLATE_DEFAULTS[b.textContent];
    const from = TEMPLATE_DEFAULTS[s.template];
    b.onclick = () => { // a goal/subtitle the LLM did not customise follows the template
      if (spec.goal.label === from.goal && spec.goal.sprite === from.sprite) spec.goal = { label: to.goal, sprite: to.sprite };
      if (spec.subtitle === from.subtitle) spec.subtitle = to.subtitle;
      spec.template = b.textContent;
      start(spec);
    };
    return b;
  }));
  play();
}

function play() {
  $('end').hidden = true;
  $('pause').textContent = 'Pause';
  game = GAMES[spec.template].init($('canvas'), {
    spec,
    images,
    onEnd: (r) => {
      $('endmsg').textContent = r.message;
      $('endscore').textContent = `Score: ${r.score}`;
      $('calm').textContent = spec.messages.calm;
      $('calm').hidden = !spec.messages.calm;
      showNews();
      $('end').hidden = false;
    },
  });
}

$('pause').onclick = () => { $('pause').textContent = game.togglePause() ? 'Resume' : 'Pause'; };
$('again').onclick = play;
// Breathing ring in place of the end screen; any tap on the canvas stops it and the end panel comes back.
$('breathe').onclick = () => {
  $('end').hidden = true;
  $('pause').textContent = 'Pause';
  game = breathe.init($('canvas'), { spec, images, onEnd: () => { $('end').hidden = false; } });
};
$('remix').onclick = () => { destroy(); pageColours(null); history.replaceState(null, '', location.pathname); $('play').hidden = true; $('setup').hidden = false; };
$('make').onclick = (e) => { e.preventDefault(); $('remix').click(); };
$('share').onclick = async () => {
  const url = `${location.origin}${location.pathname}#s=${encodeSpec(spec)}`;
  try { await navigator.clipboard.writeText(url); $('share').textContent = 'Copied!'; }
  catch { prompt('Copy this link', url); }
};
// shortcut: placeholder address, set the real one before launch (GDD §9)
$('report').href = 'mailto:report@meetingbreak.example?subject=Report%20a%20game';

// Tour: walks the setup screen, then a paused demo game (or the running game, paused) and its controls.
const pause = () => { if ($('pause').textContent === 'Pause') $('pause').click(); };
function tour(from) {
  let started = !$('play').hidden;
  const demo = !started; // no game yet: the tour starts one and leaves it at the end
  startTour({
    from,
    template: () => spec.template,
    show(screen) {
      if (screen === 'play' && !started) { started = true; start(attachImages(fallbackSpec('Budget review\nMarco, Giulia and the Action Items'))); }
      if (screen === 'play') pause();
      $('setup').hidden = screen !== 'setup';
      $('play').hidden = screen !== 'play';
    },
    onEnd() { if (demo) $('remix').click(); else { $('setup').hidden = true; $('play').hidden = false; } },
  });
}
$('howto').onclick = () => tour('setup');
$('help').onclick = () => tour('play');

initAuth((user) => {
  me = user;
  $('who').textContent = user ? `Signed in as ${user.name}` : '';
  $('signout').hidden = !user;
  $('signin').hidden = !!user;
});

const m = /^#s=(.+)$/.exec(location.hash);
const shared = m && decodeSpec(m[1]);
if (shared) start(shared);
