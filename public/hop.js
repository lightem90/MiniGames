// `hop` template: tap ahead to hop a lane, tap left/right to step aside; actors drive across the roads.
import { createState, tap, step, score, cam, rowY, LANE, PR } from './hoplogic.js';
import { t } from './i18n.js';
import { run, rr, W } from './engine.js';

// a little car with the actor as the driver; dir = 1 drives right
function car(ctx, sprite, color, a, x, y, dir) {
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, x - 21, y - 6, 44, 18, 7); ctx.fill();
  ctx.fillStyle = '#222';
  for (const wx of [-14, 9]) { rr(ctx, x + wx - 1, y - 12, 7, 4, 2); ctx.fill(); rr(ctx, x + wx - 1, y + 8, 7, 4, 2); ctx.fill(); }
  ctx.fillStyle = color(a.label); rr(ctx, x - 22, y - 10, 44, 20, 7); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, x - 19, y - 8, 38, 4, 2); ctx.fill();
  ctx.fillStyle = '#fff36b'; rr(ctx, x + dir * 20 - 2, y - 7, 4, 4, 1); ctx.fill(); rr(ctx, x + dir * 20 - 2, y + 3, 4, 4, 1); ctx.fill();
  sprite(a.sprite, a.label, x - dir * 3, y - 1, 10);
}

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  let lives = state.lives, best = 0, hopT = 1, px = state.player.x, py = 0;
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `${'❤️'.repeat(Math.max(0, s.lives))}  🏁 ${s.best}`,
    down: (s, p) => { tap(s, p.x); hopT = 0; },
    draw(ctx, s, { sprite, fx, color, label }) {
      for (let k = Math.max(0, cam(s) - 1); k <= cam(s) + 9; k++) {
        const l = s.lanes[k], y = rowY(s, k);
        if (!l) continue;
        if (l.road) {
          ctx.fillStyle = '#4b4f5c'; ctx.fillRect(0, y - LANE / 2, W, LANE);
          ctx.fillStyle = 'rgba(255,255,255,0.7)';
          for (let x = (k * 37) % 40; x < W; x += 40) ctx.fillRect(x, y - 1, 18, 2);
        } else {
          ctx.fillStyle = k % 2 ? '#7ed957' : '#6cc94a'; ctx.fillRect(0, y - LANE / 2, W, LANE);
          ctx.fillStyle = '#5bb83c';
          for (let i = 0; i < 5; i++) { const x = ((k * 97 + i * 83) % W); ctx.beginPath(); ctx.arc(x, y + ((k + i) % 3) * 5 - 5, 3, 0, 7); ctx.fill(); }
        }
      }
      for (let k = cam(s); k <= cam(s) + 9; k++) {
        const l = s.lanes[k];
        if (!l || !l.road) continue;
        const a = s.actors[l.actor], y = rowY(s, k);
        for (const x of l.cars) for (const wx of [x - W, x, x + W]) if (wx > -30 && wx < W + 30) car(ctx, sprite, color, a, wx, y, l.dir);
      }
      const p = s.player;
      if (s.lives < lives) { fx.shake(9); fx.flash('#ff3d5a'); fx.burst(p.x, rowY(s, p.row), '#ff3d5a', 24); fx.text(p.x, rowY(s, p.row) - 30, t('fx.beep'), '#ffd0d8', 20); }
      lives = s.lives;
      if (s.best > best) fx.text(p.x + 30, rowY(s, p.row) - 10, '+10', '#fff36b', 16);
      best = s.best;
      hopT = Math.min(1, hopT + 0.12);
      px += (p.x - px) * 0.5; py += (rowY(s, p.row) - py) * 0.5; // glide to the new cell
      const jump = Math.sin(hopT * Math.PI) * 10;
      sprite(spec.goal.sprite, spec.goal.label, px, py - jump, PR + 1, '#fff');
      if (s.best === 0) label(t('hint.hop'), W / 2, 286, 13);
    },
  });
}
