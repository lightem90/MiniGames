// `trap` template: tap cells to block them, trap the actor before it reaches the edge.
import { createState, cellAt, block, step, score, center, key, ROWS, COLS, CELL } from './traplogic.js';
import { t } from './i18n.js';
import { run, rr } from './engine.js';

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  let fx = null, from = center(state.cat.r, state.cat.c), at = from, k = 1;
  const goalEmoji = spec.goal.sprite.startsWith('emoji:') ? spec.goal.sprite.slice(6) : '';
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `🚧 ${s.moves}`,
    down(s, p) {
      const c = cellAt(p.x, p.y);
      if (!c || !block(s, c.r, c.c) || !fx) return;
      const q = center(c.r, c.c);
      fx.burst(q.x, q.y, '#ff9f43', 10); fx.shake(2);
      if (s.status === 'won') fx.text(q.x, q.y - 20, t('fx.trapped'), '#fff36b', 26);
    },
    draw(ctx, s, ui) {
      fx = ui.fx;
      const c0 = center(0, 0), c1 = center(ROWS - 1, COLS - 1);
      ctx.fillStyle = 'rgba(10,15,40,0.25)'; rr(ctx, c0.x - CELL / 2 - 6, c0.y - CELL / 2 - 6, c1.x - c0.x + CELL + 12, c1.y - c0.y + CELL + 14, 16); ctx.fill();
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const p = center(r, c), blocked = s.blocked.has(key(r, c));
        const edge = r === 0 || c === 0 || r === ROWS - 1 || c === COLS - 1;
        ctx.fillStyle = blocked ? '#c4621b' : '#4fae3b';
        ctx.beginPath(); ctx.arc(p.x, p.y + 3, CELL / 2 - 2, 0, 7); ctx.fill();
        ctx.fillStyle = blocked ? '#ff9f43' : edge ? '#b5f09c' : '#8be37a';
        ctx.beginPath(); ctx.arc(p.x, p.y, CELL / 2 - 2, 0, 7); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.ellipse(p.x - 3, p.y - 5, 6, 3, -0.4, 0, 7); ctx.fill();
        if (blocked && goalEmoji) { ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(goalEmoji, p.x, p.y + 1); }
      }
      const to = center(s.cat.r, s.cat.c);
      if (to.x !== at.x || to.y !== at.y) { from = at; at = to; k = 0; }
      k = Math.min(1, k + 0.12);
      const x = from.x + (to.x - from.x) * k, y = from.y + (to.y - from.y) * k - Math.sin(k * Math.PI) * 10;
      ui.sprite(s.actor.sprite, s.actor.label, x, y - 2, CELL / 2 + 1);
      if (!s.moves) ui.label(t('hint.trap'), 200, 290, 13);
    },
  });
}
