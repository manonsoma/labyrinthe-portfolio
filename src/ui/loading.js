import { icons } from './icons.js';
import { content } from '../content.js';

export function createLoading(root) {
  const el = document.createElement('div');
  el.id = 'loading';
  el.setAttribute('role', 'progressbar');
  el.setAttribute('aria-valuemin', '0');
  el.setAttribute('aria-valuemax', '100');
  el.setAttribute('aria-label', content.ui.loading);
  el.innerHTML = `<div class="inner"><div class="mark">${icons.mark}</div><div class="label">${content.ui.loading}</div><div class="bar"><span></span></div><div class="pct">0 %</div></div>`;
  root.appendChild(el);
  const bar = el.querySelector('.bar span'), pct = el.querySelector('.pct');
  let shown = 0;
  return {
    set(p) {
      shown = Math.max(shown, Math.min(1, p));
      const v = Math.round(shown * 100);
      bar.style.width = `${v}%`; pct.textContent = `${v} %`;
      el.setAttribute('aria-valuenow', String(v));
    },
    done() { this.set(1); setTimeout(() => el.classList.add('done'), 350); setTimeout(() => el.remove(), 1700); },
  };
}
