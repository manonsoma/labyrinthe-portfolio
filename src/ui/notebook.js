// Carnet : les 6 cartes, scellées tant qu'elles ne sont pas révélées.
import { content } from '../content.js';
import { icons } from './icons.js';
import { cardFace, cardBack } from './cards.js';
import { openDialog, closeDialog } from './dialog.js';

export function createNotebook(root, { onOpenCard }) {
  const el = document.createElement('div');
  el.className = 'veil hidden';
  el.id = 'notebook';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'nb-title');
  el.setAttribute('aria-hidden', 'true');
  root.appendChild(el);
  let onClosed = null;

  const close = () => { closeDialog(el); const f = onClosed; onClosed = null; f?.(); };

  function render(revealed) {
    const slots = content.cards.map((card, i) => {
      if (i < revealed) {
        const f = cardFace(card, { headingTag: 'h3' });
        return `<button class="slot" data-i="${i}" aria-label="Agrandir la carte ${card.numeral} : ${card.theme}"><div class="card static compact"><div class="side front">${f.html}</div></div></button>`;
      }
      return `<div class="slot" aria-label="${content.ui.sealed} ${card.numeral}" role="img"><div class="card static"><div class="side back">${cardBack(`<span class="roman">${card.numeral}</span><span class="sealed-label">${content.ui.sealed}</span>`)}</div></div></div>`;
    }).join('');
    el.innerHTML = `
      <div class="sheet hud-plate">
        <button class="close" data-close aria-label="${content.ui.close}">${icons.close}</button>
        <header class="sheet-head"><h2 id="nb-title">${content.ui.notebookTitle}</h2><p>${content.ui.notebookSubtitle} · ${revealed} / ${content.cards.length}</p></header>
        <div class="nb-grid">${slots}</div>
      </div>`;
    el.querySelector('[data-close]').addEventListener('click', close);
    el.querySelectorAll('button.slot').forEach((b) => b.addEventListener('click', () => onOpenCard(+b.dataset.i)));
  }

  el.addEventListener('click', (e) => { if (e.target === el) close(); });

  return {
    open(revealed, after) { render(revealed); onClosed = after || null; openDialog(el, { onClose: close }); },
    close,
    get isOpen() { return !el.classList.contains('hidden'); },
  };
}
