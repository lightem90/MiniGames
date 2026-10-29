// `blast` template: drag a piece from the tray onto the grid; full rows and columns clear.
import { createState, pickPiece, cellFor, canPlace, place, step, score, size, N, CELL, GX, GY, SLOTS } from './blastlogic.js';
import { run } from './engine.js';

export function init(canvas, params) {
  const state = createState(params.spec);
  state.drag = null; // { i, x, y }
  const drawPiece = (sprite, s, p, x, y) => { // piece centred on (x, y)
    const { h, w } = size(p.cells);
    const a = s.actors[p.actor];
    for (const [r, c] of p.cells) sprite(a.sprite, a.label, x + (c - w / 2 + 0.5) * CELL, y + (r - h / 2 + 0.5) * CELL, CELL / 2 - 2);
  };
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `cleared ${s.cleared}`,
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
    draw(ctx, s, { pal, sprite }) {
      ctx.strokeStyle = pal.goal;
      for (let i = 0; i < N * N; i++) {
        const x = GX + (i % N) * CELL, y = GY + Math.floor(i / N) * CELL;
        ctx.strokeRect(x + 1, y + 1, CELL - 2, CELL - 2);
        const a = s.grid[i] && s.actors[s.grid[i] - 1];
        if (a) sprite(a.sprite, a.label, x + CELL / 2, y + CELL / 2, CELL / 2 - 2);
      }
      s.tray.forEach((p, i) => { if (p && !(s.drag && s.drag.i === i)) drawPiece(sprite, s, p, SLOTS[i].x, SLOTS[i].y); });
      if (s.drag) {
        const p = s.tray[s.drag.i];
        const { r, c } = cellFor(p.cells, s.drag.x, s.drag.y);
        if (canPlace(s.grid, p.cells, r, c)) { // ghost of where it lands
          ctx.fillStyle = pal.goal;
          for (const [dr, dc] of p.cells) ctx.fillRect(GX + (c + dc) * CELL + 1, GY + (r + dr) * CELL + 1, CELL - 2, CELL - 2);
        }
        drawPiece(sprite, s, p, s.drag.x, s.drag.y);
      }
    },
  });
}
