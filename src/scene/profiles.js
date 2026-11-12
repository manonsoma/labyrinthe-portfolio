// Outils de géométrie « moulurée » : profils tournés (ronds ou carrés), profils extrudés.
import * as THREE from 'three';
import { toCreasedNormals } from 'three/addons/utils/BufferGeometryUtils.js';

/** Arc de cercle échantillonné (pour tores, doucines, quarts-de-rond). */
export function arc(cx, cy, r, a0, a1, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    out.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return out;
}

/** Courbe de Bézier cubique échantillonnée entre p0 et p3. */
export function cubic(p0, p1, p2, p3, n = 10) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([
      u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
      u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
    ]);
  }
  return out;
}

const dedupe = (pts) => pts.filter((p, i) => i === 0 || Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]) > 1e-5);

/** Profil tourné rond (pion, colonnes, vases…). pts = [rayon, hauteur]. */
export function roundLathe(pts, segments = 48) {
  const g = new THREE.LatheGeometry(dedupe(pts).map(([r, y]) => new THREE.Vector2(Math.max(0, r), y)), segments);
  return toCreasedNormals(g, Math.PI / 5);
}

/** Profil tourné CARRÉ (piliers) : pts = [demi-côté, hauteur]. Les angles sont à onglet, comme une vraie moulure. */
export function squareLathe(pts) {
  const g = new THREE.LatheGeometry(dedupe(pts).map(([h, y]) => new THREE.Vector2(Math.max(0, h) * Math.SQRT2, y)), 4);
  g.rotateY(Math.PI / 4);
  return toCreasedNormals(g, Math.PI / 5);
}

/**
 * Profil symétrique extrudé le long de l'axe X (plinthes, moulures linéaires).
 * right = points [décalage latéral, hauteur] du côté droit, de bas en haut.
 */
export function extrudeProfile(right, len) {
  const pts = dedupe(right);
  const shape = new THREE.Shape();
  shape.moveTo(-pts[0][0], pts[0][1]);
  for (const [x, y] of pts) shape.lineTo(x, y);
  for (let i = pts.length - 1; i >= 0; i--) shape.lineTo(-pts[i][0], pts[i][1]);
  const g = new THREE.ExtrudeGeometry(shape, { depth: len, bevelEnabled: false, curveSegments: 4 });
  g.translate(0, 0, -len / 2);
  g.rotateY(Math.PI / 2);
  return toCreasedNormals(g, Math.PI / 5);
}
