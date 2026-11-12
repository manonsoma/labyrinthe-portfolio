import { SIZE } from '../maze.js';

export const HALF = (SIZE - 1) / 2; // 13
export const WALL_H = 0.95;          // hauteur des murs (1 case = 1 unité ≈ 4 cm)
export const WALL_T = 0.56;          // épaisseur des murs
export const PILLAR = 0.74;          // largeur des piliers
export const TILE_TOP = 0.06;        // dessus des dalles

export const toWorld = (x, y) => ({ x: x - HALF, z: y - HALF });
export const toGrid = (wx, wz) => ({ x: Math.round(wx + HALF), y: Math.round(wz + HALF) });
