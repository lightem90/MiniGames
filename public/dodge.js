// `dodge` template: drag your avatar (the goal sprite) left/right, dodge the falling actors.
import { createState, moveTo, step, score } from './dodgelogic.js';
import { t } from './i18n.js';
import { run, W, H } from './engine.js';

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  let lives = state.lives;
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `${'❤️'.repeat(Math.max(0, s.lives))}  🙌 ${s.dodged}`,
    down: (s, p) => moveTo(s, p.x),
    move: (s, p) => moveTo(s, p.x),
    draw(ctx, s, { sprite, fx, color, t }) {
      ctx.fillStyle = 'rgba(255,255,255,0.25)'; ctx.fillRect(0, H - 10, W, 10);
      for (const it of s.items) { // speed trail, then the item
        ctx.fillStyle = color(it.actor.label);
        for (let i = 3; i >= 1; i--) { ctx.globalAlpha = 0.12 * (4 - i); ctx.beginPath(); ctx.arc(it.x, it.y - i * 9, it.r * (1 - i * 0.15), 0, 7); ctx.fill(); }
        ctx.globalAlpha = 1;
        sprite(it.actor.sprite, it.actor.label, it.x, it.y, it.r);
      }
      const p = s.player;
      if (s.lives < lives) { fx.shake(8); fx.flash('#ff3d5a'); fx.burst(p.x, p.y, '#ff3d5a', 20); fx.text(p.x, p.y - 36, t('fx.ouch'), '#ffd0d8', 22); }
      lives = s.lives;
      sprite(spec.goal.sprite, spec.goal.label, p.x, p.y - Math.abs(Math.sin(t * 9)) * 3, p.r + 2, '#fff');
    },
  });
}
