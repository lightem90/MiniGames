# MiniGames — Game Design Document

**Working title:** MeetingBreak (placeholder)
**Author:** Matteo Liera
**Date:** 2026-10-28
**Status:** Draft v0.1 — pre-MVP

---

## 1. One-liner

Paste a meeting invite (or a sentence), optionally drop a photo, get a 30-second mindless browser game themed on *that* meeting — and a link to share it with the people suffering next to you.

## 2. Goals and non-goals

**Goals**
- Playable in under 10 seconds from landing on the page. No sign-up, no install.
- Playable one-handed, in a half-visible browser tab, with sound off, during a call.
- Every game feels personal: names, titles and faces come from the user's own context.
- Shareable link is the product. Virality > retention.

**Non-goals (v1)**
- Not a game *creation* tool for creators (Ludo, Rosebud, Crayon already do that).
- No LLM-generated game code. The LLM never writes JavaScript.
- No saved progress, no leaderboards across users.
- Sign-in (Google/Microsoft) exists since 2026-10-29 but is optional, browser-side and stateless: it only names the player. No calendar/Teams/Zoom data access yet.

## 3. Player and context

- Office worker, laptop, in a video call they cannot leave, camera possibly on.
- Attention: 20–40% at best. Interruptions every few seconds.
- Constraints this imposes:
  - Pausable at any moment, no penalty for stopping.
  - One input only: mouse/touch click-or-drag. No keyboard.
  - No sound by default. No full-screen. Window ≥ 400×300 must work.
  - Session length 30–90 seconds, then "play again" or "share".
  - Nothing on screen that looks embarrassing on a screen share (see §9).

## 4. Core loop

1. **Input** — user gives context in one of three ways (any one is enough):
   - free text ("budget review, 14 people, Marco talks too much")
   - pasted meeting invite text or an `.ics` file
   - 1–5 images (faces, logos, objects) → become sprites
2. **Interpret** — LLM turns the input into a `GameSpec` JSON (§6). ~1–2 s.
3. **Build** — client picks the template named in the spec and injects the parameters. Instant.
4. **Play** — 30–90 s round, score at the end.
5. **Share** — "Copy link". Link re-creates the game from the spec (no server-side game state).
6. **Loop** — "Remix" (edit the text, regenerate) or "Play again".

## 5. Game templates (v1)

All templates: single canvas, one input type, time-boxed, score-based, 3 difficulty levels.
Each is a self-contained module exposing `init(canvas, params)` and `destroy()`.

| id | Mechanic | Input | Themable slots | Example theme |
|---|---|---|---|---|
| `sink` | Flick balls into a hole/bin | drag + release | ball faces, hole label, background | colleagues → "Q4 Budget" bin |
| `whack` | Pop targets before they vanish | click | target faces, hammer label | "Mute Marco" |
| `dodge` | Move a dot, avoid falling items | drag | falling item sprites, player sprite | dodge "Action Items" |
| `defend` | Place turrets, stop actors marching across | click | enemy faces, turret sprite | mute the stakeholders |
| `catch` | Move a basket, catch good, avoid bad | drag | good/bad sprites, basket label | catch "Coffee", avoid "Follow-ups" |
| `stack` | Tap to drop blocks, build a tower | click | block labels (agenda points), background | stack the agenda |
| `merge` | Drop balls, two of a kind merge into the next actor (Suika) | drag + release | actors = sizes small→big | merge the attendees |
| `blast` | Drag pieces onto an 8×8 grid, full lines clear (Block Blast) | drag | piece sprites | clear the agenda |
| `helix` | Ball bounces down, slide the rings to fall through gaps (Helix Jump) | drag | player sprite, actors on the bad segments | don't land on Marco |
| `hop` | Tap ahead to hop a lane, aside to step; actors drive across (Crossy Road) | click | player sprite, car sprites | cross the roadmap |
| `click` | Tap the goal as fast as you can (clicker) | click | goal sprite, actor names | mute 100 times |
| `trap` | Block hex cells, corner the first actor before it reaches the edge (Circle the Cat) | click | actor[0] sprite | trap Marco |

MVP shipped `sink`; `whack`, `dodge` and `defend` followed (2026-10-29), then `merge`, `blast`, `helix`, `hop`, `click`, `trap` (2026-10-29, the simplest working version of each). The `goal` slot is the bin / the hammer / the player avatar / the turret respectively. The player can switch template with one tap, like difficulty.

**Difficulty**: `easy | normal | hard` maps to speed, spawn rate and round length. The LLM picks it from meeting duration and tone; the player can override with one tap.

## 6. GameSpec (the contract between LLM and engine)

The LLM outputs *only* this JSON. The client validates it against a JSON Schema and falls back to defaults on any invalid field. Unknown template → `sink`.

```json
{
  "version": 1,
  "template": "sink",
  "title": "Q4 Budget Alignment Survival",
  "subtitle": "Sink every stakeholder before the sync ends",
  "difficulty": "normal",
  "durationSec": 60,
  "palette": "corporate-blue",
  "actors": [
    { "label": "Marco", "role": "enemy", "sprite": "img:0" },
    { "label": "Giulia", "role": "enemy", "sprite": "emoji:🙄" },
    { "label": "Action Items", "role": "enemy", "sprite": "text" }
  ],
  "goal": { "label": "Trash", "sprite": "emoji:🗑️" },
  "messages": {
    "start": "The meeting could have been an email.",
    "win": "Meeting adjourned. You're free.",
    "lose": "Let's take this offline."
  }
}
```

Rules:
- `sprite` is one of `img:<index>` (user upload), `emoji:<char>`, or `text` (label drawn on a circle).
- Max 8 actors. Extra attendees are dropped, not merged.
- Strings are length-capped and sanitised client-side (no HTML).
- The LLM never sees image bytes — only `"user uploaded 2 images"`. Images stay in the browser.

