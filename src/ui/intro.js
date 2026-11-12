import { content } from '../content.js';

export function createIntro(root, { onStart, onSkip, resumed }) {
  const c = content.intro;
  const el = document.createElement('section');
  el.id = 'intro';
  el.className = 'screen';
  el.setAttribute('aria-labelledby', 'intro-title');
  el.innerHTML = `
    <div class="panel">
      <p class="overline">${c.overline}</p>
      <h1 id="intro-title">${c.title}</h1>
      <p class="name">${content.name}</p>
      <div class="ornament" aria-hidden="true"><i></i></div>
      <p class="text">${c.text}</p>
      <div class="actions">
        <button class="btn solid" data-start>${resumed ? `${c.button}` : c.button}</button>
        <button class="link" data-skip>${c.skipLink}</button>
      </div>
      <p class="controls">${c.controls}</p>
    </div>`;
  root.appendChild(el);
  el.querySelector('[data-start]').addEventListener('click', () => onStart());
  el.querySelector('[data-skip]').addEventListener('click', () => onSkip());
  return {
    el,
    show() { el.classList.remove('hidden'); requestAnimationFrame(() => el.querySelector('[data-start]').focus({ preventScroll: true })); },
    hide() { el.classList.add('hidden'); },
  };
}
