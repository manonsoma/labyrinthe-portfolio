// Matériaux PBR. Les textures photo (public/textures, CC0) sont utilisées si elles existent,
// sinon on bascule sur les textures procédurales de secours.
import * as THREE from 'three';
import { marbleTextures, woodTextures, feltTextures, grainTexture } from './procedural.js';

const BASE = import.meta.env.BASE_URL;

// Jeux de textures photo (voir public/textures/*/manifest.json et le README).
// repeat = nombre de cases couvertes par une répétition de la texture.
export const TEXTURE_SETS = {
  calacatta: { dir: 'calacatta', repeat: 5 },   // sol : marbre blanc chaud
  verde: { dir: 'verde', repeat: 4 },           // murs : marbre vert veiné de blanc
  nero: { dir: 'nero', repeat: 3 },             // socles : marbre noir veiné d'or
  walnut: { dir: 'walnut', repeat: 6 },         // cadre : acajou verni
  felt: { dir: 'felt', repeat: 3 },             // table : velours émeraude
  velvet: { dir: 'velvet', repeat: 1 },         // intérieur des coffrets
};
const MAPS = ['color', 'normal', 'rough', 'ao'];

const loader = new THREE.TextureLoader();
const loadTex = (url) => new Promise((resolve) => loader.load(url, resolve, undefined, () => resolve(null)));

async function loadSet(name, { maxAniso, small }, onProgress) {
  const set = TEXTURE_SETS[name];
  const out = {};
  let manifest = null;
  try {
    const r = await fetch(`${BASE}textures/${set.dir}/manifest.json`);
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) manifest = await r.json();
  } catch { /* pas de photos : secours procédural */ }
  if (!manifest) { onProgress?.(); return null; }
  const sub = small && manifest.low ? manifest.low : '';
  await Promise.all(
    MAPS.filter((m) => manifest[m]).map(async (m) => {
      const tex = await loadTex(`${BASE}textures/${set.dir}/${sub}${manifest[m]}`);
      if (!tex) return;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.anisotropy = maxAniso;
      if (m === 'color') tex.colorSpace = THREE.SRGBColorSpace;
      out[m] = tex;
    })
  );
  onProgress?.();
  return out.color ? out : null;
}

const linear = (r, g, b) => new THREE.Color().setRGB(r, g, b, THREE.LinearSRGBColorSpace);

export async function createMaterials(renderer, { quality = 'high', onProgress } = {}) {
  const maxAniso = Math.min(renderer.capabilities.getMaxAnisotropy(), quality === 'low' ? 4 : 8);
  const texSize = quality === 'low' ? 256 : 512;
  const opts = { maxAniso, small: quality !== 'high' };

  const names = Object.keys(TEXTURE_SETS);
  const loaded = await Promise.all(names.map((n) => loadSet(n, opts, onProgress)));
  const photo = Object.fromEntries(names.map((n, i) => [n, loaded[i]]));

  const fallback = {
    calacatta: () => marbleTextures({ size: texSize, base: '#f7efdd', base2: '#ecdfc3', vein: '#8a6f45', vein2: '#cdb17a', veinScale: 2.2, warp: 3.6, sharp: 5, seed: 11, roughBase: 0.12, roughVein: 0.22 }),
    verde: () => marbleTextures({ size: texSize, base: '#126a4f', base2: '#083f2e', vein: '#f3f8ef', vein2: '#62b98f', veinScale: 3.5, warp: 4.5, sharp: 4, seed: 23, roughBase: 0.14, roughVein: 0.2 }),
    nero: () => marbleTextures({ size: texSize, base: '#0e0c0a', base2: '#070605', vein: '#e2c071', vein2: '#7a6331', veinScale: 2.8, warp: 4, sharp: 9, seed: 37, roughBase: 0.1, roughVein: 0.18 }),
    walnut: () => woodTextures({ size: texSize, base: '#5c1b10', dark: '#2c0905', light: '#93401f' }),
    felt: () => feltTextures({ size: 256, base: '#104030' }),
    velvet: () => feltTextures({ size: 128, base: '#4a0c1a', seed: 3 }),
  };
  const tex = {};
  for (const n of names) {
    const t = photo[n] || fallback[n]();
    tex[n] = { color: t.color || t.map, normal: t.normal || null, rough: t.rough || t.roughnessMap || null, ao: t.ao || null };
  }
  const usingPhotos = names.filter((n) => photo[n]);
  const grain = grainTexture({ size: 128, amount: 0.12 });

  // Les cartes de rugosité photo sont multipliées par `roughness` : on les rend plus brillantes (marbre poli).
  const marble = (t, photoSet, extra = {}) =>
    new THREE.MeshPhysicalMaterial({
      map: t.color,
      normalMap: t.normal,
      normalScale: new THREE.Vector2(0.25, 0.25),
      roughnessMap: t.rough,
      aoMap: t.ao,
      roughness: photoSet ? 0.38 : 1,
      metalness: 0,
      clearcoat: 0.6,
      clearcoatRoughness: 0.1,
      ...extra,
    });

  const m = {};
  m.floor = marble(tex.calacatta, photo.calacatta);
  m.wall = marble(tex.verde, photo.verde, { clearcoat: 0.45, clearcoatRoughness: 0.16 });
  m.nero = marble(tex.nero, photo.nero, { clearcoat: 0.75, clearcoatRoughness: 0.06 });
  m.ivory = marble(tex.calacatta, photo.calacatta, { color: new THREE.Color('#fff6e6'), clearcoat: 0.7 });

  m.gold = new THREE.MeshPhysicalMaterial({ color: linear(1.0, 0.69, 0.26), metalness: 1, roughness: 0.24 });
  m.goldPolished = new THREE.MeshPhysicalMaterial({ color: linear(1.0, 0.72, 0.28), metalness: 1, roughness: 0.12 });
  m.goldBrushed = new THREE.MeshPhysicalMaterial({ color: linear(0.96, 0.66, 0.24), metalness: 1, roughness: 0.32, anisotropy: 0.8, anisotropyRotation: 0 });
  m.brass = new THREE.MeshPhysicalMaterial({ color: linear(0.62, 0.44, 0.18), metalness: 1, roughness: 0.5 });

  m.wood = new THREE.MeshPhysicalMaterial({
    map: tex.walnut.color,
    normalMap: tex.walnut.normal,
    normalScale: new THREE.Vector2(0.4, 0.4),
    roughnessMap: tex.walnut.rough,
    aoMap: tex.walnut.ao,
    roughness: photo.walnut ? 0.7 : 0.55,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
  });
  m.felt = new THREE.MeshPhysicalMaterial({
    map: tex.felt.color,
    normalMap: tex.felt.normal,
    normalScale: new THREE.Vector2(0.6, 0.6),
    roughnessMap: tex.felt.rough,
    roughness: 1,
    sheen: 1,
    sheenRoughness: 0.5,
    sheenColor: new THREE.Color('#4a9a76'),
  });
  m.lacquer = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#6a1328'), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.03, bumpMap: grain, bumpScale: 0.002 });
  m.velvet = new THREE.MeshPhysicalMaterial({ map: tex.velvet.color, normalMap: tex.velvet.normal, roughness: 0.9, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color('#d0506a') });
  m.glass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#fff4dc'), roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false });
  m.flame = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46b') });
  m.glowInner = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });

  return { m, tex, repeat: Object.fromEntries(names.map((n) => [n, TEXTURE_SETS[n].repeat])), usingPhotos };
}