## 7. Input parsing

**Free text** → sent as-is to the LLM.

**Invite text / `.ics`** → parsed client-side (title, description, organizer, attendee display names, duration). Only names and text go to the LLM, **never emails**. Parsing library: a small `.ics` parser (~2 KB) or regex on `SUMMARY`, `DESCRIPTION`, `ATTENDEE;CN=`.

**Images** → client-side only:
- resize to 128×128
- optional background removal (`@imgly/background-removal` in-browser, or skip in MVP and just circle-crop)
- stored in memory / `sessionStorage`, referenced as `img:<n>` in the spec

**Shared links** → spec is base64-encoded in the URL fragment (`#s=...`). Images are *not* in the link; recipients see emoji/text fallbacks unless the sender re-uploads. This is a deliberate privacy choice (§9).

## 8. Architecture

```
Browser (static site)
 ├─ ui/            input form, result screen, share
 ├─ parse/         ics + text extraction
 ├─ spec/          JSON schema + validator + defaults
 ├─ templates/     sink.js, whack.js, ... (plain Canvas 2D)
 └─ sprites/       image resize/crop, emoji rasterising

Edge function (one endpoint: POST /spec)
 └─ prompt + LLM call → GameSpec JSON, validated, returned
```

- **Frontend**: vanilla JS + Canvas 2D (or Phaser 3 if a template needs physics — `sink` is fine with hand-rolled circle physics). Vite for bundling. No framework needed.
- **Backend**: a single serverless function (Cloudflare Workers / Vercel Edge). Its only job is to hide the LLM key, rate-limit, and enforce the schema.
- **LLM**: any model with JSON/structured output. Start with a cheap small model (Haiku-class or an open model on Groq/Cerebras for sub-second latency). Prompt + few-shot examples live in the repo. Cost target: < €0.001 per generation.
- **Hosting**: static on Cloudflare Pages / GitHub Pages. Free tier covers MVP.
- **No database** in v1. Shared games are stateless URLs.

## 9. Privacy, safety, legal

This is the main risk of the project, not the tech.

- **Images never leave the browser.** Not uploaded, not in share links, not logged.
- **Emails never leave the browser.** Only display names reach the LLM.
- **No persistence** of any user input server-side. Logs keep only template id, latency, token count.
- **Content moderation**: LLM system prompt forbids slurs, sexual content, violence beyond cartoon slapstick. Client-side word filter on output as a second net. "Enemy" role is always rendered playfully (bin, mute button, pillow fight) — never weapons, never blood.
- **Screen-share safe**: no rude words in default messages, no imagery that reads as harassment at a glance.
- **Report button** on every shared game page (mailto in MVP).
- **GDPR**: a plain-language privacy note on the landing page. Since nothing personal is stored, there is no data subject request flow to build — but say so explicitly.
- **Terms**: user is responsible for the images they upload; we do not store them.

## 10. Monetization (post-MVP, not in v1 build)

Ordered by expected return for the effort:

1. **Share loop first.** Every shared game page carries a "Make your own" CTA. This is the only growth channel in v1.
2. **Rewarded video** — opt-in ad for an extra round / unlock a template. Highest eCPM format for HTML5 games. Candidates: Google H5 Games Ads, AppLixir. Add only once there is traffic (>10k plays/month), it is worthless before that.
3. **"Pro" tier (€2–3/month or one-off)** — no ads, all templates, custom palette, remove branding from shared links, images embedded in shared links (stored encrypted, 7-day expiry).
4. **B2B / team pack** — HR icebreakers, offsite events, branded template with company colours. Sold by hand, not self-serve.
5. **Distribution** — publish the best templates on Poki / CrazyGames for revenue share as a marketing channel back to the generator.

Banner ads: no. They kill the "fits in a small tab" constraint.

## 11. Metrics (v1)

- Time from landing → first input play (target < 10 s median)
- Generation latency p50 / p95 (target < 2 s / < 4 s)
- Spec validation failure rate (target < 2%)
- Share rate: plays that end in "copy link" (target > 15%)
- K-factor from shared links: new generations per shared game (target > 0.3)

No analytics SDK in MVP; count events in the edge function and a `navigator.sendBeacon` on share click.

## 12. Roadmap

**Week 1 — MVP (`sink` only)**
- [x] Static page: text box, image drop, "Generate" button
- [x] `/spec` edge function with schema validation and fallback
- [x] `sink` template, 3 difficulties, 60 s round, score
- [x] Share link via URL fragment
- [x] Privacy note, report mailto
- [ ] Deploy

**Week 2–3**
- [x] `.ics` / invite-text parser
- [ ] Circle-crop + background removal for uploaded faces
- [x] Templates `whack`, `dodge`
- [x] Mobile layout check

**Week 4+**
- [ ] Templates `catch`, `stack`
- [ ] Rewarded ads behind a feature flag
- [ ] Decide on Pro tier based on share metrics

## 13. Open questions

1. Name and domain.
2. Which LLM provider for MVP — cheapest with reliable JSON mode and EU hosting option?
3. Phaser vs. hand-rolled Canvas: decide after `sink` prototype. If `sink` needs < 300 lines of physics, stay vanilla.
4. Do shared links without images feel "broken" to the recipient? Test with 5 people before building image persistence.
5. Legal review of the "colleague's face in the bin" premise before any public launch — even if we store nothing.

## 14. Reference / prior art

- Ludo.ai Playable Generator, Rosebud AI, Crayon AI, OpenGame — prompt-to-game for creators; none target the throwaway-meeting-toy niche.
- AppLixir / Google H5 Games Ads — rewarded video for HTML5 games.
- Poki, CrazyGames — HTML5 distribution with revenue share.
