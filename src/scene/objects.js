// Objets du jeu : pion, coffrets, vases, grille de sortie, lanternes, poussière d'or, paillettes.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { rbox, place, worldUV } from './architecture.js';
import { PILLAR_TOP_Y } from './architecture.js';
import { TILE_TOP, toWorld } from './coords.js';
import { mulberry32 } from '../maze.js';

const merge = (list) => mergeGeometries(list.map((g) => {
  const n = g.index ? g.toNonIndexed() : g;
  for (const k of Object.keys(n.attributes)) if (!['position', 'normal', 'uv'].includes(k)) n.deleteAttribute(k);
  return n;
}), false);

function lathe(points, segments = 64) {
  const v = points.map(([r, y]) => new THREE.Vector2(r, y));
  return new THREE.LatheGeometry(v, segments);
}

/** Lisse un profil (Catmull-Rom) pour un tour de pièce d'échecs plus réaliste. */
function smoothProfile(points, samples = 160) {
  const curve = new THREE.SplineCurve(points.map(([r, y]) => new THREE.Vector2(r, y)));
  return curve.getSpacedPoints(samples).map((p) => [Math.max(0, p.x), p.y]);
}

// ─── Pion ──────────────────────────────────────────────────
export function createPawn(mats) {
  const { m } = mats;
  const prof = [
    [0.0, 0.0], [0.27, 0.0], [0.3, 0.012], [0.305, 0.035], [0.29, 0.055], [0.255, 0.07],
    [0.25, 0.09], [0.265, 0.105], [0.25, 0.125], [0.2, 0.15], [0.16, 0.19],
    [0.13, 0.25], [0.11, 0.32], [0.095, 0.39], [0.09, 0.44],
    [0.15, 0.46], [0.165, 0.475], [0.15, 0.49], [0.095, 0.505],
    [0.11, 0.53], [0.14, 0.57], [0.155, 0.62], [0.15, 0.67], [0.125, 0.715], [0.085, 0.745], [0.04, 0.76], [0.0, 0.765],
  ];
  const geo = lathe(smoothProfile(prof, 220), 96);
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, m.goldPolished);
  body.castShadow = true; body.receiveShadow = true;
  // feutrine sous le pion
  const felt = new THREE.Mesh(new THREE.CylinderGeometry(0.26, 0.26, 0.006, 48), m.velvet);
  felt.position.y = 0.003;
  const pawn = new THREE.Group();
  const tilt = new THREE.Group();
  tilt.add(body, felt);
  pawn.add(tilt);
  pawn.userData.tilt = tilt;
  pawn.name = 'pawn';
  return pawn;
}

