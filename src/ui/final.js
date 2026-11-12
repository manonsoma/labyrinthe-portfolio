// Écran final « Portrait complet » : résumé des 6 cartes + CV + contact.
import { content } from '../content.js';
import { icons } from './icons.js';
import { openDialog, closeDialog } from './dialog.js';

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

function timeline(items) {
  return `<ul class="timeline">${items.map((it) => `
    <li><span class="when">${esc(it.when)}</span>
      <div><div class="what">${esc(it.what)} <span class="where">· ${esc(it.where)}</span></div>
      ${it.detail ? `<div class="detail">${esc(it.detail)}</div>` : ''}</div></li>`).join('')}</ul>`;
}

export function createFinal(root, { onNotebook, onReplay, onPlay, onClose }) {
  const el = document.createElement('div');
  el.className = 'veil hidden';
  el.id = 'final';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.setAttribute('aria-labelledby', 'final-title');
  el.setAttribute('aria-hidden', 'true');
  root.appendChild(el);

  function render({ revealed, completed }) {
    const f = content.final, cv = content.cv, ct = cv.contact;
    const summary = content.cards.map((c, i) => `
      <article class="${completed || i < revealed ? '' : 'locked'}">
        <div><span class="num">${c.numeral}</span><span class="th">${c.theme}</span></div>
        <p class="q">« ${c.question} »</p>
        ${c.answers.map((a, j) => `${j > 0 && c.separator ? `<p><em>${c.separator}</em></p>` : ''}<p>${a}</p>`).join('')}
      </article>`).join('');
    const buttons = completed
      ? `<button class="btn" data-nb>${f.buttons.notebook}</button><button class="btn solid" data-replay>${f.buttons.replay}</button>`
      : `<button class="btn" data-nb>${f.buttons.notebook}</button><button class="btn solid" data-play>${f.buttons.play}</button>`;
    el.innerHTML = `
      <article class="sheet">
        <button class="close" data-close aria-label="${content.ui.close}">${icons.close}</button>
        <header class="hero">
          <div class="overline">${completed ? f.overline : content.intro.overline}</div>
          <h2 id="final-title">${f.title}</h2>
          <div class="who">${content.name}</div>
          <div class="ornament" aria-hidden="true" style="margin-top:1rem"><i></i></div>
        </header>
        <section aria-labelledby="sum-t"><h3 id="sum-t">${f.summaryTitle}</h3><div class="summary">${summary}</div></section>
        <div class="cv-cols">
          <div>
            <section aria-labelledby="cv-f"><h3 id="cv-f">${cv.formation.title}</h3>${timeline(cv.formation.items)}</section>
            <section aria-labelledby="cv-x"><h3 id="cv-x">${cv.experiences.title}</h3>${timeline(cv.experiences.items)}</section>
            <section aria-labelledby="cv-e"><h3 id="cv-e">${cv.engagements.title}</h3>${timeline(cv.engagements.items)}</section>
          </div>
          <div>
            <section aria-labelledby="cv-s"><h3 id="cv-s">${cv.skills.title}</h3><ul class="chips">${cv.skills.list.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>
            <section aria-labelledby="cv-l"><h3 id="cv-l">${cv.languages.title}</h3><ul class="plain">${cv.languages.list.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>
            <section aria-labelledby="cv-c"><h3 id="cv-c">${cv.certifications.title}</h3><ul class="plain">${cv.certifications.list.map((s) => `<li>${esc(s)}</li>`).join('')}</ul></section>
          </div>
        </div>
        <section aria-labelledby="cv-k"><h3 id="cv-k">${ct.title}</h3>
          <div class="contact">
            <a href="mailto:${ct.email}"><small>E-mail</small>${ct.email}</a>
            <a href="tel:${ct.phoneLink}"><small>Téléphone</small>${ct.phone}</a>
            <a href="https://${ct.linkedin}" target="_blank" rel="noopener"><small>LinkedIn</small>${ct.linkedin}</a>
            <span><small>Ville</small>${ct.city}</span>
          </div>
        </section>
        <div class="final-actions">${buttons}</div>
      </article>`;
    el.querySelector('[data-close]').addEventListener('click', () => onClose());
    el.querySelector('[data-nb]')?.addEventListener('click', () => onNotebook());
    el.querySelector('[data-replay]')?.addEventListener('click', () => onReplay());
    el.querySelector('[data-play]')?.addEventListener('click', () => onPlay());
  }

  return {
    open(state) { render(state); el.scrollTop = 0; openDialog(el, { onClose }); },
    close() { closeDialog(el); },
    get isOpen() { return !el.classList.contains('hidden'); },
  };
}
