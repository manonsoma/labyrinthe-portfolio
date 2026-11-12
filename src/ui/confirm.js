// Petite fenêtre de confirmation (remplace window.confirm, plus élégante et accessible).
import { openDialog, closeDialog } from './dialog.js';

export function confirmDialog(root, message, { ok = 'Recommencer', cancel = 'Annuler' } = {}) {
  return new Promise((resolve) => {
    const el = document.createElement('div');
    el.className = 'veil hidden';
    el.id = 'confirm';
    el.setAttribute('role', 'alertdialog');
    el.setAttribute('aria-modal', 'true');
    el.setAttribute('aria-describedby', 'confirm-msg');
    el.innerHTML = `<div class="sheet hud-plate confirm-box"><p id="confirm-msg">${message}</p><div class="confirm-actions"><button class="btn" data-no>${cancel}</button><button class="btn solid" data-yes>${ok}</button></div></div>`;
    root.appendChild(el);
    const done = (v) => { closeDialog(el); setTimeout(() => el.remove(), 700); resolve(v); };
    el.querySelector('[data-no]').addEventListener('click', () => done(false));
    el.querySelector('[data-yes]').addEventListener('click', () => done(true));
    el.addEventListener('click', (e) => { if (e.target === el) done(false); });
    requestAnimationFrame(() => openDialog(el, { onClose: () => done(false), initial: el.querySelector('[data-no]') }));
  });
}