// ─── Coffrets ──────────────────────────────────────────────
export function createCoffret(mats) {
  const { m } = mats;
  const W = 0.6, H = 0.28, D = 0.42, LH = 0.12;
  const root = new THREE.Group();
  const add = (geo, mat, parent = root) => { const me = new THREE.Mesh(geo, mat); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };

  // pieds dorés
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const f = add(new THREE.SphereGeometry(0.035, 16, 12), m.gold);
    f.position.set(sx * (W / 2 - 0.05), TILE_TOP + 0.03, sz * (D / 2 - 0.05));
  }
  const y0 = TILE_TOP + 0.05;
  // caisse laquée
  const body = add(rbox(W, H, D, 0.03, 3), m.lacquer); body.position.set(0, y0 + H / 2, 0);
  // intérieur velours
  const inner = add(new THREE.BoxGeometry(W - 0.06, 0.01, D - 0.06), m.velvet); inner.position.set(0, y0 + H - 0.012, 0);
  inner.castShadow = false;
  // ferrures : cornières dorées et bandeaux
  const goldParts = [];
  for (const sx of [-1, 1]) for (const sz of [-1, 1])
    goldParts.push(place(rbox(0.05, H + 0.005, 0.05, 0.012), sx * (W / 2 - 0.018), y0 + H / 2, sz * (D / 2 - 0.018)));
  goldParts.push(place(rbox(W + 0.01, 0.025, D + 0.01, 0.01), 0, y0 + 0.02, 0));
  goldParts.push(place(rbox(W + 0.012, 0.02, D + 0.012, 0.008), 0, y0 + H - 0.012, 0));
  // serrure
  goldParts.push(place(rbox(0.1, 0.11, 0.02, 0.01), 0, y0 + H - 0.07, D / 2 + 0.006));
  add(merge(goldParts), m.gold);
  const keyhole = add(new THREE.CylinderGeometry(0.012, 0.012, 0.01, 16), new THREE.MeshBasicMaterial({ color: 0x110805 }));
  keyhole.rotation.x = Math.PI / 2; keyhole.position.set(0, y0 + H - 0.075, D / 2 + 0.017);

  // couvercle (pivot sur les charnières, à l'arrière)
  const lidPivot = new THREE.Group();
  lidPivot.position.set(0, y0 + H, -D / 2);
  root.add(lidPivot);
  const lid = add(rbox(W + 0.02, LH, D + 0.02, 0.04, 4), m.lacquer, lidPivot);
  lid.position.set(0, LH / 2, D / 2);
  // dôme léger
  const dome = add(new THREE.CylinderGeometry(D / 2 - 0.02, D / 2 - 0.02, W - 0.04, 40, 1, false, 0, Math.PI), m.lacquer, lidPivot);
  dome.rotation.z = Math.PI / 2; dome.scale.set(1, 1, 0.35);
  dome.position.set(0, LH, D / 2);
  const lidGold = [];
  for (const sx of [-1, 0, 1]) {
    const band = new THREE.TorusGeometry(D / 2 - 0.01, 0.012, 8, 40, Math.PI);
    band.scale(1, 0.35, 1);
    band.rotateY(Math.PI / 2);
    lidGold.push(place(band, sx * (W / 2 - 0.06), LH, D / 2));
  }
  lidGold.push(place(rbox(W + 0.03, 0.02, D + 0.03, 0.008), 0, 0.012, D / 2));
  lidGold.push(place(rbox(0.08, 0.06, 0.018, 0.008), 0, 0.02, D + 0.012));
  add(merge(lidGold), m.gold, lidPivot);
  // charnières visibles
  for (const sx of [-1, 1]) {
    const h = add(new THREE.CylinderGeometry(0.018, 0.018, 0.09, 16), m.goldBrushed);
    h.rotation.z = Math.PI / 2; h.position.set(sx * (W / 2 - 0.12), y0 + H, -D / 2 - 0.008);
  }

  // lueur intérieure (révélée à l'ouverture)
  const glow = new THREE.Mesh(new THREE.PlaneGeometry(W - 0.08, D - 0.08), m.glowInner.clone());
  glow.rotation.x = -Math.PI / 2; glow.position.y = y0 + H - 0.005;
  root.add(glow);

  root.userData = { lidPivot, glow, glowY: y0 + H };
  return root;
}

// ─── Vases (leurres) ───────────────────────────────────────
export function createVases(maze, mats) {
  const { m, repeat } = mats;
  const body = smoothProfile([
    [0, 0], [0.13, 0], [0.15, 0.02], [0.12, 0.05], [0.1, 0.08], [0.16, 0.16], [0.21, 0.27], [0.215, 0.34],
    [0.19, 0.43], [0.13, 0.52], [0.09, 0.57], [0.085, 0.62], [0.11, 0.66], [0.125, 0.68], [0.115, 0.69], [0.07, 0.675], [0.0, 0.66],
  ], 160);
  const vaseGeo = lathe(body, 64);
  const ivory = [], gold = [], nero = [];
  const rand = mulberry32(77);
  for (const v of maze.vases) {
    const { x, z } = toWorld(v.x, v.y);
    const ry = rand() * Math.PI * 2;
    const by = TILE_TOP;
    nero.push(worldUV(place(rbox(0.5, 0.1, 0.5, 0.025), x, by + 0.05, z, ry), repeat.nero));
    const s = 0.95 + rand() * 0.15;
    const g = place(vaseGeo, x, by + 0.1, z, ry, s, s, s);
    worldUV(g, repeat.calacatta * 0.6);
    ivory.push(g);
    for (const [ry0, rr] of [[0.27, 0.218], [0.62, 0.09], [0.66, 0.112]]) {
      const t = new THREE.TorusGeometry(rr * s, 0.008, 8, 48); t.rotateX(Math.PI / 2);
      gold.push(place(t, x, by + 0.1 + ry0 * s, z));
    }
  }
  const group = new THREE.Group();
  for (const [list, mat] of [[ivory, m.ivory], [gold, m.gold], [nero, m.nero]]) {
    if (!list.length) continue;
    const me = new THREE.Mesh(merge(list), mat); me.castShadow = true; me.receiveShadow = true; group.add(me);
  }
  group.name = 'vases';
  return group;
}

