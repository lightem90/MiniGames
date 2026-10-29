// `click` template: tap the goal as fast as you can.
import { createState, tap, step, score } from './clicklogic.js';
import { run } from './engine.js';

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `${s.taps}/${s.goal}`,
    down: (s, p) => tap(s, p.x, p.y),
    draw(ctx, s, { pal, sprite }) {
      sprite(spec.goal.sprite, spec.goal.label, s.x, s.y, s.r + (s.pop ? 4 : 0));
      if (s.pop) {
        ctx.fillStyle = pal.fg; ctx.font = 'bold 16px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(`${s.pop.actor.label} muted`, s.x, s.y - s.r - 20 - (0.5 - s.pop.t) * 30);
      }
    },
  });
}
