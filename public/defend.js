// `defend` template: actors march in from the left; tap to place turrets (the goal sprite) that stop them.
import { createState, place, step, score, turretsAllowed, LANES } from './defendlogic.js';
import { run, W } from './engine.js';

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `turrets ${s.turrets.length}/${turretsAllowed(s)}   leaked ${s.leaks}/${s.maxLeaks}   ko ${s.kills}`,
    down: (s, p) => place(s, p.x, p.y),
    draw(ctx, s, { pal, sprite }) {
      ctx.strokeStyle = pal.goal; ctx.lineWidth = 1;
      for (const y of LANES) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); }
      for (const t of s.turrets) {
        ctx.beginPath(); ctx.arc(t.x, t.y, s.range, 0, 7); ctx.stroke(); // range
        sprite(spec.goal.sprite, spec.goal.label, t.x, t.y, t.r);
      }
      for (const e of s.enemies) {
        sprite(e.actor.sprite, e.actor.label, e.x, e.y, e.r);
        ctx.fillStyle = pal.accent;
        ctx.fillRect(e.x - e.r, e.y - e.r - 6, 2 * e.r * (e.hp / e.maxHp), 3); // hp bar
      }
      ctx.strokeStyle = pal.fg; ctx.lineWidth = 2;
      for (const sh of s.shots) { ctx.beginPath(); ctx.moveTo(sh.x1, sh.y1); ctx.lineTo(sh.x2, sh.y2); ctx.stroke(); }
      if (s.turrets.length < turretsAllowed(s)) {
        ctx.fillStyle = pal.fg; ctx.font = '12px sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'top';
        ctx.fillText('tap to place a turret', W - 8, 8);
      }
    },
  });
}
