// `helix` template: drag sideways to slide the rings; fall through the gaps, never onto an actor.
import { createState, rotate, gapX, step, score, CX, BALL_R, RING_H } from './helixlogic.js';
import { run, rr, W } from './engine.js';

export function init(canvas, params) {
  const { spec } = params;
  const state = createState(spec);
  state.lastX = null;
  let passed = 0, vy = 0, squash = 0;
  const trail = [];
  return run(canvas, params, {
    state,
    step,
    score,
    hud: (s) => `⬇️ ${s.passed}`,
    down: (s, p) => { s.lastX = p.x; },
    move: (s, p) => { if (s.lastX !== null) { rotate(s, p.x - s.lastX); s.lastX = p.x; } },
    up: (s) => { s.lastX = null; },
    draw(ctx, s, { pal, sprite, fx, label }) {
      // a segment of length len starting at x, wrapped around the screen edge
      const seg = (x, y, len, h, fill) => {
        x = ((x % W) + W) % W;
        ctx.fillStyle = fill;
        rr(ctx, x, y, Math.min(len, W - x), h, 6); ctx.fill();
        if (x + len > W) { rr(ctx, 0, y, x + len - W, h, 6); ctx.fill(); }
      };
      s.rings.forEach((r, i) => {
        const g = gapX(s, r), n = s.passed + i, plat = pal.colors[n % pal.colors.length];
        const safe = g + s.gapW + s.badW, safeLen = W - s.gapW - s.badW;
        seg(safe, r.y + 5, safeLen, RING_H + 6, 'rgba(0,0,0,0.25)'); // side of the platform
        seg(safe, r.y, safeLen, RING_H + 6, plat);
        seg(safe + 4, r.y + 2, safeLen - 8, 3, 'rgba(255,255,255,0.45)');
        seg(g + s.gapW, r.y + 5, s.badW, RING_H + 6, '#a3122e');
        seg(g + s.gapW, r.y, s.badW, RING_H + 6, '#ff3d5a');
        const a = s.actors[r.actor];
        sprite(a.sprite, a.label, (g + s.gapW + s.badW / 2) % W, r.y - 8, 13);
      });
      const b = s.ball;
      if (vy > 0 && b.vy < 0) { squash = 1; fx.burst(CX, b.y + BALL_R, pal.colors[0], 6); }
      vy = b.vy;
      if (s.passed > passed) { fx.text(CX + 45, b.y, s.passed % 5 ? '+10' : 'GREAT!', '#fff36b', s.passed % 5 ? 18 : 24); fx.burst(CX, b.y, '#fff', 8); }
      passed = s.passed;
      if (s.status === 'lost' && squash >= 0) { squash = -1; fx.burst(CX, b.y, '#ff3d5a', 30); }
      trail.unshift(b.y); trail.length = Math.min(trail.length, 6);
      trail.forEach((y, i) => { ctx.fillStyle = `rgba(255,255,255,${0.25 - i * 0.04})`; ctx.beginPath(); ctx.arc(CX, y - i * 2, BALL_R + 2 - i, 0, 7); ctx.fill(); });
      const k = Math.max(0, squash);
      ctx.save(); ctx.translate(CX, b.y); ctx.scale(1 + 0.35 * k, 1 - 0.3 * k);
      sprite(spec.goal.sprite, spec.goal.label, 0, 0, BALL_R + 3, '#fff');
      ctx.restore();
      squash = squash > 0 ? Math.max(0, squash - 0.12) : squash;
      if (s.passed === 0) label('drag sideways to spin the rings', W / 2, 286, 13);
    },
  });
}
