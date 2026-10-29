// `hop` template: tap ahead to hop a lane, tap left/right to step aside; actors drive across the roads.
import { createState, tap, step, score, cam, rowY, LANE, PR, CR } from './hoplogic.js';
import { run, W } from './engine.js';

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `${'❤'.repeat(Math.max(0, s.lives))}   lanes ${s.best}`,
    down: (s, p) => tap(s, p.x),
    draw(ctx, s, { pal, sprite }) {
      for (let k = cam(s); k < cam(s) + 9; k++) { // 9 lanes fit under the HUD
        const l = s.lanes[k], y = rowY(s, k);
        if (l.road) { ctx.fillStyle = pal.goal; ctx.fillRect(0, y - LANE / 2, W, LANE); }
        const a = s.actors[l.actor];
        for (const x of l.cars) sprite(a.sprite, a.label, x, y, CR);
      }
      sprite(spec.goal.sprite, spec.goal.label, s.player.x, rowY(s, s.player.row), PR);
    },
  });
}
