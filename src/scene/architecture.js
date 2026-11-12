// Architecture du plateau : table, cadre en bois, dalles, murs, piliers, rosaces.
// Toute la géométrie statique est fusionnée par matériau (peu d'appels de dessin).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries, toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, SIZE } from '../maze.js';
import { HALF, WALL_H, WALL_T, PILLAR, TILE_TOP, toWorld } from './coords.js';
import { arc, cubic, roundLathe, squareLathe, extrudeProfile } from './profiles.js';

/** Boîte aux arêtes arrondies, positionnée. */
export function rbox(w, h, d, r = 0.02, seg = 2) {
  const rr = Math.min(r, w / 2 - 1e-3, h / 2 - 1e-3, d / 2 - 1e-3);
  return new RoundedBoxGeometry(w, h, d, seg, rr);
}

export function place(geo, x = 0, y = 0, z = 0, ry = 0, sx = 1, sy = 1, sz = 1) {
  const g = geo.index ? geo.toNonIndexed() : geo.clone();
  const mtx = new THREE.Matrix4().compose(
    new THREE.Vector3(x, y, z),
    new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry),
    new THREE.Vector3(sx, sy, sz)
  );
  g.applyMatrix4(mtx);
  return g;
}

/** UV projetées en coordonnées monde (les veines continuent d'un élément à l'autre). */
export function worldUV(geo, repeat) {
  const p = geo.attributes.position, n = geo.attributes.normal;
  const uv = new Float32Array(p.count * 2);
  for (let i = 0; i < p.count; i++) {
    const ax = Math.abs(n.getX(i)), ay = Math.abs(n.getY(i)), az = Math.abs(n.getZ(i));
    let u, v;
    if (ay >= ax && ay >= az) { u = p.getX(i); v = p.getZ(i); }
    else if (ax >= az) { u = p.getZ(i) + 37.1; v = p.getY(i); }
    else { u = p.getX(i) + 11.3; v = p.getY(i); }
    uv[i * 2] = u / repeat; uv[i * 2 + 1] = v / repeat;
  }
  geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return geo;
}

function strip(geo) {
  // ne garde que position / normal / uv pour pouvoir fusionner
  for (const k of Object.keys(geo.attributes)) if (!['position', 'normal', 'uv'].includes(k)) geo.deleteAttribute(k);
  return geo;
}

class Bucket {
  constructor() { this.parts = {}; }
  add(mat, geo) { (this.parts[mat] ||= []).push(strip(geo)); }
  build(materials, group, { cast = true, receive = true } = {}) {
    for (const [mat, list] of Object.entries(this.parts)) {
      const merged = mergeGeometries(list, false);
      const mesh = new THREE.Mesh(merged, materials[mat]);
      mesh.castShadow = cast; mesh.receiveShadow = receive;
      mesh.name = `arch-${mat}`;
      group.add(mesh);
    }
  }
}

