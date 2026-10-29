// Pure logic for the `trap` template (Circle the Cat-style, hex grid): tap cells to block them, trap the actor before it reaches the edge.
export const ROWS = 9, COLS = 11, CELL = 30;

export const DIFFICULTY = { easy: { preBlocked: 12 }, normal: { preBlocked: 9 }, hard: { preBlocked: 6 } };

export const key = (r, c) => `${r},${c}`;
export const center = (r, c) => ({ x: 25 + c * CELL + (r % 2) * (CELL / 2), y: 45 + r * CELL * 0.87 });
const inside = (r, c) => r >= 0 && r < ROWS && c >= 0 && c < COLS;
const onEdge = (r, c) => r === 0 || r === ROWS - 1 || c === 0 || c === COLS - 1;
// odd-r offset hex neighbours
const neighbours = (r, c) => (r % 2 ? [[r, c - 1], [r, c + 1], [r - 1, c], [r - 1, c + 1], [r + 1, c], [r + 1, c + 1]] : [[r, c - 1], [r, c + 1], [r - 1, c - 1], [r - 1, c], [r + 1, c - 1], [r + 1, c]])
  .filter(([a, b]) => inside(a, b));

export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  const s = { actor: spec.actors[0], cat: { r: 4, c: 5 }, blocked: new Set(), moves: 0, ...d, timeLeft: spec.durationSec, status: 'playing', rng };
  for (let tries = 0; s.blocked.size < d.preBlocked && tries < 200; tries++) {
    const r = Math.floor(rng() * ROWS), c = Math.floor(rng() * COLS);
    if (r !== s.cat.r || c !== s.cat.c) s.blocked.add(key(r, c));
  }
  return s;
}

export const free = (s, r, c) => !s.blocked.has(key(r, c)) && !(r === s.cat.r && c === s.cat.c);

// Cell under (x, y), or null.
export function cellAt(x, y) {
  for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
    const p = center(r, c);
    if (Math.hypot(p.x - x, p.y - y) <= CELL / 2) return { r, c };
  }
  return null;
}

// First step of the shortest free path from the cat to the edge, or null when the edge is unreachable.
function stepToEdge(s) {
  const start = key(s.cat.r, s.cat.c);
  const from = new Map([[start, null]]);
  const queue = [[s.cat.r, s.cat.c]];
  while (queue.length) {
    const [r, c] = queue.shift();
    if (onEdge(r, c) && key(r, c) !== start) {
      let k = key(r, c);
      while (from.get(k) !== start) k = from.get(k);
      return k.split(',').map(Number);
    }
    for (const [a, b] of neighbours(r, c)) if (free(s, a, b) && !from.has(key(a, b))) { from.set(key(a, b), key(r, c)); queue.push([a, b]); }
  }
  return null;
}

// Blocks the cell; the cat then moves. Returns true when the tap counted.
export function block(s, r, c) {
  if (s.status !== 'playing' || !inside(r, c) || !free(s, r, c)) return false;
  s.blocked.add(key(r, c));
  s.moves++;
  const open = neighbours(s.cat.r, s.cat.c).filter(([a, b]) => free(s, a, b));
  if (!open.length) { s.status = 'won'; return true; }
  const [nr, nc] = stepToEdge(s) || open[Math.floor(s.rng() * open.length)];
  s.cat = { r: nr, c: nc };
  if (onEdge(nr, nc)) s.status = 'lost';
  return true;
}

export function step(s, dt) {
  if (s.status !== 'playing') return;
  s.timeLeft = Math.max(0, s.timeLeft - dt);
  if (s.timeLeft === 0) s.status = 'lost';
}

export const score = (s) => (s.status === 'won' ? Math.max(100, 500 - s.moves * 10) + Math.ceil(s.timeLeft) * 5 : 0);
