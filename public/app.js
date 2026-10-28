// UI glue: input -> /spec -> sink -> share. Kept dumb on purpose; the logic lives in the tested modules.
import { normalizeSpec, fallbackSpec, encodeSpec, decodeSpec, DIFFICULTIES } from './spec.js';
import * as sink from './sink.js';

const $ = (id) => document.getElementById(id);
const images = []; // 128x128 circle-cropped canvases, in memory only
let spec = null;
let game = null;

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

$('files').onchange = async (e) => {
  images.length = 0;
  $('thumbs').replaceChildren();
  for (const f of [...e.target.files].slice(0, 5)) {
    try {
      const c = await cropFace(f);
      images.push(c);
      const img = new Image();
      img.src = c.toDataURL();
      $('thumbs').append(img);
    } catch { /* not an image: skip it */ }
  }
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

$('generate').onclick = async () => {
  const text = $('text').value;
  $('err').textContent = 'Building...';
  let s;
  try {
    const r = await fetch('spec', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ text, imageCount: images.length }),
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
  $('levels').replaceChildren(...DIFFICULTIES.map((d) => {
    const b = document.createElement('button');
    b.textContent = d;
    b.className = d === s.difficulty ? 'on' : '';
    b.onclick = () => { spec.difficulty = d; start(spec); };
    return b;
  }));
  play();
}

function play() {
  $('end').hidden = true;
  $('pause').textContent = 'Pause';
  game = sink.init($('canvas'), {
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
$('remix').onclick = () => { sink.destroy(); history.replaceState(null, '', location.pathname); $('play').hidden = true; $('setup').hidden = false; };
$('make').onclick = (e) => { e.preventDefault(); $('remix').click(); };
$('share').onclick = async () => {
  const url = `${location.origin}${location.pathname}#s=${encodeSpec(spec)}`;
  try { await navigator.clipboard.writeText(url); $('share').textContent = 'Copied!'; }
  catch { prompt('Copy this link', url); }
};
// shortcut: placeholder address, set the real one before launch (GDD §9)
$('report').href = 'mailto:report@meetingbreak.example?subject=Report%20a%20game';

const m = /^#s=(.+)$/.exec(location.hash);
const shared = m && decodeSpec(m[1]);
if (shared) start(shared);
