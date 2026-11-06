// Text -> GameSpec. The LLM only returns JSON; normalizeSpec() is the real gatekeeper (GDD §6, §8).
import { normalizeSpec, fallbackSpec, pickTemplate, clean, TEMPLATES, LANGS } from './public/spec.js';

export const DEFAULT_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai';
export const DEFAULT_MODEL = 'gemini-3.8-flash'; // model names change often: override with LLM_MODEL
export const redactEmails = (s) => s.replace(/[^\s<>()"',;]+@[^\s<>()"',;]+/g, '[email]');

const SYSTEM = `You turn a meeting description into a JSON GameSpec for a tiny, playful browser game. Reply with ONE JSON object and nothing else.
Shape: {"version":1,"template":"${TEMPLATES.join('|')}","title":str,"subtitle":str,"difficulty":"easy|normal|hard","durationSec":30-90,"palette":"corporate-blue|sunset|mint|mono","actors":[{"label":str,"role":"enemy","sprite":"emoji:<one emoji>|text"}],"goal":{"label":str,"sprite":"emoji:<one emoji>"},"messages":{"start":str,"win":str,"lose":str,"calm":str}}
Templates (use the one the user message names, and write title, subtitle, goal and messages for it): sink = flick the actors into the goal (a bin); whack = tap the actors as they pop up (goal = a mute button); dodge = the player drags the goal sprite (their avatar, e.g. a coffee) to dodge falling actors; drive = the player steers a car with WASD or drag (goal = the driver, e.g. 😎) and dodges actors standing on the road; defend = actors march across, the player places turrets (goal = a mute button or similar) to stop them; merge = drop actors into a box, two of a kind merge into the next actor (order actors small to big); blast = drag blocks onto a grid, full lines clear; helix = the player's avatar (goal) bounces down through gaps, must not land on an actor; hop = the avatar (goal) hops across roads where actors drive; click = tap the goal (a mute button) as fast as possible; trap = block hex cells to corner the first actor before it escapes.
Rules: max 8 actors, use attendee names as actor labels. When no attendee names are given, invent 4-6 funny things from the meeting context instead (e.g. 'Gantt chart', 'Budget cut', 'Reply All', 'Buffering'). Give every actor and the goal the single most fitting emoji as sprite; use "text" only when no emoji fits. If a player name is given, never use it as an actor. Longer meetings -> harder. Write title, subtitle, invented actor labels, goal label and messages in the language the user message names; keep attendee names exactly as given. messages.lose is kind to the player and never mocks them. messages.calm: one kind, plain closing sentence for the player; no advice, no facts, no numbers, no exclamation marks. Keep it light and screen-share safe: no insults, slurs, sexual content or violence. Never invent personal details.`;

// Any OpenAI-compatible chat endpoint works (Gemini, DeepSeek, Groq, Ollama...): set baseUrl/model/apiKey.
// No response_format on purpose: support varies by provider, and normalizeSpec() validates the output anyway.
// fetchFn is injectable for tests. Never throws: any failure returns the local fallback.
export async function generateSpec(text, imageCount, { apiKey, baseUrl = DEFAULT_BASE_URL, model = DEFAULT_MODEL, fetchFn = fetch, player, previous, rng = Math.random, lang } = {}) {
  const prompt = redactEmails(String(text ?? '')).slice(0, 4000);
  const who = clean(redactEmails(String(player ?? '')), 24); // signed-in first name, same hygiene as the text
  const template = pickTemplate(previous, rng); // random, so the same invite gives a new game each time
  const language = LANGS.includes(lang) ? lang : 'en'; // the player's UI language, so the whole page speaks one language
  if (!apiKey) return { spec: fallbackSpec(prompt, Math.random, template, language), source: 'fallback' };
  try {
    const r = await fetchFn(baseUrl.replace(/\/$/, '') + '/chat/completions', {
      method: 'POST',
      headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
      body: JSON.stringify({
        model,
        max_tokens: 2000, // headroom: "thinking" models spend output tokens before the JSON
        messages: [
          { role: 'system', content: SYSTEM },
          { role: 'user', content: `${prompt}\n\n(template: ${template}; language: ${language === 'it' ? 'Italian' : 'English'}; user uploaded ${Number(imageCount) || 0} images${who ? `; the player is ${who}` : ''})` },
        ],
      }),
      signal: AbortSignal.timeout(15000),
    });
    if (!r.ok) throw new Error(`llm ${r.status}`);
    const out = (await r.json()).choices?.[0]?.message?.content ?? '';
    const json = out.slice(out.indexOf('{'), out.lastIndexOf('}') + 1);
    return { spec: normalizeSpec({ ...JSON.parse(json), template, lang: language }), source: 'llm' }; // the draw wins over the LLM's own pick
  } catch (err) {
    console.error('llm failed, using fallback:', err.message); // status/error only, never user text or the key
    return { spec: fallbackSpec(prompt, Math.random, template, language), source: 'fallback' };
  }
}
