// `whack` template: tap the actors before they vanish.
import { createState, whack, step, score } from './whacklogic.js';
import { run } from './engine.js';

export function init(canvas, params) {
  const state = createState(params.spec);
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `hits ${s.hits}   missed ${s.misses}/${s.maxMisses}`,
    down: (s, p) => whack(s, p.x, p.y),
    draw(ctx, s, { pal, sprite }) {
      for (const t of s.targets) {
        ctx.strokeStyle = pal.fg; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 5, -Math.PI / 2, -Math.PI / 2 + 2 * Math.PI * (t.life / s.ttl)); ctx.stroke(); // time left ring
        sprite(t.actor.sprite, t.actor.label, t.x, t.y, t.r);
      }
    },
  });
}
