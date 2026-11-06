// Pure logic for the breathing ring (SPEC-relief step 2): 4 s in, 2 s hold, 6 s out, three times, then a 2 s rest.
export const IN = 4, HOLD = 2, OUT = 6, CYCLES = 3, REST = 2;
export const R_MIN = 40, R_MAX = 110;
const CYCLE = IN + HOLD + OUT;
const ease = (p) => (1 - Math.cos(Math.PI * p)) / 2; // ease-in-out

// timeLeft/status make it a normal engine game; it "wins" when done or tapped, which returns to the end screen.
export const createState = () => ({ t: 0, timeLeft: CYCLES * CYCLE + REST, status: 'playing' });

export function phase(s) {
  if (s.t >= CYCLES * CYCLE) return { name: 'done', r: R_MIN, progress: 1 };
  const c = s.t % CYCLE;
  if (c < IN) { const p = c / IN; return { name: 'in', r: R_MIN + (R_MAX - R_MIN) * ease(p), progress: p }; }
  if (c < IN + HOLD) return { name: 'hold', r: R_MAX, progress: (c - IN) / HOLD };
  const p = (c - IN - HOLD) / OUT;
  return { name: 'out', r: R_MAX - (R_MAX - R_MIN) * ease(p), progress: p };
}

export function step(s, dt) {
  if (s.status !== 'playing') return;
  s.t += dt;
  s.timeLeft = Math.max(0, CYCLES * CYCLE + REST - s.t);
  if (s.timeLeft === 0) s.status = 'won';
}

export const stop = (s) => { s.status = 'won'; }; // any tap: no penalty, no "are you sure"
