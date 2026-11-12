// Petites icônes SVG (trait doré, héritent de la couleur du texte)
const s = (d, extra = '') => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" ${extra}>${d}</svg>`;
export const icons = {
  book: s('<path d="M4 5.5C4 4.7 4.7 4 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z"/><path d="M20 5.5c0-.8-.7-1.5-1.5-1.5H13v16h5.5c.8 0 1.5-.7 1.5-1.5z"/><path d="M6.5 8h2M15.5 8h2"/>'),
  board: s('<rect x="3.5" y="3.5" width="17" height="17" rx="1"/><path d="M3.5 9.5h6v5M14.5 3.5v6h6M9.5 20.5v-3h5v-3M20.5 14.5h-3"/>'),
  pawn: s('<circle cx="12" cy="6.5" r="2.6"/><path d="M9.5 10.5h5M10.4 10.5 9 17.5h6l-1.4-7M7 20.5h10l-1-3H8z"/>'),
  soundOn: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11"/>'),
  soundOff: s('<path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="m16 9.5 5 5M21 9.5l-5 5"/>'),
  gem: s('<path d="M12 3 21 12 12 21 3 12z"/><path d="M12 7.5 16.5 12 12 16.5 7.5 12z"/>'),
  restart: s('<path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3"/><path d="M4.5 4.5v3.8h3.8"/>'),
  close: s('<path d="M5 5l14 14M19 5 5 19"/>'),
  up: s('<path d="M6 15l6-6 6 6"/>'),
  down: s('<path d="M6 9l6 6 6-6"/>'),
  left: s('<path d="M15 6l-6 6 6 6"/>'),
  right: s('<path d="M9 6l6 6-6 6"/>'),
  seal: `<svg viewBox="0 0 100 100" aria-hidden="true" fill="none" stroke="currentColor"><circle cx="50" cy="50" r="44" stroke-width="1.2"/><circle cx="50" cy="50" r="38" stroke-width=".6"/><path d="M50 14 86 50 50 86 14 50z" stroke-width="1"/><path d="M50 26 74 50 50 74 26 50z" stroke-width=".7"/><path d="M50 4v10M50 86v10M4 50h10M86 50h10" stroke-width=".8"/><circle cx="50" cy="50" r="5" fill="currentColor" stroke="none"/></svg>`,
  mark: `<svg viewBox="0 0 64 64" fill="none" stroke="currentColor" aria-hidden="true"><path d="M32 3 61 32 32 61 3 32z" stroke-width="1.2"/><path d="M32 13 51 32 32 51 13 32z" stroke-width=".8"/><path d="M32 23 41 32 32 41 23 32z" stroke-width=".8"/><circle cx="32" cy="32" r="2.2" fill="currentColor"/></svg>`,
};
