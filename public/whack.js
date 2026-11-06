// `whack` template: tap the actors before they vanish.
import { createState, whack, step, score } from './whacklogic.js';
import { t } from './i18n.js';
import { run } from './engine.js';

export function init(canvas, params) {
  const state = createState(params.spec);
  let prev = [], fx = null;
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `🔨 ${s.hits}   ❌ ${s.misses}/${s.maxMisses}`,
    down(s, p) {
      if (!whack(s, p.x, p.y) || !fx) return;
      fx.burst(p.x, p.y, '#fff36b', 18); fx.text(p.x, p.y - 30, t('fx.whack').split('|')[s.hits % 4], '#fff', 22); fx.shake(3);
    },
    draw(ctx, s, ui) {
      fx = ui.fx;
      for (const t of prev) if (!s.targets.includes(t) && t.life <= 0) { fx.text(t.x, t.y - 10, t('fx.miss'), '#ffd0d8', 15); fx.burst(t.x, t.y + t.r * 0.6, 'rgba(255,255,255,0.7)', 6); }
      prev = s.targets.slice();
      for (const t of s.targets) {
        const age = s.ttl - t.life, k = Math.min(1, age / 0.15), pop = k < 1 ? k * 1.15 : 1; // pops out of its hole
        ctx.fillStyle = 'rgba(10,15,40,0.45)'; ctx.beginPath(); ctx.ellipse(t.x, t.y + t.r * 0.85, t.r * 1.25, t.r * 0.42, 0, 0, 7); ctx.fill();
        ui.sprite(t.actor.sprite, t.actor.label, t.x, t.y + (1 - k) * t.r, t.r * pop);
        const left = t.life / s.ttl;
        ctx.lineCap = 'round'; ctx.lineWidth = 5;
        ctx.strokeStyle = 'rgba(255,255,255,0.35)'; ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 7, 0, 7); ctx.stroke();
        ctx.strokeStyle = `hsl(${left * 120}, 95%, 58%)`;
        ctx.beginPath(); ctx.arc(t.x, t.y, t.r + 7, -Math.PI / 2, -Math.PI / 2 + 6.283 * left); ctx.stroke();
        ctx.lineCap = 'butt';
      }
    },
  });
}