// ─── Grille de sortie ──────────────────────────────────────
export function createGate(maze, mats) {
  const { m, repeat } = mats;
  const { x, z } = toWorld(maze.gate.x, maze.gate.y);
  const root = new THREE.Group();
  root.position.set(x, 0, z);
  const add = (geo, mat, parent = root) => { const me = new THREE.Mesh(geo, mat); me.castShadow = true; me.receiveShadow = true; parent.add(me); return me; };
  const span = 1.36, colH = 1.25;
  // colonnes (socle noir, fût cannelé doré)
  for (const sx of [-1, 1]) {
    const cx = sx * span / 2;
    add(worldUV(place(rbox(0.3, 0.14, 0.3, 0.03), cx, TILE_TOP + 0.07, 0), repeat.nero), m.nero);
    const shaft = add(new THREE.CylinderGeometry(0.075, 0.09, colH, 24), m.goldBrushed); shaft.position.set(cx, TILE_TOP + 0.14 + colH / 2, 0);
    const cap = add(rbox(0.24, 0.07, 0.24, 0.02), m.gold); cap.position.set(cx, TILE_TOP + 0.14 + colH + 0.035, 0);
    const orb = add(new THREE.SphereGeometry(0.075, 24, 16), m.goldPolished); orb.position.set(cx, TILE_TOP + 0.14 + colH + 0.15, 0);
  }
  // arche
  const archR = span / 2;
  const arch = add(new THREE.TorusGeometry(archR, 0.035, 12, 48, Math.PI), m.gold);
  arch.position.set(0, TILE_TOP + 0.14 + colH + 0.07, 0);
  const archIn = add(new THREE.TorusGeometry(archR - 0.09, 0.02, 10, 48, Math.PI), m.gold);
  archIn.position.copy(arch.position);
  // médaillon
  const med = add(new THREE.CylinderGeometry(0.11, 0.11, 0.03, 32), m.goldPolished);
  med.rotation.x = Math.PI / 2; med.position.set(0, arch.position.y + archR - 0.05, 0);

  // barreaux à pointe de lance (descendent dans le sol à l'ouverture)
  const bars = new THREE.Group();
  const parts = [];
  const n = 9, barH = 1.28;
  for (let i = 0; i < n; i++) {
    const bx = -span / 2 + 0.13 + (i * (span - 0.26)) / (n - 1);
    const h = barH - Math.abs(i - (n - 1) / 2) * 0.0 + (i % 2 ? -0.06 : 0);
    parts.push(place(new THREE.CylinderGeometry(0.016, 0.016, h, 12), bx, TILE_TOP + h / 2, 0));
    const tip = new THREE.ConeGeometry(0.035, 0.11, 4); tip.rotateY(Math.PI / 4);
    parts.push(place(tip, bx, TILE_TOP + h + 0.055, 0));
    parts.push(place(new THREE.SphereGeometry(0.028, 12, 8), bx, TILE_TOP + h - 0.02, 0));
  }
  for (const yy of [0.3, 0.95]) parts.push(place(rbox(span - 0.16, 0.035, 0.04, 0.012), 0, TILE_TOP + yy, 0));
  const barsMesh = add(merge(parts), m.gold, bars);
  barsMesh.name = 'gate-bars';
  root.add(bars);

  // lumière dorée qui s'intensifie à l'ouverture
  const light = new THREE.PointLight(0xffc773, 0, 6, 2);
  light.position.set(0, 0.8, 0.6);
  root.add(light);
  root.userData = { bars, light, travel: barH + 0.25 };
  root.name = 'gate';
  return root;
}

