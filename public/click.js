// `click` template: tap the goal as fast as you can.
import { createState, tap, step, score } from './clicklogic.js';
import { t } from './i18n.js';
import { run, rr, W, H } from './engine.js';

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  const ripples = [];
  let press = 0, fx = null;
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `👆 ${s.taps}`,
    down(s, p) {
      if (!tap(s, p.x, p.y)) return;
      press = 1;
      ripples.push({ t: 0 });
      if (fx) {
        fx.burst(p.x, p.y, '#fff36b', 6);
        const a = -Math.PI / 2 + (Math.random() - 0.5) * 2.4; // somewhere around the top of the button
        fx.text(s.x + Math.cos(a) * (s.r + 30), s.y + Math.sin(a) * (s.r + 18), s.taps % 10 ? t('fx.muted', { name: s.pop.actor.label }) : `${s.taps}!`, s.taps % 10 ? '#fff' : '#fff36b', s.taps % 10 ? 15 : 26);
      }
    },
    draw(ctx, s, ui) {
      fx = ui.fx;
      for (let i = ripples.length - 1; i >= 0; i--) {
        const r = ripples[i];
        r.t += 0.03;
        if (r.t > 1) { ripples.splice(i, 1); continue; }
        ctx.strokeStyle = `rgba(255,255,255,${1 - r.t})`; ctx.lineWidth = 4;
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r + r.t * 60, 0, 7); ctx.stroke();
      }
      press = Math.max(0, press - 0.2);
      const down = press * 5;
      ctx.fillStyle = ui.pal.ink; ctx.beginPath(); ctx.arc(s.x, s.y + 8, s.r + 4, 0, 7); ctx.fill(); // button base
      ui.sprite(spec.goal.sprite, spec.goal.label, s.x, s.y + down, s.r * (1 - press * 0.04), '#ff3d5a');
      const f = Math.min(1, s.taps / s.goal);
      ctx.fillStyle = 'rgba(0,0,0,0.3)'; rr(ctx, 40, H - 30, W - 80, 18, 9); ctx.fill();
      if (f > 0) { ctx.fillStyle = '#2ed58f'; rr(ctx, 40, H - 30, Math.max(18, (W - 80) * f), 18, 9); ctx.fill(); }
      ui.label(`${s.taps} / ${s.goal}`, W / 2, H - 21, 13);
      if (!s.taps) ui.label(t('hint.click'), W / 2, 60 + Math.sin(ui.t * 6) * 3, 26);
    },
  });
}
