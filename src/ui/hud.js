// HUD : nom, compteur de coffrets (6 losanges), outils, messages, croix directionnelle.
import { content } from '../content.js';
import { icons } from './icons.js';

export function createHud(root, h) {
  const u = content.ui;
  const el = document.createElement('header');
  el.id = 'hud';
  el.className = 'hidden';
  el.innerHTML = `
    <div class="hud-plate hud-id">
      <div class="n">${content.name}</div>
      <div class="counter" role="status" aria-live="polite"><small>${u.coffrets}</small><span class="lz"></span><span class="sr-only" data-count></span></div>
    </div>
    <nav class="hud-plate hud-tools" aria-label="Outils">
      <button class="tool" data-nb title="${u.notebook} (C)">${icons.book}<span class="lbl">${u.notebook}</span><span class="badge"></span></button>
      <button class="tool" data-view aria-pressed="false" title="${u.boardView} (V)">${icons.board}<span class="lbl">${u.boardView}</span></button>
      <button class="tool" data-sound aria-pressed="true" title="${u.sound} (M)">${icons.soundOn}<span class="lbl">${u.sound}</span></button>
      <div class="tools-wrap">
        <button class="tool" data-q aria-haspopup="true" aria-expanded="false" title="${u.quality}">${icons.gem}<span class="lbl">${u.quality}</span></button>
        <div class="menu hud-plate" role="menu" hidden>
          <h3>${u.quality}</h3>
          ${['auto', 'high', 'medium', 'low'].map((q) => `<button role="menuitemradio" data-ql="${q}" aria-checked="false">${u.qualityLevels[q]}</button>`).join('')}
          <hr />
          <button role="menuitemcheckbox" data-amb aria-checked="false">${u.ambience}</button>
          <hr />
          <button role="menuitem" data-restart>${icons.restart.replace('<svg', '<svg style="width:16px;height:16px"')} ${u.restart}</button>
        </div>
      </div>
    </nav>`;
  root.appendChild(el);
  const lz = el.querySelector('.lz');
  lz.style.display = 'flex'; lz.style.gap = '0.5rem';
  lz.innerHTML = Array.from({ length: content.cards.length }, () => '<i class="lozenge"></i>').join('');

  const toast = document.createElement('div');
  toast.id = 'toast'; toast.className = 'hud-plate'; toast.setAttribute('role', 'status'); toast.setAttribute('aria-live', 'polite');
  root.appendChild(toast);

  const dpad = document.createElement('div');
  dpad.id = 'dpad';
  dpad.setAttribute('aria-label', 'Croix directionnelle');
  dpad.innerHTML = ['up', 'right', 'down', 'left'].map((d) => `<button class="${d}" data-dir="${d}" aria-label="${{ up: 'Haut', right: 'Droite', down: 'Bas', left: 'Gauche' }[d]}">${icons[d]}</button>`).join('') + '<span class="hub"></span>';
  root.appendChild(dpad);

  const q = (s) => el.querySelector(s);
  const menu = q('.menu'), qBtn = q('[data-q]');
  const setMenu = (open) => { menu.hidden = !open; qBtn.setAttribute('aria-expanded', String(open)); if (open) menu.querySelector('[aria-checked="true"]')?.focus(); };
  qBtn.addEventListener('click', () => setMenu(menu.hidden));
  document.addEventListener('pointerdown', (e) => { if (!menu.hidden && !e.target.closest('.tools-wrap')) setMenu(false); });
  menu.addEventListener('keydown', (e) => {
    const items = [...menu.querySelectorAll('button')]; const i = items.indexOf(document.activeElement);
    if (e.key === 'ArrowDown') { e.preventDefault(); items[(i + 1) % items.length].focus(); }
    if (e.key === 'ArrowUp') { e.preventDefault(); items[(i - 1 + items.length) % items.length].focus(); }
    if (e.key === 'Escape') { e.stopPropagation(); setMenu(false); qBtn.focus(); }
  });
  menu.querySelectorAll('[data-ql]').forEach((b) => b.addEventListener('click', () => { h.onQuality(b.dataset.ql); setMenu(false); }));
  q('[data-amb]').addEventListener('click', (e) => h.onAmbience(e.currentTarget.getAttribute('aria-checked') !== 'true'));
  q('[data-restart]').addEventListener('click', () => { setMenu(false); h.onRestart(); });
  q('[data-nb]').addEventListener('click', () => h.onNotebook());
  q('[data-view]').addEventListener('click', () => h.onView());
  q('[data-sound]').addEventListener('click', () => h.onSound());

  // croix directionnelle : maintien = déplacement continu
  dpad.querySelectorAll('button').forEach((b) => {
    const start = (e) => { e.preventDefault(); b.classList.add('active'); h.onDirDown(b.dataset.dir); b.setPointerCapture?.(e.pointerId); };
    const stop = () => { b.classList.remove('active'); h.onDirUp(b.dataset.dir); };
    b.addEventListener('pointerdown', start);
    b.addEventListener('pointerup', stop);
    b.addEventListener('pointercancel', stop);
    b.addEventListener('lostpointercapture', stop);
    b.addEventListener('click', (e) => { if (e.detail === 0) h.onDirTap(b.dataset.dir); }); // clavier
  });

  let toastTimer = 0;
  return {
    el,
    show() { el.classList.remove('hidden'); dpad.classList.toggle('show', matchMedia('(pointer: coarse)').matches); },
    hide() { el.classList.add('hidden'); dpad.classList.remove('show'); },
    setCount(n) {
      lz.querySelectorAll('.lozenge').forEach((l, i) => l.classList.toggle('on', i < n));
      q('[data-count]').textContent = `${n} coffret${n > 1 ? 's' : ''} ouvert${n > 1 ? 's' : ''} sur ${content.cards.length}`;
    },
    setBadge(on) { q('[data-nb] .badge').classList.toggle('on', on); },
    setView(board) {
      const b = q('[data-view]'); b.setAttribute('aria-pressed', String(board));
      b.innerHTML = `${board ? icons.pawn : icons.board}<span class="lbl">${board ? u.followView : u.boardView}</span>`;
    },
    setSound(on) {
      const b = q('[data-sound]'); b.setAttribute('aria-pressed', String(on));
      b.innerHTML = `${on ? icons.soundOn : icons.soundOff}<span class="lbl">${u.sound}</span>`;
      b.setAttribute('aria-label', on ? 'Couper le son' : 'Activer le son');
    },
    setQuality(level) { menu.querySelectorAll('[data-ql]').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.ql === level))); },
    setAmbience(on) { q('[data-amb]').setAttribute('aria-checked', String(on)); },
    toast(msg, ms = 3600) {
      toast.textContent = msg; toast.classList.add('show');
      clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.classList.remove('show'), ms);
    },
  };
}
