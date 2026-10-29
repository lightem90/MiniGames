// Shared canvas loop for every template: pointer mapping, pause, dt clamp, HUD, end callback.
// A template gives { state, step, draw, hud, score, down?, move?, up? }; its logic module stays DOM-free.
import { PALETTES } from './spec.js';

export const W = 400;
export const H = 300;

let current = null;

// Round status ('won'/'lost') -> the spec message ('win'/'lose'). Shared by every template.
export const endMessage = (spec, state) => spec.messages[state.status === 'won' ? 'win' : 'lose'];

// A label that fits on a disc: short names as they are, long ones as initials ("Veryverylongname Surnamesuperlong" -> "VS").
export const short = (label) => (label.length <= 8 ? label : label.split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 3));

// Draws an actor/goal sprite as a shaded ball with a drop shadow: uploaded face, emoji, or label.
export function sprite(ctx, pal, images, s, label, x, y, r) {
  ctx.save();
  ctx.shadowColor = 'rgba(0,0,0,0.45)'; ctx.shadowBlur = r * 0.5; ctx.shadowOffsetY = r * 0.2;
  ctx.fillStyle = pal.accent;
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
  ctx.restore();
  ctx.save();
  ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
  const img = s.startsWith('img:') && images[+s.slice(4)];
  if (img) ctx.drawImage(img, x - r, y - r, 2 * r, 2 * r);
  // light from the top left, darker rim: the "3D" is just this gradient
  const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, r * 0.1, x, y, r);
  g.addColorStop(0, 'rgba(255,255,255,0.45)'); g.addColorStop(0.5, 'rgba(255,255,255,0)'); g.addColorStop(1, 'rgba(0,0,0,0.4)');
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, 2 * r, 2 * r);
  ctx.restore();
  if (img) return;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  if (s.startsWith('emoji:')) {
    ctx.font = `${r * 1.4}px sans-serif`;
    ctx.fillText(s.slice(6), x, y + 1);
  } else {
    ctx.fillStyle = pal.bg;
    ctx.font = `bold ${Math.max(9, r * 0.55)}px sans-serif`;
    ctx.fillText(short(label), x, y);
  }
}

export function run(canvas, { spec, images = [], onEnd = () => {} }, game) {
  destroy();
  const pal = PALETTES[spec.palette];
  const ctx = canvas.getContext('2d');
  // backing store at screen resolution, so the CSS upscale does not blur everything
  const k = Math.min(3, ((canvas.getBoundingClientRect().width || W) * (window.devicePixelRatio || 1)) / W);
  canvas.width = W * k;
  canvas.height = H * k;
  ctx.scale(k, k);
  const { state } = game;
  let paused = false;
  let last = performance.now();
  let raf = 0;
  let ended = false;

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

  const ui = { pal, sprite: (s, label, x, y, r) => sprite(ctx, pal, images, s, label, x, y, r) };

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); // clamp so a background tab can't jump the sim
    last = now;
    if (!paused) game.step(state, dt);
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    game.draw(ctx, state, ui);
    ctx.fillStyle = pal.fg; ctx.font = '14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${game.hud(state)}   ${Math.ceil(state.timeLeft)}s${paused ? '   paused' : ''}`, 8, 8);
    if (state.status !== 'playing' && !ended) {
      ended = true;
      onEnd({ status: state.status, score: game.score(state), message: endMessage(spec, state) });
      return;
    }
    raf = requestAnimationFrame(frame);
  }
  raf = requestAnimationFrame(frame);

  current = {
    togglePause() { paused = !paused; return paused; },
    destroy() {
      cancelAnimationFrame(raf);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    },
  };
  return current;
}

export function destroy() {
  if (current) current.destroy();
  current = null;
}
