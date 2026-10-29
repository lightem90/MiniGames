// `dodge` template: drag your avatar (the goal sprite) left/right, dodge the falling actors.
import { createState, moveTo, step, score } from './dodgelogic.js';
import { run } from './engine.js';

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `${'❤'.repeat(s.lives)}   dodged ${s.dodged}`,
    down: (s, p) => moveTo(s, p.x),
    move: (s, p) => moveTo(s, p.x),
    draw(ctx, s, { sprite }) {
      for (const it of s.items) sprite(it.actor.sprite, it.actor.label, it.x, it.y, it.r);
      sprite(spec.goal.sprite, spec.goal.label, s.player.x, s.player.y, s.player.r);
    },
  });
}
