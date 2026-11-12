// Cartes à jouer de luxe : rendu HTML + fenêtre de révélation (retournement 3D).
import { content } from '../content.js';
import { icons } from './icons.js';
import { openDialog, closeDialog } from './dialog.js';

export function cardFace(card, { headingTag = 'h2', id } = {}) {
  const answers = card.answers
    .map((a, i) => (i > 0 && card.separator ? `<span class="or">${card.separator}</span>` : '') + `<p>${a}</p>`)
    .join('');
  const long = card.answers.join(' ').length > 190;
  return {
    long,
    html: `
      <span class="corner tl" aria-hidden="true">${card.numeral}</span>
      <span class="corner br" aria-hidden="true">${card.numeral}</span>
      <div class="inner">
        <div class="numeral" aria-hidden="true">${card.numeral}</div>
        <${headingTag} class="theme" ${id ? `id="${id}"` : ''}><span class="sr-only">Carte ${card.numeral} : </span>${card.theme}</${headingTag}>
        ${card.tag ? `<span class="tag">${card.tag}</span>` : ''}
        <div class="ornament" aria-hidden="true"><i></i></div>
        <p class="q">« ${card.question} »</p>
        <div class="answers">${answers}</div>
      </div>`,
  };
}

export const cardBack = (extra = '') => `<div class="seal">${icons.seal}</div>${extra}`;

export function createCardModal(root) {
  const el = document.createElement('div');
  el.className = 'veil hidden';
  el.id = 'card-modal';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'card-title');
  el.setAttribute('aria-hidden', 'true');
  root.appendChild(el);
  let resolve = null;

  const close = () => {
    closeDialog(el);
    const r = resolve; resolve = null; r?.();
  };

  return {
    /** Affiche la carte d'index `i` (0 → I). Résout la promesse à la fermeture. */
    show(i, { reveal = true } = {}) {
      const card = content.cards[i];
      const face = cardFace(card, { id: 'card-title' });
      el.innerHTML = `
        <div class="card-stage">
          <div class="card ${face.long ? 'compact' : ''} ${reveal ? 'face-down' : ''}">
            <div class="side front">${face.html}</div>
            <div class="side back">${cardBack()}</div>
          </div>
          <div class="card-actions"><button class="btn solid" data-close>${content.ui.continue}</button></div>
        </div>`;
      el.querySelector('[data-close]').addEventListener('click', close);
      el.addEventListener('click', (e) => { if (e.target === el) close(); }, { once: true });
      const btn = el.querySelector('[data-close]');
      openDialog(el, { onClose: close, initial: btn });
      const stage = el.querySelector('.card-stage'), cardEl = el.querySelector('.card');
      const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
      requestAnimationFrame(() => requestAnimationFrame(() => {
        setTimeout(() => { cardEl.classList.remove('face-down'); stage.classList.add('revealed'); }, reveal && !reduced ? 250 : 0);
      }));
      return new Promise((r) => (resolve = r));
    },
    close,
    get open() { return !el.classList.contains('hidden'); },
  };
}
