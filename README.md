# MeetingBreak (working title)

Paste a meeting invite (or drop the .ics, or just describe it), get a 60-second browser game about it, share the link.
Invites are parsed in the browser: names and duration go to the LLM, emails and links never do. Design: see [GDD.md](GDD.md).
Eleven templates, switchable with one tap in the game: `sink` (flick them into the bin), `whack` (tap them before they vanish),
`dodge` (drag your avatar, dodge the follow-ups), `drive` (steer with WASD or drag, dodge them on the road), `defend` (place turrets, stop the march), `merge` (drop and merge, Suika-style),
`blast` (drag blocks onto a grid, clear lines), `helix` (slide the rings, fall through the gaps), `hop` (tap to cross the roads),
`click` (tap the mute button as fast as you can), `trap` (block hex cells, corner the escapee). Uploaded faces become the actors.
"How it works" on the first screen (or `?` next to Pause) runs a guided tour of every control, including each game's rules (`public/tour.js`).

English and Italian: the page follows the browser language, and the LLM writes the game texts in it too. All UI strings are in `public/i18n.js`.

## Run

```
cp .env.example .env        # then put your key in LLM_API_KEY
docker build -t meetingbreak .
docker run --rm -p 8080:8080 --env-file .env meetingbreak
```

Open http://localhost:8080. Without a key the game still works, with simple local specs instead of the LLM.
The build runs the unit tests and fails if one breaks. Without Docker: `npm install` once, `npm test`, then `node --env-file=.env server.js` (Node 20.6+).

## Share links

**Copy link** gives `/g?s=<game>`. That page carries link-preview tags (title, description, a 1200×630 picture drawn by
`og.js` at `/og.png`), so Slack, Teams, WhatsApp and LinkedIn show a real card. The picture has the title, emoji and names, never faces.
Set `PUBLIC_URL` (e.g. `https://meetingbreak.example`) in production so preview URLs are absolute and correct behind a proxy.
Old `#s=` links still open. Without `npm install` the server still runs; previews just have no picture.

**K-factor** (GDD §11), from the server log: `{"event":"share"}` lines are shares, `"via":"share"` on a generation
is a new game made by someone who arrived from a shared link. K ≈ via-share generations / shares.

Emoji in previews: [Twemoji](https://github.com/jdecked/twemoji), CC-BY 4.0 (credited on the page).

## LLM settings (`.env`)

Any OpenAI-compatible chat API works.

| Variable | Default |
|---|---|
| `LLM_API_KEY` | none (fallback mode) |
| `LLM_BASE_URL` | Gemini's OpenAI-compatible endpoint |
| `LLM_MODEL` | see `llm.js` |

The server log prints `"source":"llm"` or `"source":"fallback"` for every request, plus the reason when the LLM call fails.

## Sign-in (optional)

Set `GOOGLE_CLIENT_ID` and/or `MS_CLIENT_ID` in `.env` (setup steps in `.env.example`) and the buttons appear.
Sign-in is browser-side only: name and email stay in memory, nothing is stored, no session. Today it only
tells the game who the player is (so you are never a target). It is the hook for calendar import later (GDD §7).

## Privacy

Uploaded images never leave the browser and are not in share links. Only the typed text (plus your first name, if signed in) is sent to the LLM, with email
addresses removed. Nothing is stored. Share links put the game (title, names, emoji) in the query string so previews work:
our server never logs it, but **turn off query-string logging at your host/proxy**, or those names end up in its access logs. Note: free LLM tiers (for example Gemini's) may use prompts to improve their products.

## Add your own game

Pull requests with new games are welcome. The rules and the steps are in [CONTRIBUTING.md](CONTRIBUTING.md).

## Before a public launch

Real report address (`public/app.js`), real moderation word list (`public/spec.js`), shared rate limiter (`server.js`),
legal review of the premise (GDD §13), and a licence.
