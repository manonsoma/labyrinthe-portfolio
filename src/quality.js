// Niveaux de qualité (Haute / Moyenne / Basse) : choix automatique selon l'appareil
// et les images par seconde, modifiable dans le menu.
const KEY = 'labyrinthe-quality';

export const PRESETS = {
  high: { pixelRatio: 2, shadowMap: 4096, ao: true, aoHalf: false, bloom: true, dof: true, lanternLights: 8, dust: 520, smaa: true },
  medium: { pixelRatio: 1.5, shadowMap: 2048, ao: true, aoHalf: true, bloom: true, dof: false, lanternLights: 4, dust: 260, smaa: true },
  low: { pixelRatio: 1, shadowMap: 1024, ao: false, aoHalf: true, bloom: false, dof: false, lanternLights: 0, dust: 0, smaa: false },
};

export function detectTier() {
  const ua = navigator.userAgent || '';
  const mobile = /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(ua));
  const cores = navigator.hardwareConcurrency || 4;
  const mem = navigator.deviceMemory || 8;
  if (mobile) return cores >= 6 && mem >= 4 ? 'medium' : 'low';
  if (cores <= 2 || mem <= 2) return 'low';
  return 'high';
}

export function readChoice() { try { return localStorage.getItem(KEY) || 'auto'; } catch { return 'auto'; } }
export function writeChoice(v) { try { localStorage.setItem(KEY, v); } catch { /* rien */ } }

/** Surveille les FPS : en mode auto, baisse d'un cran si l'affichage rame. */
export class FpsGovernor {
  constructor(onDowngrade) { this.onDowngrade = onDowngrade; this.reset(); }
  reset() { this.frames = 0; this.time = 0; this.grace = 3; this.slow = 0; }
  tick(dt) {
    if (this.grace > 0) { this.grace -= dt; return; }
    this.frames++; this.time += dt;
    if (this.time >= 2) {
      const fps = this.frames / this.time;
      this.slow = fps < 44 ? this.slow + 1 : 0;
      if (this.slow >= 2) { this.slow = 0; this.grace = 4; this.onDowngrade(fps); }
      this.frames = 0; this.time = 0;
    }
  }
}
