# MeetingBreak (working title)

Describe a meeting, get a 60-second browser game about it, share the link. Design: see [GDD.md](GDD.md).
MVP: one template (`sink`: flick the colleagues into the bin).

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

## Privacy

Uploaded images never leave the browser and are not in share links. Only the typed text is sent to the LLM, with email
addresses removed. Nothing is stored. Note: free LLM tiers (for example Gemini's) may use prompts to improve their products.

## Before a public launch

Real report address (`public/app.js`), real moderation word list (`public/spec.js`), shared rate limiter (`server.js`),
legal review of the premise (GDD §13), and a licence.
