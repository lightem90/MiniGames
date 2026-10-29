// `helix` template: drag sideways to slide the rings; fall through the gaps, never onto an actor.
import { createState, rotate, gapX, step, score, CX, BALL_R, RING_H } from './helixlogic.js';
import { run, W } from './engine.js';

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  state.lastX = null;
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `floors ${s.passed}`,
    down: (s, p) => { s.lastX = p.x; },
    move: (s, p) => { if (s.lastX !== null) { rotate(s, p.x - s.lastX); s.lastX = p.x; } },
    up: (s) => { s.lastX = null; },
    draw(ctx, s, { pal, sprite }) {
      for (const r of s.rings) {
        const g = gapX(s, r);
        ctx.fillStyle = pal.goal;
        ctx.fillRect(0, r.y, W, RING_H);
        for (const x of [g, g - W]) { // drawn twice so a segment wrapping past the edge shows on both sides
          ctx.fillStyle = pal.bg;
          ctx.fillRect(x, r.y - 1, s.gapW, RING_H + 2);
          ctx.fillStyle = pal.accent;
          ctx.fillRect(x + s.gapW, r.y, s.badW, RING_H);
          const a = s.actors[r.actor];
          if (x + s.gapW + s.badW / 2 > 0 && x + s.gapW + s.badW / 2 < W) sprite(a.sprite, a.label, x + s.gapW + s.badW / 2, r.y + RING_H / 2, 11);
        }
      }
      sprite(spec.goal.sprite, spec.goal.label, CX, s.ball.y, BALL_R);
    },
  });
}
