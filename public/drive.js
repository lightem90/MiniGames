// `drive` template: steer with WASD/arrows (or hold and drag), dodge the actors on the road.
import { createState, setKeys, pointTo, step, score, meters, ROAD_L, ROAD_R, CAR_W, CAR_H } from './drivelogic.js';
import { t } from './i18n.js';
import { run, rr, W, H } from './engine.js';

const TREES = [[24, 0], [52, 130], [30, 260], [372, 60], [350, 190], [378, 320]];

function car(ctx, x, y, tilt, color) {
  ctx.save();
  ctx.translate(x, y); ctx.rotate(tilt);
  ctx.fillStyle = 'rgba(0,0,0,0.25)'; rr(ctx, -CAR_W / 2 + 3, -CAR_H / 2 + 6, CAR_W, CAR_H, 9); ctx.fill();
  ctx.fillStyle = '#222';
  for (const [wx, wy] of [[-CAR_W / 2 - 3, -15], [CAR_W / 2 - 2, -15], [-CAR_W / 2 - 3, 7], [CAR_W / 2 - 2, 7]]) { rr(ctx, wx, wy, 5, 10, 2); ctx.fill(); }
  ctx.fillStyle = color; rr(ctx, -CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 9); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.35)'; rr(ctx, -CAR_W / 2 + 3, -CAR_H / 2 + 2, CAR_W - 6, 6, 3); ctx.fill();
  ctx.fillStyle = '#bfe9ff'; rr(ctx, -9, -13, 18, 8, 3); ctx.fill(); rr(ctx, -8, 11, 16, 5, 2); ctx.fill();
  ctx.fillStyle = '#fff36b'; rr(ctx, -10, -CAR_H / 2 - 1, 6, 3, 1.5); ctx.fill(); rr(ctx, 4, -CAR_H / 2 - 1, 6, 3, 1.5); ctx.fill();
  ctx.fillStyle = '#ff3d5a'; rr(ctx, -10, CAR_H / 2 - 2, 5, 3, 1.5); ctx.fill(); rr(ctx, 5, CAR_H / 2 - 2, 5, 3, 1.5); ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = '#fff'; rr(ctx, -CAR_W / 2, -CAR_H / 2, CAR_W, CAR_H, 9); ctx.stroke();
  ctx.restore();
}

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  let lives = state.lives, held = false;
  return run(canvas, params, {
    state,
    step,
    score,
    keys: setKeys,
    hud: (s) => `${'❤️'.repeat(Math.max(0, s.lives))}  🏁 ${meters(s)} m`,
    down(s, p) { held = true; pointTo(s, p); },
    move(s, p) { if (held) pointTo(s, p); },
    up(s) { held = false; pointTo(s, null); },
    draw(ctx, s, { pal, sprite, fx, label }) {
      const scroll = s.dist;
      ctx.fillStyle = '#6cc94a'; ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = '#7ed957';
      for (let y = (scroll % 40) - 40; y < H; y += 40) { ctx.fillRect(0, y, ROAD_L, 20); ctx.fillRect(ROAD_R, y, W - ROAD_R, 20); }
      for (const [x, y0] of TREES) { // top-down trees scrolling with the road
        const y = ((y0 + scroll) % 390) - 45;
        ctx.fillStyle = 'rgba(0,0,0,0.18)'; ctx.beginPath(); ctx.ellipse(x + 4, y + 8, 18, 12, 0, 0, 7); ctx.fill();
        ctx.fillStyle = '#2f9e44'; ctx.beginPath(); ctx.arc(x, y, 17, 0, 7); ctx.fill();
        ctx.fillStyle = '#51cf66'; ctx.beginPath(); ctx.arc(x - 4, y - 5, 9, 0, 7); ctx.fill();
      }
      ctx.fillStyle = '#4b4f5c'; ctx.fillRect(ROAD_L, 0, ROAD_R - ROAD_L, H);
      ctx.fillStyle = 'rgba(255,255,255,0.05)'; ctx.fillRect(ROAD_L, 0, 14, H); ctx.fillRect(ROAD_R - 14, 0, 14, H);
      for (let y = (scroll % 24) - 24; y < H; y += 24) { // red/white kerbs
        ctx.fillStyle = '#ff4d4d'; ctx.fillRect(ROAD_L - 8, y, 8, 12); ctx.fillRect(ROAD_R, y, 8, 12);
        ctx.fillStyle = '#fff'; ctx.fillRect(ROAD_L - 8, y + 12, 8, 12); ctx.fillRect(ROAD_R, y + 12, 8, 12);
      }
      ctx.fillStyle = 'rgba(255,255,255,0.85)';
      for (const x of [ROAD_L + (ROAD_R - ROAD_L) / 3, ROAD_L + (2 * (ROAD_R - ROAD_L)) / 3]) {
        for (let y = (scroll % 40) - 40; y < H; y += 40) { rr(ctx, x - 2, y, 4, 20, 2); ctx.fill(); }
      }
      for (const o of s.obstacles) sprite(o.actor.sprite, o.actor.label, o.x, o.y, o.r);
      const c = s.car;
      if (s.lives < lives) { fx.shake(9); fx.flash('#ff3d5a'); fx.burst(c.x, c.y - CAR_H / 2, '#ffb627', 22); fx.text(c.x, c.y - CAR_H, t('fx.crash'), '#ff9aa8', 22); }
      lives = s.lives;
      if (!(s.hurt > 0 && Math.floor(s.hurt * 12) % 2)) { // blinks while invulnerable
        car(ctx, c.x, c.y, (c.vx / 240) * 0.25, pal.colors[0]);
        sprite(spec.goal.sprite, spec.goal.label, c.x, c.y + 1, 8, '#fff');
      }
      if (s.dist < 400) label(t('hint.drive'), W / 2, H - 14, 13); // first seconds only
    },
  });
}
