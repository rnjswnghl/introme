document.querySelectorAll('.expand').forEach((button) => {
  button.addEventListener('click', () => {
    const expanded = button.getAttribute('aria-expanded') === 'true';
    const panel = document.getElementById(button.getAttribute('aria-controls'));
    button.setAttribute('aria-expanded', String(!expanded));
    panel.hidden = expanded;
    button.innerHTML = `${expanded ? '과정 읽기' : '과정 접기'} <span aria-hidden="true">${expanded ? '＋' : '−'}</span>`;
  });
});
