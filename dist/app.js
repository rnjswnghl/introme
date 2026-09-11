// Content remains readable if scripting is disabled or fails to initialize.
document.querySelectorAll('.expand').forEach((button) => {
  const panel = document.getElementById(button.getAttribute('aria-controls'));
  panel.hidden = true;
  button.hidden = false;
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    button.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
    button.innerHTML = `${expanded ? '과정 읽기' : '과정 접기'} <span aria-hidden="true">${expanded ? '＋' : '−'}</span>`;
  });
});

const motionToggle = document.getElementById('motion-toggle');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
let pausedByReader = false;

function syncMotion() {
  const paused = pausedByReader || reducedMotion.matches;
  document.documentElement.dataset.motion = paused ? 'paused' : 'running';
  motionToggle.setAttribute('aria-pressed', String(paused));
  motionToggle.disabled = reducedMotion.matches;
  motionToggle.textContent = reducedMotion.matches
    ? '움직임 줄이기 적용 중'
    : paused ? '움직임 다시 켜기' : '움직임 멈추기';
}

motionToggle.hidden = false;
motionToggle.addEventListener('click', () => {
  pausedByReader = !pausedByReader;
  syncMotion();
});
reducedMotion.addEventListener('change', syncMotion);
syncMotion();
