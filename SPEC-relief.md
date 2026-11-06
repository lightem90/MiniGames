# Spec — Relief layer (steps 1–3)

**Status:** draft for review, 2026-11-06. Not implemented.
**Goal:** the page should feel like a place to breathe for a stressed person on a call, not only a distraction.
**Constraints inherited from the GDD:** 20–40% attention, half-visible tab, sound off, screen-share safe, window ≥ 400×300, no accounts, no database, nothing stored, no claims of therapy.
**Where relief happens:** only in the moments the player is already waiting — the "Building…" wait, the pause, and the end screen. Never during play.

Each step lists: what the user sees, what changes in the code, acceptance criteria (checkable by hand or by test), and what is out of scope.

---

## Step 1 — The screen is the calm (no content, no licensing)

### 1.1 Palette and surface

User sees: softer, warmer dark surfaces; rounded controls; more air between elements. The four palettes keep their names and their role in the spec (`palette` enum in `public/spec.js` is unchanged, so old share links still work).

Changes:
- `public/spec.js` → `PALETTES`: lower-contrast values. Rule: background/foreground contrast stays ≥ 7:1 for text (WCAG AAA) but accent and goal colours are desaturated ~20% and the goal disc is ≤ 1.6× lighter than the background. Final values are a design choice; the test only checks text contrast.
- `public/style.css`: page background matches `PALETTES[spec.palette].bg` (today the page is hard-coded `#10243f`); `button` gets `border-radius: 10px`, no border, 44px minimum hit height; `main` padding 16px→20px; `h1` weight 600 not bold; line-height 1.5 on paragraphs.
- The page background follows the game palette: `app.js` `start()` sets `document.body.style.background = PALETTES[s.palette].bg`.

Acceptance:
- A unit test in `test/spec.test.js` computes WCAG contrast for every palette's `fg` on `bg` and asserts ≥ 7.
- Buttons are ≥ 44px tall on the phone viewport (Playwright check already exists in the mobile smoke; extend it).
- No change to `encodeSpec`/`decodeSpec` output: existing share-link tests stay green.

### 1.2 Slow life in the background

User sees: behind the canvas, a gradient that drifts very slowly (one full cycle 90 s) between `bg` and `goal` of the palette. On the end screen the canvas is not frozen: 20–30 dots in the palette colours drift upward slowly, like dust in light.

Changes:
- `public/style.css`: `body` gets `background: linear-gradient(...)`, `background-size: 200% 200%`, and a 90 s `@keyframes` animation. `@media (prefers-reduced-motion: reduce)` turns the animation off.
- `public/engine.js`: when the round ends (`state.status !== 'playing'`), instead of `return` after `onEnd`, the loop keeps running an `ambient(ctx, pal, t)` drawer: particles only, no HUD, no game state. Particle count 24, speed 6–14 px/s, radius 2–4, alpha 0.25–0.5, respawn at the bottom. `destroy()` stops it as today.
- `prefers-reduced-motion` also disables the particles (`matchMedia` check once at `run()`).

Acceptance:
- With `prefers-reduced-motion: reduce` emulated in Playwright: no `@keyframes` running and the canvas is static after the round.
- Ambient loop costs < 2% CPU on a laptop at 60 fps (check with the Performance tab once; particles are 24 arcs, nothing else).
- `togglePause()` during ambient does nothing harmful (no exception; the HUD is not drawn).

### 1.3 Pacing and tone

User sees: the end panel fades in over 1 s; no flash, no red. The lose message is kind, never mocking the player.

Changes:
- `public/style.css`: `#end` gets `animation: fadein 1s ease-out`.
- `llm.js` `SYSTEM` prompt, Rules line: add "messages.lose is kind to the player and never mocks them; messages.win is quiet, not triumphant."
- `public/spec.js` defaults: `lose` becomes "That's enough for today. The meeting will end." (current: "Let's take this offline.") — review wording.

Acceptance:
- `test/server.test.js` already checks the prompt text; add an assertion that the prompt contains "never mocks".
- Manual: lose a round, nothing on the screen is red or flashing.

Out of scope for step 1: sound, dark/light theme switch, custom fonts (system font stays: zero load time), any image.

---

## Step 2 — Breathing ring

### 2.1 What the user sees

On the end screen a fourth button **Breathe** (next to Play again / Copy link / Remix). Tapping it replaces the ambient canvas with a single circle in the palette accent colour on the palette background and a one-word caption under it:

| phase | seconds | circle | caption |
|---|---|---|---|
| inhale | 4 | grows from r=40 to r=110 (ease-in-out) | "in" |
| hold | 2 | stays at 110 | "hold" |
| exhale | 6 | shrinks to 40 (ease-in-out) | "out" |

Three cycles (36 s), then a 2 s rest, then back to the end screen with the ambient dots. Tapping the canvas or any button at any time stops it immediately (no penalty, no "are you sure"). No countdown, no score, no text other than the one word. Sound off, as everywhere.

### 2.2 Changes

