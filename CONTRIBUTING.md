# Add your own game

Thanks for wanting to add a game! Every game in MeetingBreak is a 60-second round about a meeting:
the attendees (their names, emoji or uploaded faces) are the characters, and the player beats the meeting.
If your idea fits that, it is welcome.

## The rules

1. **One game per pull request.** Only your three new files plus the few registration lines below.
   Want to change the engine or another game? Open an issue first, then a separate PR.
2. **It plays with one finger and with a mouse.** Keyboard is a nice extra, never required.
3. **The round ends on its own** when the clock runs out (30 to 90 seconds).
4. **Use the meeting.** The actors (`spec.actors`) and the goal (`spec.goal`) are the characters.
   Draw them with `ui.sprite` or `ui.block`, so uploaded faces show up.
5. **Nothing leaves the browser.** No network calls, no storage, no cookies, no tracking.
   Faces and names live in memory for one round. The tests check this.
6. **No dependencies, no build step, no downloaded assets.** Plain JavaScript, canvas drawing and emoji.
7. **Playful, never cruel.** People will play this on a shared screen with the colleagues in it.
   No blood, weapons, slurs or sexual content. Losing is never the player's fault in the text.
8. **Your own work.** The mechanic can be inspired by a known game, but no copied code, art, sounds,
   names or characters.
9. **Every text in English and Italian.** No Italian? Put English in both and say so in the PR; we'll translate.
10. **`npm test` passes.** GitHub runs it on every PR; a red check is not merged.

By opening a PR you agree that your contribution is released under the same licence as the rest of the project.

## How a game is built

A game is two files, plus a test:

| File | What it does |
|---|---|
| `public/<name>logic.js` | The rules. Pure logic, no DOM, no canvas. Exports `createState(spec, rng)`, `step(state, dt)` and `score(state)`. The state has `timeLeft` and `status`: `'playing'`, then `'won'` or `'lost'`. |
| `public/<name>.js` | The drawing and input. Exports `init(canvas, params)` and hands the shared engine (`public/engine.js`) your `state`, `step`, `score`, `hud`, `draw`, and the inputs you need: `down`, `move`, `up`, `keys`. The canvas is 400 × 300. |
| `test/<name>logic.test.js` | At least: one way to win, one way to lose, and one rule of your game. |

`<name>` is one lowercase word, like `hop` or `trap`. The simplest game to copy from is `click`.
Difficulty (`spec.difficulty`: easy, normal, hard) should change something real, like speed or target.

## Step by step

1. Fork the repo and make a branch.
2. Copy `public/click.js`, `public/clicklogic.js` and `test/clicklogic.test.js` to your `<name>` and build your game.
3. Register it (one line or entry each):
   - `public/spec.js`: add `<name>` to `TEMPLATES` and to `TEMPLATE_DEFAULTS` (goal emoji, subtitle and goal label in each language).
   - `public/app.js`: `import * as <name> from './<name>.js';` and add it to `GAMES`.
   - `public/i18n.js`: `controls.<name>` (the rules shown in the tour) in English and Italian, plus any text your game draws, used with `t('key')`.
   - `llm.js`: one short sentence in the `Templates` line, so the AI writes titles and messages that fit.
   - `README.md`: your game in the list.
4. Run `npm test` (Node 20 or newer). If you missed a step, the failing test tells you which one.
5. Play it: `node server.js`, open http://localhost:8080, try it on a phone-sized window too.
6. Open the pull request and fill in the checklist. A short GIF or screenshot helps a lot.

## What happens next

We play every game before merging. We may ask for changes, tweak small things after merging,
or say no when a game does not fit. We'll always tell you why.
