// `merge` template: slide to aim, release to drop; two of the same actor merge into the next one.
import { createState, aim, drop, step, score, radius, TOP } from './mergelogic.js';
import { run, rr, W, H } from './engine.js';

export function init(canvas, params) {
  const state = createState(params.spec);
  const seen = new WeakSet();
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `🔗 ${s.merges}`,
    down: (s, p) => aim(s, p.x),
    move: (s, p) => aim(s, p.x),
    up: (s) => drop(s),
    draw(ctx, s, { sprite, fx, color, t }) {
      ctx.fillStyle = 'rgba(255,255,255,0.16)'; rr(ctx, 2, TOP, W - 4, H - TOP + 20, 20); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.6)'; ctx.lineWidth = 3; ctx.stroke();
      const danger = s.over > 0;
      ctx.strokeStyle = danger ? `rgba(255,61,90,${0.6 + 0.4 * Math.sin(t * 20)})` : 'rgba(255,255,255,0.7)';
      ctx.lineWidth = danger ? 4 : 2; ctx.setLineDash([8, 8]);
      ctx.beginPath(); ctx.moveTo(0, TOP); ctx.lineTo(W, TOP); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,0.4)'; ctx.lineWidth = 2; // drop guide
      ctx.beginPath(); ctx.moveTo(s.x, TOP); ctx.lineTo(s.x, H); ctx.stroke();
      ctx.setLineDash([]);
      const a = s.actors[s.next];
      sprite(a.sprite, a.label, s.x, TOP - radius(s.next) + Math.sin(t * 5) * 2, radius(s.next));
      for (const b of s.balls) {
        // a ball born from a merge starts at rest; a dropped one is already falling by the first draw
        if (!seen.has(b)) { seen.add(b); if (b.vx === 0 && b.vy === 0) { fx.burst(b.x, b.y, color(s.actors[b.lvl].label), 22); fx.text(b.x, b.y - radius(b.lvl) - 8, `+${b.lvl * 10}`, '#fff36b', 20); fx.shake(2 + b.lvl); } }
        sprite(s.actors[b.lvl].sprite, s.actors[b.lvl].label, b.x, b.y, radius(b.lvl));
      }
    },
  });
}
