// UI glue: input -> /spec -> template -> share. Kept dumb on purpose; the logic lives in the tested modules.
import { normalizeSpec, fallbackSpec, encodeSpec, decodeSpec, DIFFICULTIES, TEMPLATES, TEMPLATE_DEFAULTS } from './spec.js';
import { destroy } from './engine.js';
import { parseInvite, inviteToText } from './invite.js';
import { initAuth } from './auth.js';
import { startTour } from './tour.js';
import * as sink from './sink.js';
import * as whack from './whack.js';
import * as dodge from './dodge.js';
import * as defend from './defend.js';
import * as merge from './merge.js';
import * as blast from './blast.js';
import * as helix from './helix.js';
import * as hop from './hop.js';
import * as click from './click.js';
import * as trap from './trap.js';

const GAMES = { sink, whack, dodge, defend, merge, blast, helix, hop, click, trap };

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
      $('thumbs').append(img);
    } catch { /* not an image: skip it */ }
  }
}

$('files').onchange = (e) => addImages(e.target.files);
// Ctrl+V a screenshot (Win+Shift+S, Cmd+Shift+4) anywhere on the setup screen; pasting text into the box stays as it is.
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
  if (f) { e.preventDefault(); $('text').value = await f.text(); }
};

$('generate').onclick = async () => {
  const text = inviteToText(parseInvite($('text').value), $('text').value); // names and text only, never emails
  $('err').textContent = 'Building...';
  let s;
  try {
    const r = await fetch('spec', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, imageCount: images.length, player: me?.name.split(' ')[0] }),
    });
    if (!r.ok) throw new Error(r.status);
    s = normalizeSpec((await r.json()).spec);
  } catch {
    s = fallbackSpec(text); // server down or static hosting: still playable
  }
  $('err').textContent = '';
  start(attachImages(s));
};

function start(s) {
  spec = s;
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
      $('end').hidden = false;
    },
  });
}

$('pause').onclick = () => { $('pause').textContent = game.togglePause() ? 'Resume' : 'Pause'; };
$('again').onclick = play;
$('remix').onclick = () => { destroy(); history.replaceState(null, '', location.pathname); $('play').hidden = true; $('setup').hidden = false; };
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
