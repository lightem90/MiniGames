// Guided tour of the UI: a spotlight on one element at a time with a short card and Next/Back/Skip.
// Steps and the per-game controls are plain data (tested); only startTour touches the DOM.

export const CONTROLS = {
  sink: 'Drag an attendee back like a slingshot and release: it shoots the opposite way. Sink them all in the bin before the time runs out.',
  whack: 'Tap each attendee before the ring around it runs out. Too many misses and the meeting wins.',
  dodge: 'Drag (or tap) left and right to move your avatar. Dodge the falling items; lose all hearts and you are out.',
  drive: 'Steer with W A S D or the arrow keys (on a phone: hold and drag). Up is the gas, down the brake. Dodge everyone on the road; three crashes and you are out.',
  defend: 'Tap to place a turret (the counter shows how many you have). Turrets shoot the attendees marching in from the left; let too many through and you lose.',
  merge: 'Slide to aim, release to drop. Two identical attendees merge into the next one. Keep the pile under the dotted line.',
  blast: 'Drag a piece from the tray onto the grid. Full rows and columns clear. When no piece fits, the round is over.',
  helix: 'Drag sideways to spin the rings. Fall through the gaps and never land on an attendee.',
  hop: 'Tap above your avatar to hop one lane forward, tap to its left or right to step aside. Do not get run over.',
  click: 'Tap the mute button as fast as you can until the counter reaches the target.',
  trap: 'Tap a cell to block it. Corner the escapee before it reaches the edge; fewer moves, higher score.',
};

// target: element id. screen: 'setup' | 'play'. optional: skipped when the element is hidden. reveal: unhide it for this step.
export const STEPS = [
  { screen: 'setup', target: 'text', title: 'Describe the meeting',
    text: 'Type anything ("budget review, 14 people, Marco talks too much") or paste the invite text straight from your calendar. Attendee names are picked up; email addresses are removed before anything leaves the browser.' },
  { screen: 'setup', target: 'ics', title: 'Or pick the .ics file',
    text: 'The invite file is parsed here in the browser and lands in the text box. You can also drag any text file onto the box.' },
  { screen: 'setup', target: 'files', title: 'Faces and logos',
    text: 'Up to 5 images become the balls, targets and cars of the game. Ctrl+V pastes a screenshot. Images never leave this browser and are not put in share links.' },
  { screen: 'setup', target: 'signin', title: 'Sign in (optional)', optional: true,
    text: 'Only tells the game your name, so you are never one of the targets. Nothing is stored, no session.' },
  { screen: 'setup', target: 'generate', title: 'Generate',
    text: 'Your text goes to the LLM, which picks a game, a title, the attendees and a difficulty. If the server is unreachable you still get a simple local game.' },
  { screen: 'play', target: 'canvas', title: 'Your game',
    text: (t) => `One round lasts about a minute; the timer is in the top-left corner and the score comes at the end.\n\nThis game (${t}): ${CONTROLS[t]}` },
  { screen: 'play', target: 'pause', title: 'Pause',
    text: 'Stop any time, no penalty. Handy when someone asks you a question.' },
  { screen: 'play', target: 'levels', title: 'Difficulty',
    text: 'The LLM picks one from the meeting length and tone. One tap overrides it and restarts the round.' },
  { screen: 'play', target: 'games', title: 'Eleven games, one tap',
    text: 'Same invite, different game. Switching restarts the round.\n\n' + Object.entries(CONTROLS).map(([k, v]) => `${k}: ${v}`).join('\n') },
  { screen: 'play', target: 'end', title: 'When the round ends', reveal: true,
    text: 'Play again repeats the same game. Copy link gives anyone the same game (without your images). Remix goes back to the text so you can change it and regenerate.' },
  { screen: 'play', target: 'report', title: 'Shared games',
    text: 'On a game someone shared with you, "Make your own" starts yours. "Report" emails us if a game crosses the line.' },
];

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
      <div class="row"><button id="tour-back">Back</button><button id="tour-next">Next</button><span class="muted small" id="tour-count"></span><button id="tour-skip" class="small">Skip</button></div>
    </div>`;
  document.body.append(root);
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
    $('tour-title').textContent = s.title;
    $('tour-text').textContent = typeof s.text === 'function' ? s.text(template()) : s.text;
    $('tour-count').textContent = `${i + 1}/${steps.length}`;
    $('tour-back').disabled = i === 0;
    $('tour-next').textContent = i === steps.length - 1 ? 'Done' : 'Next';
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