- `public/breathelogic.js` (pure, ~30 lines): `createState()` → `{ t: 0, cycles: 3 }`; `step(state, dt)`; `phase(state)` → `{ name: 'in'|'hold'|'out'|'done', r: number, progress: 0..1 }`. Timings are constants `IN = 4, HOLD = 2, OUT = 6`. Eased radius: `40 + 70 * ease(progress)`.
- `public/breathe.js` (canvas, ~25 lines): uses `engine.run()` with `step`, `draw` (one arc + one word), `hud: () => ''`, and a `down` handler that sets `state.done = true`. `status` is `'playing'` until done; the engine's `onEnd` returns the player to the end screen. The HUD line in `engine.js` must be skippable: add an optional `game.noHud` flag (one `if`).
- `public/app.js`: `$('breathe').onclick` → `breathe.init(canvas, { spec, onEnd: showEnd })`. The end panel hides while breathing and shows again after.
- `public/index.html`: the button; `aria-label="Thirty-second breathing exercise"`.

### 2.3 Acceptance

- `test/breathelogic.test.js`: after 4 s phase is `hold` at r=110; after 6 s phase is `out`; after 12 s a new cycle starts; after 36 s `done`; radius never leaves [40, 110]; `dt` clamped at 0.05 s by the engine so a background tab does not skip phases.
- Playwright: click Breathe → canvas shows a circle, end panel hidden → click canvas → end panel back within one frame; no console errors.
- Copy check: the word "anxiety", "therapy", "stress relief" or any medical claim appears nowhere in the UI. The button says "Breathe", the aria-label says "breathing exercise". Nothing more.

Out of scope: adjustable timings, sound, haptics, a "streak", any persistence.

---

## Step 3 — Relieving information (curated, sourced)

### 3.1 What the user sees

Under the end message, one line of good news about the world with the year and the source as a link, in the muted style. Example: *"Extreme poverty fell from 38% of people in 1990 to under 9% in 2024. — World Bank"*. One entry per end screen, random, never the same twice in a row within the session. Optionally the LLM adds one kind closing line of its own (not a fact) above it.

### 3.2 Changes

- `public/good-news.json`: an array of `{ "text": str ≤ 160 chars, "source": str, "url": https URL, "year": int }`. Target 40–60 entries at launch.
- Content rules (enforced by review, partly by test):
  1. Every entry has a primary source (Our World in Data, World Bank, WHO, UN, Gapminder, a national statistics office, a peer-reviewed paper). Licence must allow quoting: CC-BY or public data.
  2. Facts are long-run trends (decades), not news of the week; they age slowly and the year makes ageing visible.
  3. Nothing political or contested, nothing about a named person, company or country as a villain, no health advice, no money advice.
  4. Tone: plain statement, no exclamation marks, no "you", no comparison with the reader's problems.
  5. Numbers are copied from the source, not rounded by us beyond what the source does.
- `public/spec.js`: new optional `messages.calm` (≤ 120 chars, `clean()` like the others, default empty). `llm.js` prompt: "messages.calm: one kind, plain closing sentence for the player; no advice, no facts, no numbers, no exclamation marks." This is the only LLM-written relief text; the LLM never writes facts.
- `public/app.js`: `onEnd` picks an entry (`pickNews(list, lastIndex, rng)` in a small pure helper) and fills `#news` with the text and the link (`rel="noopener"`, opens in a new tab). The fetch of `good-news.json` happens once at page load; if it fails, the line is simply absent.
- `server.js` `TYPES`: add `'.json': 'application/json'`.
- `.dockerignore`/`Dockerfile`: nothing to change, `public/` is copied whole.

### 3.3 Acceptance

- `test/goodnews.test.js`: the file parses; every entry has `text` ≤ 160, non-empty `source`, `url` starting with `https://`, `year` between 1990 and the current year; no entry contains `!`, `you`, `your`, or a URL in `text`; no two entries have the same `text`.
- `pickNews` never returns the same index twice in a row when the list has ≥ 2 entries (unit test with a fixed rng).
- `test/spec.test.js`: `messages.calm` is capped at 120 chars and defaults to empty; share links round-trip it.
- Before shipping: the full list is reviewed by Matteo (it is his voice on the page). Any entry he would not say out loud in a meeting is removed.

Out of scope: live feeds, images, localisation (English only for now; Italian would be a second file later), personalisation.

---

## Order and effort

1. Step 1 (half a day): pure code, no decisions beyond colour values.
2. Step 2 (two hours): pure code, fully testable.
3. Step 3 (half a day of code, plus curation time): needs the list reviewed before it ships.

## Open questions for review

- 1.1: keep four palettes or drop to two calmer ones? (Dropping breaks nothing: unknown palette names already fall back.)
- 2.1: 4-2-6 timing or 4-7-8? 4-2-6 keeps the whole thing under 40 s, which fits the "between two agenda points" use.
- 3.1: should the fact also appear during the "Building…" wait? It is 1–3 s today, probably too short to read.
- 3.2: English only at launch, or EN + IT from day one?