export function buildArchitecture(maze, mats) {
  const { m, repeat } = mats;
  const group = new THREE.Group();
  group.name = 'architecture';
  const rand = mulberry32(4242);
  const B = new Bucket();

  // ── Table de jeu (feutrine) ──────────────────────────────
  const table = new THREE.Mesh(new THREE.PlaneGeometry(140, 140), m.felt);
  table.rotation.x = -Math.PI / 2;
  table.position.y = -0.62;
  table.receiveShadow = true;
  m.felt.map.repeat.set(140 / repeat.felt, 140 / repeat.felt);
  if (m.felt.normalMap) m.felt.normalMap.repeat.copy(m.felt.map.repeat);
  table.name = 'table';
  group.add(table);

  // ── Cadre en bois verni ──────────────────────────────────
  const inner = SIZE;             // 27
  const rim = 1.5;
  const outer = inner + rim * 2;
  const frameH = 0.62;
  B.add('wood', worldUV(frameGeometry(outer, inner, frameH), repeat.walnut));
  // fond sous les dalles
  B.add('wood', worldUV(place(new THREE.BoxGeometry(inner, 0.3, inner), 0, -0.2, 0), repeat.walnut));
  // filet doré intérieur (baguette demi-ronde) et filet extérieur
  for (let s = 0; s < 4; s++) {
    const ry = (s * Math.PI) / 2;
    const off1 = inner / 2 + 0.05, off2 = inner / 2 + rim - 0.32;
    const bead = extrudeProfile([[0.05, 0], ...arc(0.0, 0.04, 0.05, 0, Math.PI / 2, 6)], inner + 0.2);
    B.add('goldBrushed', place(bead, Math.sin(ry) * off1, TILE_TOP - 0.02, Math.cos(ry) * off1, ry));
    B.add('goldBrushed', place(rbox(outer - 0.66, 0.04, 0.05, 0.018), Math.sin(ry) * off2, 0.005, Math.cos(ry) * off2, ry));
  }

  // ── Dalles de marbre (chacune tirée d'une zone différente, tournée au hasard) ──
  const tileTex = repeat.calacatta;
  const tileProto = rbox(0.965, 0.1, 0.965, 0.025, 1); // biseau simple : 729 dalles
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const { x: wx, z: wz } = toWorld(x, y);
      const g = place(tileProto, wx, TILE_TOP - 0.05, wz);
      const ox = rand() * tileTex, oz = rand() * tileTex, rot = Math.floor(rand() * 4);
      const p = g.attributes.position, uv = new Float32Array(p.count * 2);
      for (let i = 0; i < p.count; i++) {
        let lx = p.getX(i) - wx, lz = p.getZ(i) - wz;
        for (let r = 0; r < rot; r++) [lx, lz] = [-lz, lx];
        uv[i * 2] = (lx + ox) / tileTex; uv[i * 2 + 1] = (lz + oz) / tileTex;
      }
      g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
      B.add('floor', g);
    }
  }
  // lit de laiton sous les dalles : visible dans les joints, légèrement en creux
  B.add('brass', place(new THREE.BoxGeometry(inner, 0.04, inner), 0, TILE_TOP - 0.055, 0));

  // ── Murs ────────────────────────────────────────────────
  const isWall = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && maze.grid[y][x] === 1;
  const isPillar = new Set(maze.pillars.map((p) => p.y * SIZE + p.x));
  const segments = [];
  // horizontaux
  for (let y = 0; y < SIZE; y += 2) {
    let start = null;
    for (let x = 0; x < SIZE; x++) {
      if (isWall(x, y) && isPillar.has(y * SIZE + x)) {
        if (start !== null && x - start > 1) segments.push({ a: start, b: x, y, horiz: true });
        start = x;
      } else if (!isWall(x, y)) start = null;
    }
  }
  // verticaux
  for (let x = 0; x < SIZE; x += 2) {
    let start = null;
    for (let y = 0; y < SIZE; y++) {
      if (isWall(x, y) && isPillar.has(y * SIZE + x)) {
        if (start !== null && y - start > 1) segments.push({ a: start, b: y, x, horiz: false });
        start = y;
      } else if (!isWall(x, y)) start = null;
    }
  }
  const hedges = [];
  for (const s of segments) addWall(B, s, repeat, hedges);

  // ── Piliers ──────────────────────────────────────────────
  const lanternSet = new Set(maze.lanterns.map((l) => l.y * SIZE + l.x));
  const pillarTops = [];
  for (const p of maze.pillars) {
    const { x, z } = toWorld(p.x, p.y);
    addPillar(B, x, z, repeat, !lanternSet.has(p.y * SIZE + p.x));
    pillarTops.push({ x, z, lantern: lanternSet.has(p.y * SIZE + p.x) });
  }

  // ── Rosaces dorées aux croisements ───────────────────────
  const rosette = rosetteGeometry();
  for (const c of maze.crossings) {
    const { x, z } = toWorld(c.x, c.y);
    B.add('gold', place(rosette, x, TILE_TOP + 0.001, z, rand() < 0.5 ? 0 : Math.PI / 8));
  }

  B.build(m, group);
  // les dalles et la table n'ont pas besoin de projeter d'ombre
  group.traverse((o) => { if (o.name === 'arch-floor' || o.name === 'arch-brass') o.castShadow = false; });

  return { group, pillarTops, segments, hedges };
}

