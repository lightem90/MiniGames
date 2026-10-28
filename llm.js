// Text -> GameSpec. The LLM only returns JSON; normalizeSpec() is the real gatekeeper (GDD §6, §8).
import { normalizeSpec, fallbackSpec } from './public/spec.js';

export const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const DEFAULT_MODEL = 'gemini-3.8-flash'; // model names change often: override with LLM_MODEL
export const redactEmails = (s) => s.replace(/[^\s<>()"',;]+@[^\s<>()"',;]+/g, '[email]');

const SYSTEM = `You turn a meeting description into a JSON GameSpec for a tiny, playful browser game. Reply with ONE JSON object and nothing else.
Shape: {"version":1,"template":"sink","title":str,"subtitle":str,"difficulty":"easy|normal|hard","durationSec":30-90,"palette":"corporate-blue|sunset|mint|mono","actors":[{"label":str,"role":"enemy","sprite":"emoji:<one emoji>|text"}],"goal":{"label":str,"sprite":"emoji:<one emoji>"},"messages":{"start":str,"win":str,"lose":str}}
Rules: max 8 actors, use attendee names or agenda items as actor labels. Longer meetings -> harder. Keep it light and screen-share safe: no insults, slurs, sexual content or violence; the goal is a bin, mute button or similar. Never invent personal details.`;

// Any OpenAI-compatible chat endpoint works (Gemini, DeepSeek, Groq, Ollama...): set baseUrl/model/apiKey.
// No response_format on purpose: support varies by provider, and normalizeSpec() validates the output anyway.
// fetchFn is injectable for tests. Never throws: any failure returns the local fallback.
export async function generateSpec(text, imageCount, { apiKey, baseUrl = DEFAULT_BASE_URL, model = DEFAULT_MODEL, fetchFn = fetch } = {}) {
  const clean = redactEmails(String(text ?? '')).slice(0, 4000);
  if (!apiKey) return { spec: fallbackSpec(clean), source: 'fallback' };
  try {
    const r = await fetchFn(baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 2000, // headroom: "thinking" models spend output tokens before the JSON
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `${clean}\n\n(user uploaded ${Number(imageCount) || 0} images)` },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`llm ${r.status}`);
    const out = (await r.json()).choices?.[0]?.message?.content ?? '';
    const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
    return { spec: normalizeSpec(JSON.parse(json)), source: 'llm' };
  } catch (err) {
    console.error('llm failed, using fallback:', err.message); // status/error only, never user text or the key
    return { spec: fallbackSpec(clean), source: 'fallback' };
  }
}
