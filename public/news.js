// Good-news line on the end screen (SPEC-relief step 3). Pure, so it can be tested.
// Index to show: random, never `last` again when there is a choice; -1 for an empty list.
export function pickNews(list, last = -1, rng = Math.random) {
  const n = Array.isArray(list) ? list.length : 0;
  if (n === 0) return -1;
  const skip = last >= 0 && last < n && n > 1;
  const i = Math.floor(rng() * (skip ? n - 1 : n));
  return skip && i >= last ? i + 1 : i;
}
