// Guided tour of the UI: a spotlight on one element at a time with a short card and Next/Back/Skip.
// Steps are plain data (tested); their texts live in i18n.js as tour.<key>.title / tour.<key>.text, the game rules as controls.<template>.
import { t } from './i18n.js';
import { TEMPLATES } from './spec.js';

// target: element id. screen: 'setup' | 'play'. optional: skipped when the element is hidden. reveal: unhide it for this step.
export const STEPS = [
  { screen: 'setup', target: 'text', key: 'text' },
  { screen: 'setup', target: 'ics', key: 'ics' },
  { screen: 'setup', target: 'faces', key: 'faces' },
  { screen: 'setup', target: 'signin', key: 'signin', optional: true },
  { screen: 'setup', target: 'generate', key: 'generate' },
  { screen: 'play', target: 'canvas', key: 'canvas' },
  { screen: 'play', target: 'pause', key: 'pause' },
  { screen: 'play', target: 'levels', key: 'levels' },
  { screen: 'play', target: 'games', key: 'games' },
  { screen: 'play', target: 'end', key: 'end', reveal: true },
  { screen: 'play', target: 'report', key: 'report' },
];

// The text of a step for the game being played (the canvas step names its rules, the games step lists them all).
export const stepText = (s, game) => t(`tour.${s.key}.text`, {
  game,
  controls: t(`controls.${game}`),
  list: TEMPLATES.map((k) => `${k}: ${t(`controls.${k}`)}`).join('\n'),
});

let active = null;

// show(screen) is the app's hook: it switches screen and keeps any game paused. from: 'setup' | 'play'.
export function startTour({ show, template, from = 'setup', onEnd = () => {} }) {
  endTour();
  const $ = (id) => document.getElementById(id);
  const steps = STEPS.filter((s) => !s.optional || !$(s.target).hidden);
  let i = from === 'play' ? steps.findIndex((s) => s.screen === 'play') : 0;
  let revealed = null;

  const root = document.createElement('div');
  root.id = 'tour';
  root.innerHTML = `<div class="tour-spot"></div>
    <div class="tour-card" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <h2 id="tour-title"></h2><p id="tour-text"></p>
      <div class="row"><button id="tour-back"></button><button id="tour-next"></button><span class="muted small" id="tour-count"></span><button id="tour-skip" class="small"></button></div>
    </div>`;
  document.body.append(root);
  $('tour-back').textContent = t('tour.back');
  $('tour-skip').textContent = t('tour.skip');
  const spot = root.firstElementChild;
  const card = spot.nextElementSibling;

  function place() {
    const r = $(steps[i].target).getBoundingClientRect();
    Object.assign(spot.style, { left: `${r.left - 6}px`, top: `${r.top - 6}px`, width: `${r.width + 12}px`, height: `${r.height + 12}px` });
    const below = r.bottom + 12 + card.offsetHeight < window.innerHeight;
    card.style.top = `${below ? r.bottom + 12 : Math.max(8, r.top - 12 - card.offsetHeight)}px`;
  }
  function render() {
    if (revealed) { revealed.hidden = true; revealed = null; }
    const s = steps[i];
    show(s.screen);
    if (s.reveal && $(s.target).hidden) { revealed = $(s.target); revealed.hidden = false; }
    $('tour-title').textContent = t(`tour.${s.key}.title`);
    $('tour-text').textContent = stepText(s, template());
    $('tour-count').textContent = `${i + 1}/${steps.length}`;
    $('tour-back').disabled = i === 0;
    $('tour-next').textContent = t(i === steps.length - 1 ? 'tour.done' : 'tour.next');
    $(s.target).scrollIntoView({ block: 'center' });
    place();
    $('tour-next').focus();
  }
  const go = (d) => { i += d; if (i < 0 || i >= steps.length) endTour(); else render(); };
  const onKey = (e) => {
    if (e.target.closest('input,textarea')) return;
    if (e.key === 'Escape') endTour();
    else if (e.key === 'ArrowRight' || e.key === 'Enter') go(1);
    else if (e.key === 'ArrowLeft') go(-1);
  };
  $('tour-next').onclick = () => go(1);
  $('tour-back').onclick = () => go(-1);
  $('tour-skip').onclick = endTour;
  window.addEventListener('keydown', onKey);
  window.addEventListener('resize', place);
  window.addEventListener('scroll', place);

  active = { root, close() {
    if (revealed) revealed.hidden = true;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('resize', place);
    window.removeEventListener('scroll', place);
    root.remove();
    onEnd();
  } };
  render();
}

export function endTour() {
  if (active) active.close();
  active = null;
}