// ── Haies de buis taillées ───────────────────────────────
const hash3 = (x, y, z) => {
  const h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453;
  return h - Math.floor(h);
};
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z);
  const xf = x - xi, yf = y - yi, zf = z - zi;
  const s = (t) => t * t * (3 - 2 * t);
  const u = s(xf), v = s(yf), w = s(zf);
  let r = 0;
  for (let dz = 0; dz < 2; dz++) for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++)
    r += hash3(xi + dx, yi + dy, zi + dz) * (dx ? u : 1 - u) * (dy ? v : 1 - v) * (dz ? w : 1 - w);
  return r;
}

/**
 * Bloc de haie : boîte subdivisée aux arêtes arrondies, surface légèrement bosselée (coordonnées monde).
 * Les UV viennent de la face d'origine (avant arrondi) : la texture de feuilles ne s'étire pas sur les arêtes.
 */
export function hedgeGeometry(len, h, w, x, y, z, ry, repeat, { radius = 0.06, amp = 0.03 } = {}) {
  const g = new THREE.BoxGeometry(len, h, w, Math.max(2, Math.ceil(len * 6)), 6, 4).toNonIndexed();
  const p = g.attributes.position, n0 = g.attributes.normal;
  const along = ry === 0 ? x : z; // continuité des feuilles d'un tronçon à l'autre
  const uv = new Float32Array(p.count * 2);
  const ix = len / 2 - radius, iy = h / 2 - radius, iz = w / 2 - radius;
  const v = new THREE.Vector3(), q = new THREE.Vector3(), d = new THREE.Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(p, i);
    const nx = Math.abs(n0.getX(i)), ny = Math.abs(n0.getY(i));
    let u, t;
    if (ny > 0.5) { u = v.x + along; t = v.z * Math.sign(n0.getY(i)) + 3.7; }
    else if (nx > 0.5) { u = v.z + 7.1; t = v.y; }
    else { u = (v.x + along) * Math.sign(n0.getZ(i)); t = v.y; }
    uv[i * 2] = u / repeat; uv[i * 2 + 1] = t / repeat;
    q.set(THREE.MathUtils.clamp(v.x, -ix, ix), THREE.MathUtils.clamp(v.y, -iy, iy), THREE.MathUtils.clamp(v.z, -iz, iz));
    d.copy(v).sub(q);
    if (d.lengthSq() > 1e-10) v.copy(q).addScaledVector(d.normalize(), radius);
    p.setXYZ(i, v.x, v.y, v.z);
  }
  g.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  let geo = toCreasedNormals(g, Math.PI / 2.5);
  geo.applyMatrix4(new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), ry), new THREE.Vector3(1, 1, 1)));
  const pos = geo.attributes.position, nor = geo.attributes.normal;
  const bottom = y - h / 2;
  for (let i = 0; i < pos.count; i++) {
    const px = pos.getX(i), py = pos.getY(i), pz = pos.getZ(i);
    const k = THREE.MathUtils.smoothstep(py - bottom, 0.0, 0.12); // pied de la haie bien posé
    const nn = (vnoise(px * 1.6, py * 1.6, pz * 1.6) - 0.5) + (vnoise(px * 6, py * 6, pz * 6) - 0.5) * 0.5;
    const a = amp * nn * k;
    pos.setXYZ(i, px + nor.getX(i) * a, py + nor.getY(i) * a, pz + nor.getZ(i) * a);
  }
  return toCreasedNormals(geo, Math.PI / 2.5);
}

