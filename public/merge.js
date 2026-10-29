// `merge` template: slide to aim, release to drop; two of the same actor merge into the next one.
import { createState, aim, drop, step, score, radius, TOP } from './mergelogic.js';
import { run, W } from './engine.js';

export function init(canvas, params) {
  const state = createState(params.spec);
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `merged ${s.merges}`,
    down: (s, p) => aim(s, p.x),
    move: (s, p) => aim(s, p.x),
    up: (s) => drop(s),
    draw(ctx, s, { pal, sprite }) {
      ctx.strokeStyle = pal.goal; ctx.setLineDash([6, 6]);
      ctx.beginPath(); ctx.moveTo(0, TOP); ctx.lineTo(W, TOP); ctx.stroke();
      ctx.setLineDash([]);
      const a = s.actors[s.next];
      sprite(a.sprite, a.label, s.x, TOP - radius(s.next), radius(s.next));
      for (const b of s.balls) sprite(s.actors[b.lvl].sprite, s.actors[b.lvl].label, b.x, b.y, radius(b.lvl));
    },
  });
}
