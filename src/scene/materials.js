// Matériaux PBR. Les textures photo (public/textures) sont utilisées si elles existent,
// sinon on bascule sur les textures procédurales de secours.
import * as THREE from 'three';
import { marbleTextures, woodTextures, feltTextures, grainTexture } from './procedural.js';

const BASE = import.meta.env.BASE_URL;

// Jeux de textures photo attendus (CC0, voir README).
// Chaque entrée : dossier dans public/textures + taille réelle couverte par une répétition (en cases).
export const TEXTURE_SETS = {
  calacatta: { dir: 'calacatta', repeat: 4 },
  verde: { dir: 'verde', repeat: 3 },
  nero: { dir: 'nero', repeat: 2 },
  walnut: { dir: 'walnut', repeat: 3 },
  felt: { dir: 'felt', repeat: 2 },
};
const MAPS = ['color', 'normal', 'rough', 'ao'];

const loader = new THREE.TextureLoader();

function loadTex(url) {
  return new Promise((resolve) => loader.load(url, resolve, undefined, () => resolve(null)));
}

async function loadSet(name, maxAniso, onProgress) {
  const set = TEXTURE_SETS[name];
  const out = {};
  // manifest.json indique les cartes réellement présentes (évite des 404 en console)
  let manifest = null;
  try {
    const r = await fetch(`${BASE}textures/${set.dir}/manifest.json`);
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) manifest = await r.json();
  } catch { /* pas de photos : secours procédural */ }
  if (!manifest) { onProgress?.(); return null; }
  await Promise.all(
    MAPS.filter((m) => manifest[m]).map(async (m) => {
      const tex = await loadTex(`${BASE}textures/${set.dir}/${manifest[m]}`);
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

  const names = Object.keys(TEXTURE_SETS);
  const photo = {};
  for (const n of names) photo[n] = await loadSet(n, maxAniso, onProgress);

  const fallback = {
    calacatta: () => marbleTextures({ size: texSize, base: '#f7efdd', base2: '#ecdfc3', vein: '#8a6f45', vein2: '#cdb17a', veinScale: 2.2, warp: 3.6, sharp: 5, seed: 11, roughBase: 0.12, roughVein: 0.22 }),
    verde: () => marbleTextures({ size: texSize, base: '#126a4f', base2: '#083f2e', vein: '#f3f8ef', vein2: '#62b98f', veinScale: 3.5, warp: 4.5, sharp: 4, seed: 23, roughBase: 0.14, roughVein: 0.2 }),
    nero: () => marbleTextures({ size: texSize, base: '#0e0c0a', base2: '#070605', vein: '#e2c071', vein2: '#7a6331', veinScale: 2.8, warp: 4, sharp: 9, seed: 37, roughBase: 0.1, roughVein: 0.18 }),
    walnut: () => woodTextures({ size: texSize, base: '#5c1b10', dark: '#2c0905', light: '#93401f' }),
    felt: () => feltTextures({ size: 256, base: '#104030' }),
  };
  const tex = {};
  for (const n of names) tex[n] = photo[n] || fallback[n]();
  const usingPhotos = names.filter((n) => photo[n]);

  const grain = grainTexture({ size: 128, amount: 0.12 });

  const m = {};
  const marble = (t, extra = {}) =>
    new THREE.MeshPhysicalMaterial({
      map: t.color || t.map,
      normalMap: t.normal || null,
      normalScale: new THREE.Vector2(0.35, 0.35),
      roughnessMap: t.rough || t.roughnessMap || null,
      aoMap: t.ao || null,
      roughness: 1,
      metalness: 0,
      clearcoat: 0.55,
      clearcoatRoughness: 0.12,
      ...extra,
    });

  m.floor = marble(tex.calacatta, { roughness: photo.calacatta ? 0.9 : 1 });
  m.wall = marble(tex.verde);
  m.nero = marble(tex.nero, { clearcoat: 0.7 });
  m.ivory = marble(tex.calacatta, { color: new THREE.Color('#fbf3e2'), clearcoat: 0.6 });

  m.gold = new THREE.MeshPhysicalMaterial({ color: linear(1.0, 0.69, 0.26), metalness: 1, roughness: 0.22 });
  m.goldPolished = new THREE.MeshPhysicalMaterial({ color: linear(1.0, 0.72, 0.28), metalness: 1, roughness: 0.12 });
  m.goldBrushed = new THREE.MeshPhysicalMaterial({ color: linear(0.96, 0.66, 0.24), metalness: 1, roughness: 0.3, anisotropy: 0.75, anisotropyRotation: 0 });
  m.brass = new THREE.MeshPhysicalMaterial({ color: linear(0.78, 0.56, 0.24), metalness: 1, roughness: 0.42 });

  m.wood = new THREE.MeshPhysicalMaterial({
    map: tex.walnut.color || tex.walnut.map,
    normalMap: tex.walnut.normal || null,
    roughnessMap: tex.walnut.rough || null,
    roughness: 0.55,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
  });
  m.felt = new THREE.MeshPhysicalMaterial({
    map: tex.felt.color || tex.felt.map,
    normalMap: tex.felt.normal || null,
    color: photo.felt ? new THREE.Color('#2f6a52') : new THREE.Color('#ffffff'),
    roughness: 0.95,
    sheen: 1,
    sheenRoughness: 0.55,
    sheenColor: new THREE.Color('#3f8a68'),
  });
  m.lacquer = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#6a1328'), roughness: 0.28, clearcoat: 1, clearcoatRoughness: 0.03, bumpMap: grain, bumpScale: 0.002 });
  m.velvet = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#3d0b17'), roughness: 0.9, sheen: 1, sheenRoughness: 0.4, sheenColor: new THREE.Color('#c0485f') });
  m.glass = new THREE.MeshPhysicalMaterial({ color: new THREE.Color('#fff4dc'), roughness: 0.05, metalness: 0, transparent: true, opacity: 0.28, clearcoat: 1, depthWrite: false });
  m.flame = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffc46b') });
  m.glowInner = new THREE.MeshBasicMaterial({ color: new THREE.Color('#ffd27a'), transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending });

  return { m, tex, repeat: Object.fromEntries(names.map((n) => [n, TEXTURE_SETS[n].repeat])), usingPhotos };
}
