// `sink` template: canvas rendering + pointer input on top of sinklogic.js (GDD §5).
// Contract: init(canvas, params) / destroy(). params = { spec, images: [canvas|img], onEnd(result) }.
import { W, H, createState, pickBall, flick, step, score, endMessage } from './sinklogic.js';
import { PALETTES } from './spec.js';

const FLICK_GAIN = 6; // drag px -> px/s

let current = null;

export function init(canvas, params) {
  destroy();
  const { spec, images = [], onEnd = () => {} } = params;
  const pal = PALETTES[spec.palette];
  const ctx = canvas.getContext('2d');
  canvas.width = W;
  canvas.height = H;

  let state = createState(spec);
  let paused = false;
  let drag = null; // { i, x0, y0, x, y }
  let last = performance.now();
  let raf = 0;
  let ended = false;

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    return { x: ((e.clientX - r.left) * W) / r.width, y: ((e.clientY - r.top) * H) / r.height };
  };
  const onDown = (e) => {
    if (paused) return;
    const p = pos(e);
    const i = pickBall(state, p.x, p.y);
    if (i >= 0) drag = { i, x0: p.x, y0: p.y, x: p.x, y: p.y };
  };
  const onMove = (e) => { if (drag) Object.assign(drag, pos(e)); };
  const onUp = () => {
    if (!drag) return;
    // pull back like a slingshot: ball goes opposite to the drag
    flick(state, drag.i, (drag.x0 - drag.x) * FLICK_GAIN, (drag.y0 - drag.y) * FLICK_GAIN);
    drag = null;
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  window.addEventListener('pointerup', onUp);

  function sprite(s, label, x, y, r) {
    if (s.startsWith('img:') && images[+s.slice(4)]) {
      ctx.save();
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.clip();
      ctx.drawImage(images[+s.slice(4)], x - r, y - r, 2 * r, 2 * r);
      ctx.restore();
      return;
    }
    ctx.fillStyle = pal.accent;
    ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill();
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if (s.startsWith('emoji:')) {
      ctx.font = `${r * 1.4}px sans-serif`;
      ctx.fillText(s.slice(6), x, y + 1);
    } else {
      ctx.fillStyle = pal.bg;
      ctx.font = `bold ${Math.max(9, r * 0.5)}px sans-serif`;
      ctx.fillText(label.slice(0, 8), x, y);
    }
  }

  function draw() {
    ctx.fillStyle = pal.bg;
    ctx.fillRect(0, 0, W, H);
    const h = state.hole;
    ctx.fillStyle = pal.goal;
    ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.fill();
    sprite(spec.goal.sprite, spec.goal.label, h.x, h.y, h.r * 0.6);
    for (const b of state.balls) if (!b.sunk) sprite(b.actor.sprite, b.actor.label, b.x, b.y, b.r);
    if (drag) {
      const b = state.balls[drag.i];
      ctx.strokeStyle = pal.fg; ctx.setLineDash([4, 4]);
      ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + drag.x0 - drag.x, b.y + drag.y0 - drag.y); ctx.stroke();
      ctx.setLineDash([]);
    }
    ctx.fillStyle = pal.fg; ctx.font = '14px sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    ctx.fillText(`${state.sunk}/${state.balls.length}   ${Math.ceil(state.timeLeft)}s${paused ? '   paused' : ''}`, 8, 8);
  }

  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); // clamp so a background tab can't jump the sim
    last = now;
    if (!paused) step(state, dt);
    draw();
    if (state.status !== 'playing' && !ended) {
      ended = true;
      onEnd({ status: state.status, score: score(state), message: endMessage(spec, state) });
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
