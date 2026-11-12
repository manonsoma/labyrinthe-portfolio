// Architecture du plateau : table, cadre en bois, dalles, murs, piliers, rosaces.
// Toute la géométrie statique est fusionnée par matériau (peu d'appels de dessin).
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { mulberry32, SIZE } from '../maze.js';
import { HALF, WALL_H, WALL_T, PILLAR, TILE_TOP, toWorld } from './coords.js';

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
  B.add('wood', worldUV(place(rbox(outer, frameH - 0.06, outer, 0.16, 4), 0, -0.62 + (frameH - 0.06) / 2, 0), repeat.walnut));
  // moulure supérieure du cadre (quatre lattes biseautées)
  for (let s = 0; s < 4; s++) {
    const ry = (s * Math.PI) / 2;
    const off = inner / 2 + rim / 2;
    const g = rbox(outer - 0.02, 0.12, rim, 0.05, 3);
    const gx = Math.sin(ry) * off, gz = Math.cos(ry) * off;
    B.add('wood', worldUV(place(g, gx, 0.0, gz, ry), repeat.walnut));
  }
  // filet doré intérieur + filet extérieur
  for (let s = 0; s < 4; s++) {
    const ry = (s * Math.PI) / 2;
    const off1 = inner / 2 + 0.06, off2 = inner / 2 + rim - 0.12;
    B.add('goldBrushed', place(rbox(inner + 0.24, 0.1, 0.1, 0.03), Math.sin(ry) * off1, 0.07, Math.cos(ry) * off1, ry));
    B.add('goldBrushed', place(rbox(outer - 0.2, 0.05, 0.06, 0.02), Math.sin(ry) * off2, 0.07, Math.cos(ry) * off2, ry));
  }

  // ── Dalles de marbre (chacune tirée d'une zone différente, tournée au hasard) ──
  const tileTex = repeat.calacatta;
  const tileProto = rbox(0.965, 0.1, 0.965, 0.025, 2);
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
  for (const s of segments) addWall(B, s, repeat);

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

  return { group, pillarTops, segments };
}

function addWall(B, s, repeat) {
  const half = PILLAR / 2 - 0.02;
  const len = s.b - s.a - half * 2;
  const mid = (s.a + s.b) / 2;
  const { x, z } = s.horiz ? toWorld(mid, s.y) : toWorld(s.x, mid);
  const ry = s.horiz ? 0 : Math.PI / 2;
  const y0 = TILE_TOP;
  // plinthe noire
  B.add('nero', worldUV(place(rbox(len, 0.13, WALL_T + 0.08, 0.025), x, y0 + 0.065, z, ry), repeat.nero));
  // listel doré au-dessus de la plinthe
  B.add('goldBrushed', place(rbox(len, 0.022, WALL_T + 0.035, 0.008), x, y0 + 0.14, z, ry));
  // corps en marbre vert
  const bodyH = WALL_H - 0.13 - 0.12;
  B.add('wall', worldUV(place(rbox(len, bodyH, WALL_T, 0.03), x, y0 + 0.13 + bodyH / 2, z, ry), repeat.verde));
  // bandeau doré
  B.add('gold', place(rbox(len, 0.03, WALL_T + 0.025, 0.01), x, y0 + WALL_H - 0.135, z, ry));
  // corniche en saillie
  B.add('wall', worldUV(place(rbox(len, 0.1, WALL_T + 0.12, 0.035), x, y0 + WALL_H - 0.07, z, ry), repeat.nero));
}

function addPillar(B, x, z, repeat, ball) {
  const y0 = TILE_TOP;
  const P = PILLAR;
  B.add('nero', worldUV(place(rbox(P + 0.12, 0.16, P + 0.12, 0.03), x, y0 + 0.08, z), repeat.nero));
  B.add('goldBrushed', place(rbox(P + 0.04, 0.025, P + 0.04, 0.008), x, y0 + 0.17, z));
  const shaftH = WALL_H + 0.08 - 0.18 - 0.1;
  B.add('wall', worldUV(place(rbox(P, shaftH, P, 0.035), x, y0 + 0.18 + shaftH / 2, z), repeat.verde));
  // chapiteau doré mouluré
  const capY = y0 + 0.18 + shaftH;
  B.add('gold', place(rbox(P + 0.06, 0.04, P + 0.06, 0.012), x, capY + 0.02, z));
  B.add('nero', worldUV(place(rbox(P + 0.16, 0.08, P + 0.16, 0.03), x, capY + 0.08, z), repeat.nero));
  B.add('wall', worldUV(place(rbox(P - 0.04, 0.03, P - 0.04, 0.01), x, capY + 0.135, z), repeat.verde));
  if (ball) {
    const sph = new THREE.SphereGeometry(0.13, 24, 16);
    B.add('goldPolished', place(new THREE.CylinderGeometry(0.06, 0.09, 0.06, 24), x, capY + 0.18, z));
    B.add('goldPolished', place(sph, x, capY + 0.3, z));
  }
}

export const PILLAR_TOP_Y = TILE_TOP + 0.18 + (WALL_H + 0.08 - 0.18 - 0.1) + 0.15;

function rosetteGeometry() {
  const shape = new THREE.Shape();
  const pts = 16;
  for (let i = 0; i <= pts; i++) {
    const a = (i / pts) * Math.PI * 2;
    const r = i % 2 === 0 ? 0.36 : 0.14;
    const px = Math.cos(a) * r, py = Math.sin(a) * r;
    if (i === 0) shape.moveTo(px, py); else shape.lineTo(px, py);
  }
  const hole = new THREE.Path();
  hole.absarc(0, 0, 0.07, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const g = new THREE.ExtrudeGeometry(shape, { depth: 0.006, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.004, bevelSegments: 1 });
  g.rotateX(-Math.PI / 2);
  return g;
}
