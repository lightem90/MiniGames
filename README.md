# MeetingBreak (working title)

Paste a meeting invite (or drop the .ics, or just describe it), get a 60-second browser game about it, share the link.
Invites are parsed in the browser: names and duration go to the LLM, emails and links never do. Design: see [GDD.md](GDD.md).
Ten templates, switchable with one tap in the game: `sink` (flick them into the bin), `whack` (tap them before they vanish),
`dodge` (drag your avatar, dodge the follow-ups), `defend` (place turrets, stop the march), `merge` (drop and merge, Suika-style),
`blast` (drag blocks onto a grid, clear lines), `helix` (slide the rings, fall through the gaps), `hop` (tap to cross the roads),
`click` (tap the mute button as fast as you can), `trap` (block hex cells, corner the escapee). Uploaded faces become the actors.
"How it works" on the first screen (or `?` next to Pause) runs a guided tour of every control, including each game's rules (`public/tour.js`).

## Run

```
cp .env.example .env        # then put your key in LLM_API_KEY
docker build -t meetingbreak .
docker run --rm -p 8080:8080 --env-file .env meetingbreak
```

Open http://localhost:8080. Without a key the game still works, with simple local specs instead of the LLM.
The build runs the unit tests and fails if one breaks. Without Docker: `npm test`, then `node --env-file=.env server.js` (Node 20.6+).

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
addresses removed. Nothing is stored. Note: free LLM tiers (for example Gemini's) may use prompts to improve their products.

## Before a public launch

Real report address (`public/app.js`), real moderation word list (`public/spec.js`), shared rate limiter (`server.js`),
legal review of the premise (GDD §13), and a licence.
