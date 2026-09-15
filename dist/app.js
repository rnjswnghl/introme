const folderTabs = [...document.querySelectorAll('.folder-tab')];
const folderPanels = [...document.querySelectorAll('.tab-panel')];
const routeAliases = { stories: 'projects', evidence: 'records' };

function activateFolder(route, updateHash = true) {
  const normalized = routeAliases[route] || route;
  const activeTab = folderTabs.find((tab) => tab.dataset.route === normalized) || folderTabs[0];

  folderTabs.forEach((tab) => {
    const selected = tab === activeTab;
    tab.setAttribute('aria-selected', String(selected));
    tab.tabIndex = selected ? 0 : -1;
  });
  folderPanels.forEach((panel) => {
    panel.hidden = panel.id !== activeTab.getAttribute('aria-controls');
  });

  if (updateHash) history.pushState(null, '', `#${activeTab.dataset.route}`);
}

function bindArrowKeys(tabs, activate) {
  tabs.forEach((tab, index) => {
    tab.addEventListener('keydown', (event) => {
      const horizontal = event.key === 'ArrowRight' || event.key === 'ArrowLeft';
      const vertical = event.key === 'ArrowDown' || event.key === 'ArrowUp';
      if (!horizontal && !vertical && event.key !== 'Home' && event.key !== 'End') return;
      event.preventDefault();
      let next = index;
      if (event.key === 'Home') next = 0;
      else if (event.key === 'End') next = tabs.length - 1;
      else if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % tabs.length;
      else next = (index - 1 + tabs.length) % tabs.length;
      tabs[next].focus();
      activate(tabs[next]);
    });
  });
}

folderTabs.forEach((tab) => tab.addEventListener('click', () => activateFolder(tab.dataset.route)));
bindArrowKeys(folderTabs, (tab) => activateFolder(tab.dataset.route));
document.querySelectorAll('[data-open-tab]').forEach((button) => {
  button.addEventListener('click', () => {
    activateFolder(button.dataset.openTab);
    document.querySelector(`[data-route="${button.dataset.openTab}"]`).focus();
  });
});

document.querySelectorAll('a[href^="#"]').forEach((link) => {
  link.addEventListener('click', (event) => {
    const route = link.getAttribute('href').slice(1);
    if (!folderTabs.some((tab) => tab.dataset.route === (routeAliases[route] || route))) return;
    event.preventDefault();
    activateFolder(route);
  });
});
window.addEventListener('hashchange', () => activateFolder(location.hash.slice(1), false));

const projectTabs = [...document.querySelectorAll('.project-tab')];
const projectPanels = [...document.querySelectorAll('.project-detail')];

function activateProject(tab) {
  projectTabs.forEach((item) => {
    const selected = item === tab;
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
  });
  projectPanels.forEach((panel) => {
    panel.hidden = panel.id !== tab.getAttribute('aria-controls');
  });
}

projectTabs.forEach((tab) => tab.addEventListener('click', () => activateProject(tab)));
bindArrowKeys(projectTabs, activateProject);

document.querySelectorAll('[data-carousel]').forEach((carousel) => {
  const slides = [...carousel.querySelectorAll('.carousel-slide')];
  const indexText = carousel.querySelector('[data-carousel-index]');
  const labelText = carousel.querySelector('[data-carousel-label]');
  let current = 0;

  function showSlide(index) {
    current = (index + slides.length) % slides.length;
    slides.forEach((slide, slideIndex) => {
      slide.hidden = slideIndex !== current;
      slide.setAttribute('aria-current', slideIndex === current ? 'true' : 'false');
    });
    indexText.textContent = String(current + 1);
    labelText.textContent = slides[current].dataset.label;
  }

  carousel.querySelector('[data-carousel-prev]').addEventListener('click', () => showSlide(current - 1));
  carousel.querySelector('[data-carousel-next]').addEventListener('click', () => showSlide(current + 1));
  showSlide(0);
});

const shotDialog = document.getElementById('shot-dialog');
const dialogImage = shotDialog.querySelector('img');
const dialogCaption = document.getElementById('shot-caption');
document.querySelectorAll('.project-shot').forEach((button) => {
  button.addEventListener('click', () => {
    dialogImage.src = button.dataset.shot;
    dialogImage.alt = button.dataset.caption;
    dialogCaption.textContent = button.dataset.caption;
    shotDialog.showModal();
  });
});
shotDialog.querySelector('[data-close-dialog]').addEventListener('click', () => shotDialog.close());
shotDialog.addEventListener('click', (event) => {
  if (event.target === shotDialog) shotDialog.close();
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

projectPanels.slice(1).forEach((panel) => { panel.hidden = true; });
activateFolder(location.hash.slice(1) || 'intro', false);
syncMotion();
