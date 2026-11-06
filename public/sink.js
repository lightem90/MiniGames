// `sink` template: flick the actors into the bin. Logic in sinklogic.js, loop in engine.js.
import { createState, pickBall, flick, step, score } from './sinklogic.js';
import { t } from './i18n.js';
import { run } from './engine.js';

const FLICK_GAIN = 6; // drag px -> px/s

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  state.drag = null; // { i, x0, y0, x, y }
  const done = new Set();
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `🗑️ ${s.sunk}/${s.balls.length}`,
    down(s, p) {
      const i = pickBall(s, p.x, p.y);
      if (i >= 0) s.drag = { i, x0: p.x, y0: p.y, x: p.x, y: p.y };
    },
    move(s, p) { if (s.drag) Object.assign(s.drag, p); },
    up(s) {
      if (!s.drag) return;
      // pull back like a slingshot: ball goes opposite to the drag
      flick(s, s.drag.i, (s.drag.x0 - s.drag.x) * FLICK_GAIN, (s.drag.y0 - s.drag.y) * FLICK_GAIN);
      s.drag = null;
    },
    draw(ctx, s, { pal, sprite, fx, color, t }) {
      const h = s.hole;
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.setLineDash([7, 7]); ctx.lineDashOffset = -t * 25;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 12 + Math.sin(t * 4) * 2, 0, 7); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(h.x, h.y, h.r + 5, 0, 7); ctx.fill();
      const g = ctx.createRadialGradient(h.x, h.y - h.r * 0.3, 2, h.x, h.y, h.r);
      g.addColorStop(0, '#0b1033'); g.addColorStop(1, pal.goal);
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.fill();
      sprite(spec.goal.sprite, spec.goal.label, h.x, h.y + Math.sin(t * 3) * 2, h.r * 0.5);
      for (const b of s.balls) {
        if (b.sunk && !done.has(b)) {
          done.add(b);
          fx.burst(h.x, h.y, color(b.actor.label), 24); fx.text(h.x, h.y + h.r + 18, t('fx.sunk'), '#fff36b', 24); fx.shake(4);
        }
        if (!b.sunk) sprite(b.actor.sprite, b.actor.label, b.x, b.y, b.r);
      }
      if (s.drag) { // aim: dots in the shot direction, getting smaller and redder with power
        const b = s.balls[s.drag.i];
        const dx = s.drag.x0 - s.drag.x, dy = s.drag.y0 - s.drag.y, power = Math.min(1, Math.hypot(dx, dy) / 150);
        for (let i = 1; i <= 7; i++) {
          ctx.fillStyle = `hsl(${120 - power * 120}, 95%, 60%)`;
          ctx.beginPath(); ctx.arc(b.x + dx * i * 0.35, b.y + dy * i * 0.35, 5 - i * 0.5, 0, 7); ctx.fill();
        }
        ctx.lineWidth = 5; ctx.lineCap = 'round'; ctx.strokeStyle = `hsl(${120 - power * 120}, 95%, 60%)`;
        ctx.beginPath(); ctx.arc(b.x, b.y, b.r + 7, -Math.PI / 2, -Math.PI / 2 + power * 6.283); ctx.stroke();
        ctx.lineCap = 'butt';
      }
    },
  });
}
