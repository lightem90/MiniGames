// Pure logic for the `blast` template (Block Blast-style): drag pieces onto the grid, full rows and columns clear.
export const N = 8;
export const CELL = 26;
export const GX = 12, GY = 36; // grid origin on the canvas
export const SLOTS = [{ x: 320, y: 70 }, { x: 320, y: 150 }, { x: 320, y: 230 }]; // tray

const SMALL = [[[0, 0]], [[0, 0], [0, 1]], [[0, 0], [1, 0]], [[0, 0], [0, 1], [1, 0], [1, 1]], [[0, 0], [0, 1], [0, 2]], [[0, 0], [1, 0], [2, 0]], [[0, 0], [1, 0], [1, 1]], [[0, 0], [0, 1], [0, 2], [1, 0]]];
const LONG = [[[0, 0], [0, 1], [0, 2], [0, 3]], [[0, 0], [1, 0], [2, 0], [3, 0]]];
const BIG = [[[0, 0], [0, 1], [0, 2], [1, 0], [2, 0]], [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]]];

export const DIFFICULTY = {
  easy: { shapes: SMALL },
  normal: { shapes: SMALL.concat(LONG) },
  hard: { shapes: SMALL.concat(LONG, BIG) },
};

export const size = (cells) => ({ h: Math.max(...cells.map((c) => c[0])) + 1, w: Math.max(...cells.map((c) => c[1])) + 1 });

export function createState(spec, rng = Math.random) {
  const d = DIFFICULTY[spec.difficulty] || DIFFICULTY.normal;
  const s = { actors: spec.actors, grid: new Array(N * N).fill(0), tray: [], placed: 0, cleared: 0, ...d, timeLeft: spec.durationSec, status: 'playing', rng };
  refill(s);
  return s;
}

function refill(s) {
  s.tray = SLOTS.map(() => ({ cells: s.shapes[Math.floor(s.rng() * s.shapes.length)], actor: Math.floor(s.rng() * s.actors.length) }));
}

export const canPlace = (grid, cells, r, c) => cells.every(([dr, dc]) => r + dr >= 0 && r + dr < N && c + dc >= 0 && c + dc < N && !grid[(r + dr) * N + c + dc]);

// Tray piece under (x, y), or -1.
export const pickPiece = (s, x, y) => SLOTS.findIndex((p, i) => s.tray[i] && Math.abs(x - p.x) < 45 && Math.abs(y - p.y) < 40);

// Grid cell for a piece held with its centre at (x, y): the top-left cell of the piece.
export function cellFor(cells, x, y) {
  const { h, w } = size(cells);
  return { r: Math.round((y - GY) / CELL - h / 2), c: Math.round((x - GX) / CELL - w / 2) };
}

// Places tray piece i with its top-left cell at (r, c). Returns true when placed.
export function place(s, i, r, c) {
  const p = s.tray[i];
  if (s.status !== 'playing' || !p || !canPlace(s.grid, p.cells, r, c)) return false;
  for (const [dr, dc] of p.cells) s.grid[(r + dr) * N + c + dc] = p.actor + 1;
  s.placed += p.cells.length;
  s.tray[i] = null;
  const full = [];
  for (let k = 0; k < N; k++) {
    if (s.grid.slice(k * N, k * N + N).every(Boolean)) full.push((j) => k * N + j);
    if (s.grid.every((v, idx) => idx % N !== k || v)) full.push((j) => j * N + k);
  }
  for (const line of full) for (let j = 0; j < N; j++) if (s.grid[line(j)]) { s.grid[line(j)] = 0; s.cleared++; }
  if (s.tray.every((t) => !t)) refill(s);
  if (!s.tray.some((t) => t && s.grid.some((_, idx) => canPlace(s.grid, t.cells, Math.floor(idx / N), idx % N)))) s.status = 'lost';
  return true;
}

export function step(s, dt) {
  if (s.status !== 'playing') return;
  s.timeLeft = Math.max(0, s.timeLeft - dt);
  if (s.timeLeft === 0) s.status = 'won';
}

export const score = (s) => s.placed + s.cleared * 10 + (s.status === 'won' ? 100 : 0);
