// Gestion accessible des fenêtres : focus piégé, Échap pour fermer, retour du focus.
const stack = [];
const FOCUSABLE = 'button:not([disabled]), [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

export function openDialog(el, { onClose, initial } = {}) {
  const prev = document.activeElement;
  el.classList.remove('hidden');
  el.setAttribute('aria-hidden', 'false');
  const entry = { el, prev, onClose };
  stack.push(entry);
  requestAnimationFrame(() => (initial || el.querySelector(FOCUSABLE))?.focus({ preventScroll: true }));
  return entry;
}

export function closeDialog(el) {
  const i = stack.findIndex((s) => s.el === el);
  if (i === -1) return;
  const [entry] = stack.splice(i, 1);
  el.classList.add('hidden');
  el.setAttribute('aria-hidden', 'true');
  if (entry.prev && document.contains(entry.prev)) entry.prev.focus({ preventScroll: true });
}

export const topDialog = () => stack[stack.length - 1] || null;
export const anyDialog = () => stack.length > 0;

document.addEventListener('keydown', (e) => {
  const top = topDialog();
  if (!top) return;
  if (e.key === 'Escape') { e.preventDefault(); top.onClose?.(); return; }
  if (e.key === 'Tab') {
    const f = [...top.el.querySelectorAll(FOCUSABLE)].filter((n) => n.offsetParent !== null || n === document.activeElement);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }
});