// ─── Lanternes (verre et laiton) ───────────────────────────
export function createLanterns(pillarTops, mats) {
  const { m } = mats;
  const tops = pillarTops.filter((p) => p.lantern);
  const brass = [], glass = [];
  const y = PILLAR_TOP_Y;
  for (const p of tops) {
    brass.push(place(rbox(0.22, 0.04, 0.22, 0.012), p.x, y + 0.02, p.z));
    for (const sx of [-1, 1]) for (const sz of [-1, 1])
      brass.push(place(new THREE.CylinderGeometry(0.008, 0.008, 0.24, 8), p.x + sx * 0.085, y + 0.16, p.z + sz * 0.085));
    const roof = new THREE.ConeGeometry(0.15, 0.1, 4); roof.rotateY(Math.PI / 4);
    brass.push(place(roof, p.x, y + 0.33, p.z));
    brass.push(place(new THREE.SphereGeometry(0.025, 12, 8), p.x, y + 0.4, p.z));
    glass.push(place(new THREE.BoxGeometry(0.17, 0.23, 0.17), p.x, y + 0.16, p.z));
  }
  const group = new THREE.Group();
  if (!tops.length) return { group, flames: null, positions: [] };
  const b = new THREE.Mesh(merge(brass), m.brass); b.castShadow = true; group.add(b);
  const g = new THREE.Mesh(merge(glass), m.glass); g.renderOrder = 2; group.add(g);
  // flammes : instanciées, vacillent individuellement
  const flameGeo = new THREE.SphereGeometry(0.03, 12, 10); flameGeo.scale(1, 1.7, 1);
  const flames = new THREE.InstancedMesh(flameGeo, m.flame, tops.length);
  const positions = [];
  const dummy = new THREE.Object3D();
  tops.forEach((p, i) => {
    dummy.position.set(p.x, y + 0.13, p.z); dummy.updateMatrix(); flames.setMatrixAt(i, dummy.matrix);
    positions.push(new THREE.Vector3(p.x, y + 0.14, p.z));
  });
  group.add(flames);
  group.name = 'lanterns';
  return { group, flames, positions, baseY: y + 0.13 };
}

// ─── Poussière d'or sur les cases visitées ─────────────────
function speckTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const ctx = c.getContext('2d'); const rand = mulberry32(5);
  ctx.clearRect(0, 0, 128, 128);
  for (let i = 0; i < 70; i++) {
    const a = rand() * Math.PI * 2, r = Math.pow(rand(), 0.7) * 54;
    const x = 64 + Math.cos(a) * r, y = 64 + Math.sin(a) * r, s = 0.6 + rand() * 1.6;
    ctx.fillStyle = `rgba(${230 + rand() * 25},${185 + rand() * 40},${90 + rand() * 50},${0.5 + rand() * 0.5})`;
    ctx.beginPath(); ctx.arc(x, y, s, 0, Math.PI * 2); ctx.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export function createGoldDust(capacity = 729) {
  const mat = new THREE.MeshStandardMaterial({ map: speckTexture(), transparent: true, depthWrite: false, metalness: 0.6, roughness: 0.3, emissive: new THREE.Color('#5a3d0a'), emissiveIntensity: 0.4, polygonOffset: true, polygonOffsetFactor: -2 });
  const geo = new THREE.PlaneGeometry(0.8, 0.8); geo.rotateX(-Math.PI / 2);
  const mesh = new THREE.InstancedMesh(geo, mat, capacity);
  mesh.count = 0; mesh.receiveShadow = true; mesh.renderOrder = 1;
  mesh.frustumCulled = false;
  const dummy = new THREE.Object3D();
  const rand = mulberry32(99);
  const seen = new Set();
  return {
    mesh,
    add(gx, gy) {
      const k = gy * 1000 + gx; if (seen.has(k) || mesh.count >= capacity) return;
      seen.add(k);
      const { x, z } = toWorld(gx, gy);
      dummy.position.set(x, TILE_TOP + 0.002, z); dummy.rotation.set(0, rand() * Math.PI * 2, 0);
      const s = 0.85 + rand() * 0.3; dummy.scale.set(s, 1, s); dummy.updateMatrix();
      mesh.setMatrixAt(mesh.count++, dummy.matrix); mesh.instanceMatrix.needsUpdate = true;
    },
    clear() { seen.clear(); mesh.count = 0; },
  };
}

// ─── Paillettes (ouverture des coffrets) & poussière dans le faisceau ──
function dotTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.25, 'rgba(255,236,190,0.8)'); g.addColorStop(1, 'rgba(255,200,120,0)');
  ctx.fillStyle = g; ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}
