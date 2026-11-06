// Shared canvas loop for every template: pointer + keys, pause, dt clamp, background, HUD, effects, end banner.
// A template gives { state, step, draw, hud, score, down?, move?, up?, keys? }; its logic module stays DOM-free.
import { PALETTES } from './spec.js';
import { t } from './i18n.js';

export const W = 400;
export const H = 300;
export const FONT = 'Fredoka, "Arial Rounded MT Bold", "Trebuchet MS", system-ui, sans-serif';
const END_LINGER = 1.8; // seconds the canvas keeps animating (confetti, banner) after the round ends

let current = null;

// Round status ('won'/'lost') -> the spec message ('win'/'lose'). Shared by every template.
export const endMessage = (spec, state) => spec.messages[state.status === 'won' ? 'win' : 'lose'];

// A label that fits on a disc: short names as they are, long ones as initials ("Veryverylongname Surnamesuperlong" -> "VS").
export const short = (label) => (label.length <= 8 ? label : label.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 3));

// Same label -> same bright colour, so "Marco" keeps his colour across games.
export function colorFor(pal, text) {
  let h = 2166136261; // FNV-1a: well mixed, so names spread over the palette (a plain *31 hash piled them on one colour)
  for (const ch of String(text)) h = Math.imul(h ^ ch.codePointAt(0), 16777619);
  h ^= h >>> 15;
  return pal.colors[(h >>> 0) % pal.colors.length];
}

export function rr(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, r);
}

// Chunky white text with a dark outline: the mobile-game look.
export function label(ctx, pal, str, x, y, size, { align = 'center', color = '#fff' } = {}) {
  ctx.font = `700 ${size}px ${FONT}`;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  ctx.lineJoin = 'round';
  ctx.lineWidth = Math.max(2.5, size / 4.5);
  ctx.strokeStyle = pal.ink;
  ctx.strokeText(str, x, y);
  ctx.fillStyle = color;
  ctx.fillText(str, x, y);
}

// sprite content (uploaded face, emoji or initials) inside a circle of radius r
function content(ctx, pal, images, s, text, x, y, r) {
  const img = s.startsWith('img:') && images[+s.slice(4)];
  if (img) {
    ctx.save();
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
    ctx.drawImage(img, x - r, y - r, 2 * r, 2 * r);
    ctx.restore();
  } else if (s.startsWith('emoji:')) {
    ctx.font = `${r * 1.25}px sans-serif`;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(s.slice(6), x, y + r * 0.08);
  } else {
    label(ctx, pal, short(text), x, y + 1, Math.max(9, r * 0.62));
  }
  return !!img;
}

// An actor/goal as a glossy ball with a white rim and a ground shadow: uploaded face, emoji, or label.
export function sprite(ctx, pal, images, s, text, x, y, r, color = colorFor(pal, text)) {
  ctx.fillStyle = 'rgba(0,0,0,0.2)';
  ctx.beginPath(); ctx.ellipse(x, y + r * 0.92, r * 0.8, r * 0.28, 0, 0, 7); ctx.fill();
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  const img = s.startsWith('img:') && images[+s.slice(4)];
  if (img) content(ctx, pal, images, s, text, x, y, r);
  // light from the top left, darker rim, a gloss highlight: the "3D" is just this
  const g = ctx.createRadialGradient(x - r * 0.3, y - r * 0.4, r * 0.15, x, y, r * 1.02);
  g.addColorStop(0, 'rgba(255,255,255,0.28)'); g.addColorStop(0.55, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.3)');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  ctx.beginPath(); ctx.ellipse(x - r * 0.35, y - r * 0.52, r * 0.36, r * 0.16, -0.5, 0, 7); ctx.fill();
  ctx.lineWidth = Math.max(2, r * 0.13); ctx.strokeStyle = '#fff';
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.stroke();
  if (!img) content(ctx, pal, images, s, text, x, y, r * 0.85);
}