function addWall(B, s, repeat, hedges) {
  const half = PILLAR / 2 - 0.02;
  const len = s.b - s.a - half * 2;
  const mid = (s.a + s.b) / 2;
  const { x, z } = s.horiz ? toWorld(mid, s.y) : toWorld(s.x, mid);
  const ry = s.horiz ? 0 : Math.PI / 2;
  const y0 = TILE_TOP;
  // plinthe en marbre noir veiné d'or
  B.add('nero', worldUV(place(plinthGeometry(len), x, y0, z, ry), repeat.nero));
  // listel doré au-dessus de la plinthe
  B.add('goldBrushed', place(rbox(len, 0.022, WALL_T + 0.05, 0.008), x, y0 + 0.14, z, ry));
  // haie de buis taillée
  const hy0 = y0 + 0.15, hh = WALL_H - 0.15 + 0.02;
  B.add('hedge', hedgeGeometry(len + 0.04, hh, WALL_T + 0.04, x, hy0 + hh / 2, z, ry, repeat.hedge));
  hedges.push({ x, z, ry, len: len + 0.04, h: hh, w: WALL_T + 0.04, y0: hy0 });
}

// Profils des piliers (demi-côté, hauteur) : socle mouluré, fût, chapiteau doré, tailloir.
const P_SHAFT0 = 0.204, P_CAP0 = 0.85;
const PILLAR_PARTS = (() => {
  const c = P_CAP0, a = c + 0.14;
  return {
    base: [[0, 0], [0.47, 0], [0.47, 0.045], ...arc(0.47, 0.062, 0.017, -Math.PI / 2, Math.PI / 2, 8), [0.455, 0.085], ...cubic([0.455, 0.085], [0.455, 0.13], [0.4, 0.12], [0.395, 0.165], 8), [0.395, 0.18], [0, 0.18]],
    ring: [[0, 0.18], [0.4, 0.18], ...arc(0.4, 0.192, 0.012, -Math.PI / 2, Math.PI / 2, 6), [0, 0.204]],
    shaft: [[0, P_SHAFT0], [0.37, P_SHAFT0], [0.37, c], [0, c]],
    capital: [[0, c], [0.37, c], ...arc(0.37, c + 0.015, 0.015, -Math.PI / 2, Math.PI / 2, 6), [0.36, c + 0.03], [0.36, c + 0.06], ...cubic([0.36, c + 0.06], [0.36, c + 0.1], [0.43, c + 0.09], [0.44, c + 0.13], 10), [0.44, c + 0.14], [0, c + 0.14]],
    abacus: [[0, a], [0.44, a], [0.44, a + 0.035], ...arc(0.42, a + 0.035, 0.02, 0, Math.PI / 2, 5), [0.38, a + 0.055], [0.38, a + 0.07], [0, a + 0.07]],
  };
})();
export const PILLAR_TOP_Y = TILE_TOP + P_CAP0 + 0.21;
let PILLAR_GEOS = null;
const pillarGeos = () => (PILLAR_GEOS ||= {
  base: squareLathe(PILLAR_PARTS.base),
  ring: squareLathe(PILLAR_PARTS.ring),
  shaft: squareLathe(PILLAR_PARTS.shaft),
  capital: squareLathe(PILLAR_PARTS.capital),
  abacus: squareLathe(PILLAR_PARTS.abacus),
  finial: roundLathe([[0, 0], [0.13, 0], [0.13, 0.018], ...cubic([0.12, 0.022], [0.06, 0.03], [0.05, 0.06], [0.05, 0.075], 8), ...arc(0.05, 0.085, 0.012, -Math.PI / 2, Math.PI / 2, 3), [0.04, 0.1], ...arc(0, 0.2, 0.105, -Math.PI / 2 + 0.38, Math.PI / 2 - 0.12, 10), [0.008, 0.31], [0, 0.335]], 24),
});

function addPillar(B, x, z, repeat, ball) {
  const g = pillarGeos();
  const y0 = TILE_TOP;
  B.add('nero', worldUV(place(g.base, x, y0, z), repeat.nero));
  B.add('goldBrushed', place(g.ring, x, y0, z));
  B.add('wall', worldUV(place(g.shaft, x, y0, z), repeat.creme));
  B.add('gold', place(g.capital, x, y0, z));
  B.add('nero', worldUV(place(g.abacus, x, y0, z), repeat.nero));
  if (ball) B.add('goldPolished', place(g.finial, x, PILLAR_TOP_Y, z));
}

