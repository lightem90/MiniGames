// Breathing ring on the end screen: one circle in the accent colour, one word under it. No HUD, no score, no sound.
import { createState, step, phase, stop } from './breathelogic.js';
import { t } from './i18n.js';
import { run, W } from './engine.js';

export function init(canvas, params) {
  return run(canvas, params, {
    state: createState(),
    step,
    calm: true,
    score: () => 0,
    hud: () => '',
    down: stop,
    draw(ctx, s, { pal, label }) {
      const p = phase(s);
      if (p.name === 'done') return; // the rest: just the background
      ctx.fillStyle = pal.accent; ctx.globalAlpha = 0.9;
      ctx.beginPath(); ctx.arc(W / 2, 135, p.r, 0, 7); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = '#fff'; ctx.lineWidth = 4; ctx.stroke();
      label(t(`breathe.${p.name}`), W / 2, 274, 24);
    },
  });
}