// A glossy candy block of side `size` centred on (x, y), with the actor's face/emoji/initials on it.
export function block(ctx, pal, images, s, text, x, y, size, color = colorFor(pal, text)) {
  const h = size / 2, rad = size * 0.22;
  ctx.fillStyle = color; rr(ctx, x - h, y - h, size, size, rad); ctx.fill();
  ctx.fillStyle = 'rgba(0,0,0,0.22)'; rr(ctx, x - h, y - h + size * 0.72, size, size * 0.28, [0, 0, rad, rad]); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.4)'; rr(ctx, x - h + 3, y - h + 3, size - 6, size * 0.22, rad * 0.6); ctx.fill();
  ctx.lineWidth = 1.5; ctx.strokeStyle = 'rgba(255,255,255,0.7)'; rr(ctx, x - h, y - h, size, size, rad); ctx.stroke();
  if (s.startsWith('img:') || s.startsWith('emoji:')) content(ctx, pal, images, s, text, x, y, size * 0.3);
  else label(ctx, pal, text.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase(), x, y, size * 0.45); // a name never fits a block
}

// Sky gradient, soft bokeh and a dot pattern, painted once per round at screen resolution.
function background(pal, k) {
  const c = document.createElement('canvas');
  c.width = W * k; c.height = H * k;
  const g = c.getContext('2d');
  g.scale(k, k);
  const lg = g.createLinearGradient(0, 0, 0, H);
  lg.addColorStop(0, pal.bg0); lg.addColorStop(1, pal.bg1);
  g.fillStyle = lg; g.fillRect(0, 0, W, H);
  g.fillStyle = 'rgba(255,255,255,0.09)';
  for (const [x, y, r] of [[40, 70, 70], [330, 30, 50], [370, 240, 90], [110, 270, 55], [230, 150, 28]]) { g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  g.fillStyle = 'rgba(255,255,255,0.1)';
  for (let y = 10; y < H; y += 20) for (let x = (y / 20) % 2 ? 0 : 10; x < W; x += 20) { g.beginPath(); g.arc(x, y, 1.4, 0, 7); g.fill(); }
  return c;
}

// Particles, floating text, screen shake and a colour flash. Templates call ui.fx.* when something happens.
function makeFx(ctx, pal) {
  const parts = [], texts = [];
  let shake = 0, flash = 0, flashColor = '#fff';
  return {
    burst(x, y, color = '#fff', n = 14) {
      for (let i = 0; i < n; i++) {
        const a = Math.random() * 6.283, v = 60 + Math.random() * 170;
        parts.push({ x, y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - 60, g: 420, life: 0.5 + Math.random() * 0.35, t: 0, r: 2 + Math.random() * 3.5, color: Math.random() < 0.3 ? '#fff' : color, rot: 0 });
      }
    },
    confetti() {
      for (let i = 0; i < 90; i++) {
        parts.push({ x: Math.random() * W, y: -10 - Math.random() * 80, vx: (Math.random() - 0.5) * 80, vy: 60 + Math.random() * 120, g: 120, life: 2.5, t: 0, r: 3 + Math.random() * 3, color: pal.colors[i % pal.colors.length], rot: Math.random() * 6, square: true });
      }
    },
    text(x, y, str, color = '#fff', size = 18) { texts.push({ x, y, str, color, size, t: 0 }); },
    shake(px) { shake = Math.max(shake, px); },
    flash(color, a = 0.35) { flash = a; flashColor = color; },
    update(dt) {
      for (let i = parts.length - 1; i >= 0; i--) {
        const p = parts[i];
        p.t += dt; p.vy += p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; p.rot += dt * 8;
        if (p.t > p.life) parts.splice(i, 1);
      }
      for (let i = texts.length - 1; i >= 0; i--) if ((texts[i].t += dt) > 0.9) texts.splice(i, 1);
      shake *= Math.exp(-10 * dt);
      flash = Math.max(0, flash - dt * 1.4);
    },
    offset: () => (shake < 0.3 ? [0, 0] : [(Math.random() - 0.5) * 2 * shake, (Math.random() - 0.5) * 2 * shake]),
    draw() {
      for (const p of parts) {
        ctx.globalAlpha = Math.min(1, (p.life - p.t) * 3);
        ctx.fillStyle = p.color;
        if (p.square) {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot); ctx.fillRect(-p.r, -p.r * 0.5, 2 * p.r, p.r); ctx.restore();
        } else {
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (1 - p.t / p.life / 2), 0, 7); ctx.fill();
        }
      }
      for (const t of texts) {
        ctx.globalAlpha = Math.min(1, (0.9 - t.t) * 4);
        const s = t.t < 0.12 ? 0.5 + (t.t / 0.12) * 0.7 : t.t < 0.2 ? 1.2 - ((t.t - 0.12) / 0.08) * 0.2 : 1; // pop in, settle
        label(ctx, pal, t.str, t.x, t.y - t.t * 35, t.size * s, { color: t.color });
      }
      ctx.globalAlpha = 1;
    },
    drawFlash() {
      if (flash <= 0) return;
      ctx.globalAlpha = flash; ctx.fillStyle = flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1;
    },
  };
}

