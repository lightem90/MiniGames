// `trap` template: tap cells to block them, trap the actor before it reaches the edge.
import { createState, cellAt, block, step, score, center, key, ROWS, COLS, CELL } from './traplogic.js';
import { run } from './engine.js';

export function init(canvas, params) {
  const state = createState(params.spec);
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `moves ${s.moves}`,
    down(s, p) { const c = cellAt(p.x, p.y); if (c) block(s, c.r, c.c); },
    draw(ctx, s, { pal, sprite }) {
      for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const p = center(r, c);
        ctx.fillStyle = s.blocked.has(key(r, c)) ? pal.accent : pal.goal;
        ctx.beginPath(); ctx.arc(p.x, p.y, CELL / 2 - 2, 0, 7); ctx.fill();
      }
      const p = center(s.cat.r, s.cat.c);
      sprite(s.actor.sprite, s.actor.label, p.x, p.y, CELL / 2);
    },
  });
}
