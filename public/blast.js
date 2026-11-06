// `blast` template: drag a piece from the tray onto the grid; full rows and columns clear.
import { createState, pickPiece, cellFor, canPlace, place, step, score, size, N, CELL, GX, GY, SLOTS } from './blastlogic.js';
import { run, rr } from './engine.js';

export function init(canvas, params) {
  const state = createState(params.spec);
  state.drag = null; // { i, x, y }
  let before = state.grid.slice();
  const drawPiece = (block, s, p, x, y) => { // piece centred on (x, y)
    const { h, w } = size(p.cells);
    const a = s.actors[p.actor];
    for (const [r, c] of p.cells) block(a.sprite, a.label, x + (c - w / 2 + 0.5) * CELL, y + (r - h / 2 + 0.5) * CELL, CELL - 3);
  };
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `✨ ${s.cleared}`,
    down(s, p) {
      const i = pickPiece(s, p.x, p.y);
      if (i >= 0) s.drag = { i, ...p };
    },
    move(s, p) { if (s.drag) Object.assign(s.drag, p); },
    up(s) {
      if (!s.drag) return;
      const { r, c } = cellFor(s.tray[s.drag.i].cells, s.drag.x, s.drag.y);
      place(s, s.drag.i, r, c);
      s.drag = null;
    },
    draw(ctx, s, { block, fx, color, label, t }) {
      const cleared = [];
      before.forEach((v, i) => { if (v && !s.grid[i]) cleared.push([i, v]); });
      before = s.grid.slice();
      for (const [i, v] of cleared) fx.burst(GX + (i % N + 0.5) * CELL, GY + (Math.floor(i / N) + 0.5) * CELL, color(s.actors[v - 1].label), 6);
      const lines = Math.round(cleared.length / N);
      if (lines) { fx.text(GX + (N * CELL) / 2, GY + (N * CELL) / 2, lines > 1 ? `COMBO x${lines}!` : ['GREAT!', 'NICE!', 'CLEAR!'][s.cleared % 3], '#fff36b', 30); fx.shake(3 * lines); }

      ctx.fillStyle = 'rgba(10,15,40,0.3)'; rr(ctx, GX - 6, GY - 6, N * CELL + 12, N * CELL + 12, 14); ctx.fill();
      for (let i = 0; i < N * N; i++) {
        const x = GX + (i % N) * CELL, y = GY + Math.floor(i / N) * CELL;
        const a = s.grid[i] && s.actors[s.grid[i] - 1];
        if (a) block(a.sprite, a.label, x + CELL / 2, y + CELL / 2, CELL - 3);
        else { ctx.fillStyle = 'rgba(255,255,255,0.13)'; rr(ctx, x + 1.5, y + 1.5, CELL - 3, CELL - 3, 6); ctx.fill(); }
      }
      ctx.fillStyle = 'rgba(255,255,255,0.18)'; rr(ctx, 262, 30, 128, 262, 18); ctx.fill();
      s.tray.forEach((p, i) => {
        if (p && !(s.drag && s.drag.i === i)) drawPiece(block, s, p, SLOTS[i].x, SLOTS[i].y + Math.sin(t * 3 + i) * 2);
      });
      if (s.drag) {
        const p = s.tray[s.drag.i];
        const { r, c } = cellFor(p.cells, s.drag.x, s.drag.y);
        if (canPlace(s.grid, p.cells, r, c)) { // ghost of where it lands
          ctx.fillStyle = 'rgba(255,255,255,0.45)';
          for (const [dr, dc] of p.cells) { rr(ctx, GX + (c + dc) * CELL + 1.5, GY + (r + dr) * CELL + 1.5, CELL - 3, CELL - 3, 6); ctx.fill(); }
        }
        drawPiece(block, s, p, s.drag.x, s.drag.y);
      }
      if (s.placed === 0) label('drag a piece onto the grid', GX + (N * CELL) / 2, GY + N * CELL + 14, 13);
    },
  });
}
