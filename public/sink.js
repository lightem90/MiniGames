// `sink` template: flick the actors into the bin. Logic in sinklogic.js, loop in engine.js.
import { createState, pickBall, flick, step, score } from './sinklogic.js';
import { run } from './engine.js';

const FLICK_GAIN = 6; // drag px -> px/s

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  state.drag = null; // { i, x0, y0, x, y }
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `${s.sunk}/${s.balls.length}`,
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
    draw(ctx, s, { pal, sprite }) {
      const h = s.hole;
      ctx.fillStyle = pal.goal;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, 7); ctx.fill();
      sprite(spec.goal.sprite, spec.goal.label, h.x, h.y, h.r * 0.6);
      for (const b of s.balls) if (!b.sunk) sprite(b.actor.sprite, b.actor.label, b.x, b.y, b.r);
      if (s.drag) {
        const b = s.balls[s.drag.i];
        ctx.strokeStyle = pal.fg; ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(b.x, b.y); ctx.lineTo(b.x + s.drag.x0 - s.drag.x, b.y + s.drag.y0 - s.drag.y); ctx.stroke();
        ctx.setLineDash([]);
      }
    },
  });
}
