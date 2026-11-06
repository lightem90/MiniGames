// `defend` template: actors march in from the left; tap to place turrets (the goal sprite) that stop them.
import { createState, place, step, score, turretsAllowed, LANES } from './defendlogic.js';
import { run, rr, W, H } from './engine.js';

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  let prev = [], fx = null;
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `🛡️ ${s.turrets.length}/${turretsAllowed(s)}   🚪 ${s.leaks}/${s.maxLeaks}`,
    down(s, p) { if (place(s, p.x, p.y) && fx) { fx.burst(p.x, p.y, '#fff', 10); fx.text(p.x, p.y - 24, 'PLACED!', '#fff', 15); } },
    draw(ctx, s, ui) {
      const { pal, sprite, color, label, t } = ui;
      fx = ui.fx;
      for (const y of LANES) {
        ctx.fillStyle = 'rgba(255,255,255,0.22)'; rr(ctx, -10, y - 22, W + 20, 44, 22); ctx.fill();
        ctx.strokeStyle = 'rgba(255,255,255,0.45)'; ctx.lineWidth = 2; ctx.setLineDash([10, 10]); ctx.lineDashOffset = -t * 30;
        ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke(); ctx.setLineDash([]);
      }
      const exit = ctx.createLinearGradient(W - 30, 0, W, 0);
      exit.addColorStop(0, 'rgba(255,61,90,0)'); exit.addColorStop(1, 'rgba(255,61,90,0.55)');
      ctx.fillStyle = exit; ctx.fillRect(W - 30, 30, 30, H - 30);
      for (const e of prev) if (!s.enemies.includes(e)) {
        if (e.x > W) { fx.flash('#ff3d5a', 0.25); fx.shake(5); fx.text(W - 30, e.y, 'LEAK!', '#ffd0d8', 18); }
        else { fx.burst(e.x, e.y, color(e.actor.label), 20); fx.text(e.x, e.y - 20, '+50', '#fff36b', 20); }
      }
      prev = s.enemies.slice();
      for (const tu of s.turrets) {
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.lineWidth = 2; ctx.setLineDash([4, 6]);
        ctx.beginPath(); ctx.arc(tu.x, tu.y, s.range, 0, 7); ctx.stroke(); ctx.setLineDash([]);
        ctx.fillStyle = pal.ink; ctx.beginPath(); ctx.arc(tu.x, tu.y + 4, tu.r + 5, 0, 7); ctx.fill();
        sprite(spec.goal.sprite, spec.goal.label, tu.x, tu.y, tu.r + 2, '#fff');
      }
      for (const e of s.enemies) {
        const y = e.y - Math.abs(Math.sin(t * 9 + e.x * 0.05)) * 4; // marching bob
        sprite(e.actor.sprite, e.actor.label, e.x, y, e.r);
        ctx.fillStyle = 'rgba(0,0,0,0.35)'; rr(ctx, e.x - e.r, y - e.r - 10, 2 * e.r, 6, 3); ctx.fill();
        ctx.fillStyle = `hsl(${(e.hp / e.maxHp) * 120}, 90%, 55%)`; rr(ctx, e.x - e.r, y - e.r - 10, 2 * e.r * (e.hp / e.maxHp), 6, 3); ctx.fill();
      }
      ctx.lineCap = 'round';
      for (const sh of s.shots) {
        ctx.strokeStyle = '#fff36b'; ctx.lineWidth = 6; ctx.beginPath(); ctx.moveTo(sh.x1, sh.y1); ctx.lineTo(sh.x2, sh.y2); ctx.stroke();
        ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.stroke();
      }
      ctx.lineCap = 'butt';
      if (s.turrets.length < turretsAllowed(s)) label('tap to place a turret', W / 2, H - 14, 14);
    },
  });
}
