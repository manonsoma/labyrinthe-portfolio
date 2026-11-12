// Textures procédurales (solution de secours si les photos ne se chargent pas).
// Bruit « value noise » périodique → textures qui se répètent sans couture.
import * as THREE from 'three';
import { mulberry32 } from '../maze.js';

function makeNoise(period, seed) {
  const rand = mulberry32(seed);
  const v = new Float32Array(period * period);
  for (let i = 0; i < v.length; i++) v[i] = rand();
  const s = (t) => t * t * (3 - 2 * t);
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = s(x - xi), yf = s(y - yi);
    const x0 = ((xi % period) + period) % period, y0 = ((yi % period) + period) % period;
    const x1 = (x0 + 1) % period, y1 = (y0 + 1) % period;
    const a = v[y0 * period + x0], b = v[y0 * period + x1], c = v[y1 * period + x0], d = v[y1 * period + x1];
    return a + (b - a) * xf + (c - a) * yf + (a - b - c + d) * xf * yf;
  };
}

function fbm(noise, x, y, oct, base) {
  let sum = 0, amp = 0.5, f = 1, norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * noise(x * f * base, y * f * base) / 1;
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

const hex = (c) => new THREE.Color(c);

/**
 * Marbre : fond + veines (fonction sinus perturbée par du bruit fractal).
 * Retourne { map, roughnessMap, bumpMap } sous forme de CanvasTexture.
 */
export function marbleTextures({ size = 512, base = '#f2efe9', base2 = '#e6e1d7', vein = '#8b8478', vein2 = null, veinScale = 3, warp = 3.2, sharp = 6, density = 1, seed = 1, roughBase = 0.18, roughVein = 0.32 }) {
  const period = 8;
  const n1 = makeNoise(period * 4, seed);
  const n2 = makeNoise(period * 4, seed + 7);
  const n3 = makeNoise(period * 4, seed + 13);
  const cb = hex(base), cb2 = hex(base2), cv = hex(vein), cv2 = hex(vein2 || vein);
  const col = document.createElement('canvas'); col.width = col.height = size;
  const rgh = document.createElement('canvas'); rgh.width = rgh.height = size;
  const ctx = col.getContext('2d'), rctx = rgh.getContext('2d');
  const img = ctx.createImageData(size, size), rimg = rctx.createImageData(size, size);
  const d = img.data, rd = rimg.data;
  const tmp = new THREE.Color();
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = x / size * period, v = y / size * period;
      const t = fbm(n1, u, v, 5, 1) * warp;
      const cloud = fbm(n3, u, v, 4, 0.5);
      // veines principales et secondaires
      const p = (u + v * 0.6) * veinScale * density / period * Math.PI * 2;
      const vMain = Math.pow(1 - Math.abs(Math.sin(p / 2 + t * 2.4)), sharp * 2.5);
      const t2 = fbm(n2, u * 2, v * 2, 4, 1);
      const vFine = Math.pow(1 - Math.abs(Math.sin((u * 1.7 - v) * veinScale * 1.6 / period * Math.PI * 2 + t2 * 6)), sharp * 5) * 0.55;
      const vein = Math.min(1, vMain + vFine);
      tmp.copy(cb).lerp(cb2, cloud);
      tmp.lerp(vMain > vFine ? cv : cv2, vein * 0.92);
      const i = (y * size + x) * 4;
      d[i] = tmp.r * 255; d[i + 1] = tmp.g * 255; d[i + 2] = tmp.b * 255; d[i + 3] = 255;
      const r = (roughBase + (roughVein - roughBase) * vein + (cloud - 0.5) * 0.06) * 255;
      rd[i] = rd[i + 1] = rd[i + 2] = r; rd[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  rctx.putImageData(rimg, 0, 0);
  return { map: canvasTex(col, true), roughnessMap: canvasTex(rgh, false) };
}

/** Bois verni (veinage étiré). */
export function woodTextures({ size = 512, base = '#4a2616', dark = '#2a120a', light = '#6b3a20', seed = 3 }) {
  const n = makeNoise(32, seed), n2 = makeNoise(32, seed + 5);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  const cb = hex(base), cd = hex(dark), cl = hex(light), tmp = new THREE.Color();
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size * 8, v = y / size * 8;
    const w = fbm(n, u * 0.25, v * 4, 4, 1);
    const ring = 0.5 + 0.5 * Math.sin((v * 6 + w * 7) * Math.PI);
    const fine = fbm(n2, u * 6, v * 0.5, 3, 1);
    tmp.copy(cb).lerp(cd, ring * 0.65).lerp(cl, Math.max(0, fine - 0.55) * 1.6);
    const i = (y * size + x) * 4;
    d[i] = tmp.r * 255; d[i + 1] = tmp.g * 255; d[i + 2] = tmp.b * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { map: canvasTex(c, true) };
}

/** Feutrine : grain fin. */
export function feltTextures({ size = 256, base = '#0d2a1f', seed = 9 }) {
  const n = makeNoise(64, seed);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data;
  const cb = hex(base), tmp = new THREE.Color(); const rand = mulberry32(seed);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const k = fbm(n, x / size * 64, y / size * 64, 3, 1) * 0.16 + rand() * 0.08;
    tmp.copy(cb).multiplyScalar(0.88 + k);
    const i = (y * size + x) * 4;
    d[i] = tmp.r * 255; d[i + 1] = tmp.g * 255; d[i + 2] = tmp.b * 255; d[i + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  return { map: canvasTex(c, true) };
}

/** Velours / laque : simple dégradé de bruit. */
export function grainTexture({ size = 128, seed = 4, amount = 0.08 }) {
  const c = document.createElement('canvas'); c.width = c.height = size;
  const ctx = c.getContext('2d'); const img = ctx.createImageData(size, size); const d = img.data; const rand = mulberry32(seed);
  for (let i = 0; i < d.length; i += 4) { const v = (0.5 + (rand() - 0.5) * amount) * 255; d[i] = d[i + 1] = d[i + 2] = v; d[i + 3] = 255; }
  ctx.putImageData(img, 0, 0);
  return canvasTex(c, false);
}

function canvasTex(canvas, srgb) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
