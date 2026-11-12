// État du jeu, déplacements case par case, règles et sauvegarde.
import * as THREE from 'three';
import { cellKey, COFFRET_COUNT } from './maze.js';
import { toWorld, TILE_TOP } from './scene/coords.js';

const SAVE_KEY = 'labyrinthe-manon-soma-v1';
export const DIRS = {
  up: { x: 0, y: -1 },
  right: { x: 1, y: 0 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
};

const storage = {
  get() { try { return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null'); } catch { return null; } },
  set(v) { try { localStorage.setItem(SAVE_KEY, JSON.stringify(v)); } catch { /* navigation privée */ } },
  clear() { try { localStorage.removeItem(SAVE_KEY); } catch { /* rien */ } },
};

export class Game {
  constructor(maze, pawn, hooks = {}) {
    this.maze = maze;
    this.pawn = pawn;
    this.hooks = hooks;
    this.coffretAt = new Map(maze.coffrets.map((c) => [cellKey(c.x, c.y), c]));
    this.vaseAt = new Set(maze.vases.map((v) => cellKey(v.x, v.y)));
    this.queue = [];
    this.held = null;
    this.anim = null;
    this.paused = true;
    this.stepDuration = 0.24;
    this.reset(false);
    const saved = storage.get();
    this.resumed = false;
    if (saved && saved.v === 1) this.load(saved);
    this.placePawn();
  }

  reset(save = true) {
    this.pos = { ...this.maze.start };
    this.visited = new Set([cellKey(this.pos.x, this.pos.y)]);
    this.opened = []; // ids des coffrets, dans l'ordre d'ouverture
    this.deadEndsSeen = new Set();
    this.deadEndMsgs = 0;
    this.finished = false;
    this.queue = [];
    this.anim = null;
    if (save) { storage.clear(); this.placePawn(); }
  }

  load(s) {
    const okCell = (p) => p && this.isOpen(p.x, p.y);
    if (okCell(s.pos)) this.pos = { x: s.pos.x, y: s.pos.y };
    this.visited = new Set(s.visited || []);
    this.visited.add(cellKey(this.pos.x, this.pos.y));
    this.opened = (s.opened || []).filter((id) => id >= 0 && id < COFFRET_COUNT);
    this.deadEndsSeen = new Set(s.deadEndsSeen || []);
    this.deadEndMsgs = s.deadEndMsgs || 0;
    this.finished = !!s.finished;
    // si le pion était dans la grille, on le replace devant
    if (this.pos.x === this.maze.gate.x && this.pos.y === this.maze.gate.y) this.pos = { ...this.maze.exit };
    this.resumed = this.visited.size > 1 || this.opened.length > 0;
  }

  save() {
    storage.set({
      v: 1,
      pos: this.pos,
      visited: [...this.visited],
      opened: this.opened,
      deadEndsSeen: [...this.deadEndsSeen],
      deadEndMsgs: this.deadEndMsgs,
      finished: this.finished,
    });
  }

  get gateOpen() { return this.opened.length >= COFFRET_COUNT; }
  get busy() { return !!this.anim || this.paused; }

  isOpen(x, y) {
    const g = this.maze.grid;
    return y >= 0 && x >= 0 && y < g.length && x < g.length && g[y][x] === 0;
  }

  isGate(x, y) { return x === this.maze.gate.x && y === this.maze.gate.y; }

  placePawn() {
    const { x, z } = toWorld(this.pos.x, this.pos.y);
    this.pawn.position.set(x, TILE_TOP, z);
    this.pawn.userData.tilt.rotation.set(0, 0, 0);
  }

  // ── Entrées ────────────────────────────────────────────
  setHeld(dirName) {
    this.held = dirName;
    if (dirName && !this.anim && !this.queue.length) this.tryStep(dirName);
  }

  step(dirName) {
    if (this.anim) { if (!this.queue.length) this.pendingDir = dirName; return; }
    this.tryStep(dirName);
  }

  /** Clic sur une case : uniquement si elle est alignée avec le pion et sans mur entre les deux. */
  clickCell(x, y) {
    if (this.paused) return false;
    const from = this.anim ? this.anim.to : this.pos;
    if (x === from.x && y === from.y) return false;
    if (x !== from.x && y !== from.y) return false;
    const dx = Math.sign(x - from.x), dy = Math.sign(y - from.y);
    const cells = [];
    let cx = from.x, cy = from.y;
    while (cx !== x || cy !== y) {
      cx += dx; cy += dy;
      if (!this.isOpen(cx, cy)) return false;
      if (this.isGate(cx, cy) && !this.gateOpen) { cells.push({ x: cx, y: cy, locked: true }); break; }
      cells.push({ x: cx, y: cy });
      // on s'arrête sur un coffret non ouvert
      const cf = this.coffretAt.get(cellKey(cx, cy));
      if (cf && !this.opened.includes(cf.id)) break;
    }
    this.queue = cells;
    if (!this.anim) this.next();
    return true;
  }

  tryStep(dirName) {
    if (this.paused) return;
    const d = DIRS[dirName];
    const nx = this.pos.x + d.x, ny = this.pos.y + d.y;
    if (!this.isOpen(nx, ny)) { this.bump(d); return; }
    if (this.isGate(nx, ny) && !this.gateOpen) { this.hooks.onGateLocked?.(this.opened.length); this.bump(d); return; }
    this.startMove({ x: nx, y: ny });
  }

  next() {
    if (this.paused) { this.queue = []; return; }
    if (this.queue.length) {
      const c = this.queue.shift();
      if (c.locked) { this.queue = []; this.hooks.onGateLocked?.(this.opened.length); return; }
      this.startMove(c);
      return;
    }
    const dir = this.pendingDir || this.held;
    this.pendingDir = null;
    if (dir) this.tryStep(dir);
  }

  bump(d) {
    if (this.anim) return;
    this.anim = { bump: true, d, t: 0, dur: 0.18 };
  }

  startMove(to) {
    const fromW = toWorld(this.pos.x, this.pos.y), toW = toWorld(to.x, to.y);
    this.anim = { from: new THREE.Vector3(fromW.x, TILE_TOP, fromW.z), to, toV: new THREE.Vector3(toW.x, TILE_TOP, toW.z), d: { x: to.x - this.pos.x, y: to.y - this.pos.y }, t: 0, dur: this.stepDuration };
  }

  update(dt) {
    const a = this.anim;
    if (!a) return;
    a.t += dt;
    const k = Math.min(1, a.t / a.dur);
    const tilt = this.pawn.userData.tilt;
    if (a.bump) {
      const s = Math.sin(k * Math.PI) * 0.06;
      const { x, z } = toWorld(this.pos.x, this.pos.y);
      this.pawn.position.set(x + a.d.x * s, TILE_TOP, z + a.d.y * s);
      tilt.rotation.set(a.d.y * s * 1.2, 0, -a.d.x * s * 1.2);
      if (k >= 1) { this.anim = null; this.placePawn(); this.next(); }
      return;
    }
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2; // easeInOutQuad
    this.pawn.position.lerpVectors(a.from, a.toV, e);
    this.pawn.position.y = TILE_TOP + Math.sin(k * Math.PI) * 0.12;
    const lean = Math.sin(k * Math.PI) * 0.16;
    tilt.rotation.set(a.d.y * lean, 0, -a.d.x * lean);
    if (k >= 1) {
      this.anim = null;
      tilt.rotation.set(0, 0, 0);
      this.pawn.position.copy(a.toV);
      this.arrive(a.to);
    }
  }

  arrive(cell) {
    this.pos = { x: cell.x, y: cell.y };
    const k = cellKey(cell.x, cell.y);
    const isNew = !this.visited.has(k);
    this.visited.add(k);
    this.hooks.onStep?.(cell, isNew);

    if (this.isGate(cell.x, cell.y) && this.gateOpen) {
      this.queue = []; this.held = null;
      this.finished = true; this.save();
      this.hooks.onExit?.();
      return;
    }
    const cf = this.coffretAt.get(k);
    if (cf && !this.opened.includes(cf.id)) {
      this.queue = []; this.held = null; this.pendingDir = null;
      this.opened.push(cf.id);
      const order = this.opened.length - 1; // carte I, II, III… dans l'ordre de découverte
      this.save();
      this.hooks.onCoffret?.(cf, order, this.gateOpen);
      return;
    }
    if (this.vaseAt.has(k) && !this.deadEndsSeen.has(k)) {
      this.deadEndsSeen.add(k);
      if (this.deadEndMsgs < 3) { this.hooks.onDeadEnd?.(this.deadEndMsgs); this.deadEndMsgs++; }
    }
    this.save();
    this.next();
  }
}