const DOT = { tex: null };
const dot = () => (DOT.tex ||= dotTexture());

export function createSparkles(count = 160) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3), life = new Float32Array(count);
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: dot(), color: 0xffd98a, size: 0.07, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 1 });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false; points.visible = false;
  let t = 0;
  return {
    points,
    burst(origin) {
      for (let i = 0; i < count; i++) {
        pos[i * 3] = origin.x + (Math.random() - 0.5) * 0.3; pos[i * 3 + 1] = origin.y; pos[i * 3 + 2] = origin.z + (Math.random() - 0.5) * 0.2;
        const a = Math.random() * Math.PI * 2, sp = 0.3 + Math.random() * 0.9;
        vel[i * 3] = Math.cos(a) * sp * 0.6; vel[i * 3 + 1] = 1.2 + Math.random() * 1.8; vel[i * 3 + 2] = Math.sin(a) * sp * 0.6;
        life[i] = 0.8 + Math.random() * 1.2;
      }
      t = 0; points.visible = true; geo.attributes.position.needsUpdate = true;
    },
    update(dt) {
      if (!points.visible) return;
      t += dt;
      for (let i = 0; i < count; i++) {
        vel[i * 3 + 1] -= 2.6 * dt;
        vel[i * 3] *= 0.985; vel[i * 3 + 2] *= 0.985;
        pos[i * 3] += vel[i * 3] * dt; pos[i * 3 + 1] = Math.max(TILE_TOP + 0.01, pos[i * 3 + 1] + vel[i * 3 + 1] * dt); pos[i * 3 + 2] += vel[i * 3 + 2] * dt;
      }
      mat.opacity = Math.max(0, 1 - t / 2.2) * (0.75 + 0.25 * Math.sin(t * 40));
      geo.attributes.position.needsUpdate = true;
      if (t > 2.3) points.visible = false;
    },
  };
}

export function createDustMotes(count, center, radius, height) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
    pos[i * 3] = center.x + Math.cos(a) * r; pos[i * 3 + 1] = 1 + Math.random() * height; pos[i * 3 + 2] = center.z + Math.sin(a) * r;
    seed[i] = Math.random() * 100;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ map: dot(), color: 0xffe2b0, size: 0.05, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const points = new THREE.Points(geo, mat);
  points.frustumCulled = false;
  return {
    points,
    update(dt, time) {
      for (let i = 0; i < count; i++) {
        const s = seed[i];
        pos[i * 3] += Math.sin(time * 0.13 + s) * 0.03 * dt;
        pos[i * 3 + 1] += (Math.sin(time * 0.21 + s * 1.3) * 0.02 - 0.012) * dt;
        pos[i * 3 + 2] += Math.cos(time * 0.11 + s * 0.7) * 0.03 * dt;
        if (pos[i * 3 + 1] < 0.9) pos[i * 3 + 1] = 1 + height;
      }
      geo.attributes.position.needsUpdate = true;
    },
  };
}