// Dark translucent pill with white text; returns its width.
function pill(ctx, text, x, y, align, bg = 'rgba(0,0,0,0.3)', scale = 1) {
  ctx.font = `600 ${15 * scale}px ${FONT}`;
  const w = ctx.measureText(text).width + 20;
  const x0 = align === 'right' ? x - w : x;
  ctx.fillStyle = bg; rr(ctx, x0, y, w, 26 * scale, 13 * scale); ctx.fill();
  ctx.fillStyle = '#fff'; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
  ctx.fillText(text, x0 + 10, y + 13.5 * scale);
  return w;
}

export function run(canvas, { spec, images = [], onEnd = () => {} }, game) {
  destroy();
  const pal = PALETTES[spec.palette];
  const ctx = canvas.getContext('2d');
  // backing store at screen resolution, so the CSS upscale does not blur anything
  const k = Math.min(3, ((canvas.getBoundingClientRect().width || W) * (window.devicePixelRatio || 1)) / W);
  canvas.width = W * k;
  canvas.height = H * k;
  ctx.scale(k, k);
  const bg = background(pal, k);
  const fx = makeFx(ctx, pal);
  const { state } = game;
  let paused = false;
  let last = performance.now();
  let raf = 0;
  let endAt = 0;
  let shown = game.score(state), pop = 0;
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // after the round: 24 dots rising slowly in the palette colours, like dust in light (SPEC-relief 1.2)
  const dots = Array.from({ length: 24 }, (_, i) => ({ x: Math.random() * W, y: Math.random() * H, r: 2 + Math.random() * 2, v: 6 + Math.random() * 8, a: 0.25 + Math.random() * 0.25, c: pal.colors[i % pal.colors.length] }));
  function ambient(dt) {
    ctx.drawImage(bg, 0, 0, W, H);
    for (const d of dots) {
      d.y -= d.v * dt;
      if (d.y < -d.r) { d.y = H + d.r; d.x = Math.random() * W; }
      ctx.globalAlpha = d.a; ctx.fillStyle = d.c;
      ctx.beginPath(); ctx.arc(d.x, d.y, d.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  const onDown = (e) => { if (!paused && game.down) game.down(state, pos(e)); };
  const onMove = (e) => { if (!paused && game.move) game.move(state, pos(e)); };
  const onUp = (e) => { if (game.up) game.up(state, pos(e)); }; // also while paused, so a drag never sticks
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  // WASD / arrows, only for templates that ask for keys; never steals keys from text fields
  const keys = new Set();
  const onKeyDown = (e) => {
    const key = e.key.toLowerCase();
    if (!game.keys || e.target.closest?.('input,textarea') || !/^([wasd]|arrow(up|down|left|right))$/.test(key)) return;
    keys.add(key);
    e.preventDefault(); // arrows would scroll the page
  };
  const onKeyUp = (e) => keys.delete(e.key.toLowerCase());
  const onBlur = () => keys.clear();
  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);

  const ui = {
    pal, fx, t: 0,
    sprite: (s, text, x, y, r, color) => sprite(ctx, pal, images, s, text, x, y, r, color),
    block: (s, text, x, y, size, color) => block(ctx, pal, images, s, text, x, y, size, color),
    label: (str, x, y, size, opts) => label(ctx, pal, str, x, y, size, opts),
    color: (text) => colorFor(pal, text),
  };

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); // clamp so a background tab can't jump the sim
    last = now;
    if (endAt && (game.calm || now - endAt > END_LINGER * 1000)) {
      ambient(dt);
      if (!reduced) raf = requestAnimationFrame(frame); // reduced motion: one still frame
      return;
    }
    if (!paused && !endAt) {
      if (game.keys) game.keys(state, keys);
      game.step(state, dt);
      ui.t += dt;
    }
    if (!paused) fx.update(dt);
    const sc = game.score(state);
    if (sc > shown) pop = 1;
    shown = sc;
    pop = Math.max(0, pop - dt * 4);

    ctx.save();
    ctx.translate(...fx.offset());
    ctx.drawImage(bg, 0, 0, W, H);
    game.draw(ctx, state, ui);
    fx.draw();
    ctx.restore();
    fx.drawFlash();

    if (!game.calm) hud();
    if (paused) {
      ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(0, 0, W, H);
      label(ctx, pal, t('canvas.paused'), W / 2, H / 2, 44);
    }
    if (state.status !== 'playing' && !endAt) {
      endAt = now;
      if (!game.calm) { if (state.status === 'won') fx.confetti(); else { fx.shake(8); fx.flash('#ff3d5a', 0.3); } } // calm = breathing, not a match
      onEnd({ status: state.status, score: sc, message: endMessage(spec, state) });
    }
    if (endAt && !game.calm) banner(now);
    raf = requestAnimationFrame(frame);
  }

  function hud() {
    const sc = shown;
    pill(ctx, game.hud(state), 8, 8, 'left');
    const sec = Math.ceil(state.timeLeft);
    const hurry = sec <= 10 && !endAt;
    const tw = pill(ctx, `⏱ ${sec}`, W - 8, 8, 'right', hurry ? `rgba(255,61,90,${0.75 + 0.25 * Math.sin(ui.t * 10)})` : undefined);
    ctx.save(); // the score pill bounces when the score goes up
    ctx.translate(W - 16 - tw, 21); ctx.scale(1 + pop * 0.25, 1 + pop * 0.25);
    pill(ctx, `⭐ ${sc}`, 0, -13, 'right', 'rgba(0,0,0,0.3)');
    ctx.restore();
  }

  function banner(now) {
    const p = Math.min(1, (now - endAt) / 300);
    const s = 1 + 2.7 * (p - 1) ** 3 + 1.7 * (p - 1) ** 2; // ease-out-back: overshoots, then settles
    ctx.fillStyle = `rgba(0,0,0,${0.25 * p})`; ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.translate(W / 2, H / 2); ctx.rotate(-0.05); ctx.scale(s, s);
    ctx.fillStyle = state.status === 'won' ? '#2ed58f' : '#ff4d6d';
    rr(ctx, -140, -38, 280, 76, 22); ctx.fill();
    ctx.lineWidth = 5; ctx.strokeStyle = '#fff'; ctx.stroke();
    label(ctx, pal, t(state.status === 'won' ? 'canvas.win' : 'canvas.lose'), 0, 2, 40);
    ctx.restore();
  }
  raf = requestAnimationFrame(frame);

  current = {
    togglePause() { paused = !paused; keys.clear(); return paused; },
    destroy() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', onBlur);
    },
  };
  return current;
}

export function destroy() {
  if (current) current.destroy();
  current = null;
}