/** Plinthe moulurée (tore + doucine) sous les haies, extrudée le long du mur. */
function plinthGeometry(len) {
  const hw = (WALL_T + 0.1) / 2;
  return extrudeProfile([
    [hw, 0], [hw, 0.03], ...arc(hw, 0.048, 0.018, -Math.PI / 2, Math.PI / 2, 8),
    [hw - 0.012, 0.066], ...cubic([hw - 0.012, 0.066], [hw - 0.012, 0.1], [hw - 0.05, 0.095], [hw - 0.05, 0.13], 10),
  ], len);
}

/** Cadre en bois : un seul bloc à trou, arêtes arrondies (bevel), plus une moulure intérieure en gradin. */
function frameGeometry(outer, inner, h) {
  const rounded = (w, r) => {
    const sh = new THREE.Shape(), a = w / 2;
    sh.moveTo(-a + r, -a); sh.lineTo(a - r, -a); sh.quadraticCurveTo(a, -a, a, -a + r);
    sh.lineTo(a, a - r); sh.quadraticCurveTo(a, a, a - r, a); sh.lineTo(-a + r, a);
    sh.quadraticCurveTo(-a, a, -a, a - r); sh.lineTo(-a, -a + r); sh.quadraticCurveTo(-a, -a, -a + r, -a);
    return sh;
  };
  const hole = (w) => { const p = new THREE.Path(), a = w / 2; p.moveTo(-a, -a); p.lineTo(-a, a); p.lineTo(a, a); p.lineTo(a, -a); p.lineTo(-a, -a); return p; };
  const main = rounded(outer - 0.16, 0.45); main.holes.push(hole(inner + 0.9));
  const g1 = new THREE.ExtrudeGeometry(main, { depth: h - 0.16, bevelEnabled: true, bevelThickness: 0.08, bevelSize: 0.08, bevelSegments: 5, curveSegments: 10 });
  g1.rotateX(-Math.PI / 2); g1.translate(0, -0.62 + 0.08, 0);
  const step = rounded(inner + 1.0, 0.05); step.holes.push(hole(inner));
  const g2 = new THREE.ExtrudeGeometry(step, { depth: 0.12, bevelEnabled: true, bevelThickness: 0.035, bevelSize: 0.035, bevelSegments: 4, curveSegments: 4 });
  g2.rotateX(-Math.PI / 2); g2.translate(0, -0.06, 0);
  return mergeGeometries([g1, g2].map((g) => (g.index ? g.toNonIndexed() : g)), false);
}

function rosetteGeometry() {
  // rose des vents à 16 branches (longues / courtes), anneau et cœur, incrustée dans la dalle
  const star = new THREE.Shape();
  const n = 32;
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.PI / 2;
    const k = i % 2 ? 0.075 : (i / 2) % 2 ? 0.24 : 0.36;
    const px = Math.cos(a) * k, py = Math.sin(a) * k;
    if (i === 0) star.moveTo(px, py); else star.lineTo(px, py);
  }
  const hole = new THREE.Path(); hole.absarc(0, 0, 0.045, 0, Math.PI * 2, true); star.holes.push(hole);
  const ring = new THREE.Shape(); ring.absarc(0, 0, 0.3, 0, Math.PI * 2, false);
  const rh = new THREE.Path(); rh.absarc(0, 0, 0.285, 0, Math.PI * 2, true); ring.holes.push(rh);
  const dot = new THREE.Shape(); dot.absarc(0, 0, 0.03, 0, Math.PI * 2, false);
  const opt = { depth: 0.004, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.003, bevelSegments: 1, curveSegments: 48 };
  const g = mergeGeometries([star, ring, dot].map((sh) => new THREE.ExtrudeGeometry(sh, opt)), false);
  g.rotateX(-Math.PI / 2);
  return g;
}
