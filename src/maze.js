// ─────────────────────────────────────────────────────────────
//  Génération du labyrinthe (déterministe grâce à une graine fixe)
//  13×13 cellules  →  grille de 27×27 cases (murs compris)
// ─────────────────────────────────────────────────────────────

export const CELLS = 13;
export const SIZE = CELLS * 2 + 1; // 27
export const SEED = 225;            // ne pas changer : le labyrinthe resterait différent
export const COFFRET_COUNT = 6;
export const COFFRET_DEPTH = [3, 10]; // longueur des impasses à coffret (en cases depuis le bon chemin)

export const START = { x: 1, y: 1 };                 // en haut à gauche
export const EXIT = { x: SIZE - 2, y: SIZE - 2 };    // en bas à droite
export const GATE = { x: SIZE - 2, y: SIZE - 1 };    // la grille d'or, dans le mur extérieur

const DIRS = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const key = (x, y) => y * SIZE + x;

/** Labyrinthe « parfait » (arbre couvrant) : un seul chemin entre deux cases, aucune boucle. */
function carve(rand) {
  const grid = Array.from({ length: SIZE }, () => new Uint8Array(SIZE).fill(1));
  const stack = [[START.x, START.y]];
  grid[START.y][START.x] = 0;
  while (stack.length) {
    const [cx, cy] = stack[stack.length - 1];
    const options = DIRS.filter((d) => {
      const nx = cx + d.x * 2, ny = cy + d.y * 2;
      return nx > 0 && ny > 0 && nx < SIZE - 1 && ny < SIZE - 1 && grid[ny][nx] === 1;
    });
    if (!options.length) { stack.pop(); continue; }
    const d = options[Math.floor(rand() * options.length)];
    grid[cy + d.y][cx + d.x] = 0;
    grid[cy + d.y * 2][cx + d.x * 2] = 0;
    stack.push([cx + d.x * 2, cy + d.y * 2]);
  }
  return grid;
}

/**
 * Variante « Prim » : arbre couvrant aussi (un seul chemin, aucune boucle), mais beaucoup
 * de petites ramifications → nombreuses fausses pistes courtes, chemin principal plus direct.
 */
function carvePrim(rand) {
  const grid = Array.from({ length: SIZE }, () => new Uint8Array(SIZE).fill(1));
  const inMaze = (x, y) => grid[y][x] === 0;
  const frontier = [];
  const addFrontier = (x, y) => {
    for (const d of DIRS) {
      const nx = x + d.x * 2, ny = y + d.y * 2;
      if (nx > 0 && ny > 0 && nx < SIZE - 1 && ny < SIZE - 1 && !inMaze(nx, ny)) frontier.push([nx, ny]);
    }
  };
  grid[START.y][START.x] = 0;
  addFrontier(START.x, START.y);
  while (frontier.length) {
    const i = Math.floor(rand() * frontier.length);
    const [cx, cy] = frontier[i];
    frontier[i] = frontier[frontier.length - 1]; frontier.pop();
    if (inMaze(cx, cy)) continue;
    const links = DIRS.filter((d) => {
      const nx = cx + d.x * 2, ny = cy + d.y * 2;
      return nx > 0 && ny > 0 && nx < SIZE - 1 && ny < SIZE - 1 && inMaze(nx, ny);
    });
    const d = links[Math.floor(rand() * links.length)];
    grid[cy][cx] = 0;
    grid[cy + d.y][cx + d.x] = 0;
    addFrontier(cx, cy);
  }
  return grid;
}

function bfs(grid, from) {
  const dist = new Int32Array(SIZE * SIZE).fill(-1);
  const prev = new Int32Array(SIZE * SIZE).fill(-1);
  const q = [from];
  dist[key(from.x, from.y)] = 0;
  for (let i = 0; i < q.length; i++) {
    const c = q[i];
    for (const d of DIRS) {
      const nx = c.x + d.x, ny = c.y + d.y;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || grid[ny][nx]) continue;
      const k = key(nx, ny);
      if (dist[k] !== -1) continue;
      dist[k] = dist[key(c.x, c.y)] + 1;
      prev[k] = key(c.x, c.y);
      q.push({ x: nx, y: ny });
    }
  }
  return { dist, prev };
}

function openNeighbours(grid, x, y) {
  return DIRS.filter((d) => {
    const nx = x + d.x, ny = y + d.y;
    return nx >= 0 && ny >= 0 && nx < SIZE && ny < SIZE && !grid[ny][nx];
  });
}

/** Construit le labyrinthe complet et la liste des objets à placer. */
export function buildMaze(seed = SEED) {
  const rand = mulberry32(seed);
  const grid = carvePrim(rand);
  grid[GATE.y][GATE.x] = 0; // ouverture de la grille d'or dans le mur extérieur

  // Chemin unique départ → sortie
  const { prev } = bfs(grid, START);
  const pathKeys = new Set();
  let k = key(EXIT.x, EXIT.y);
  while (k !== -1) { pathKeys.add(k); k = prev[k]; }
  const path = [...pathKeys].reverse().map((kk) => ({ x: kk % SIZE, y: Math.floor(kk / SIZE) }));

  // Distance de chaque case au bon chemin (profondeur des fausses pistes)
  const depth = new Int32Array(SIZE * SIZE).fill(-1);
  const q = [];
  for (const kk of pathKeys) { depth[kk] = 0; q.push(kk); }
  for (let i = 0; i < q.length; i++) {
    const c = q[i], cx = c % SIZE, cy = Math.floor(c / SIZE);
    for (const d of DIRS) {
      const nx = cx + d.x, ny = cy + d.y;
      if (nx < 0 || ny < 0 || nx >= SIZE || ny >= SIZE || grid[ny][nx]) continue;
      const nk = key(nx, ny);
      if (depth[nk] !== -1) continue;
      depth[nk] = depth[c] + 1;
      q.push(nk);
    }
  }

  // Impasses (hors départ / sortie)
  const deadEnds = [];
  for (let y = 1; y < SIZE; y += 2) {
    for (let x = 1; x < SIZE; x += 2) {
      if ((x === START.x && y === START.y) || (x === EXIT.x && y === EXIT.y)) continue;
      const n = openNeighbours(grid, x, y);
      if (n.length === 1) deadEnds.push({ x, y, depth: depth[key(x, y)], facing: n[0] });
    }
  }

  // 6 coffrets : impasses profondes et bien réparties (sélection gloutonne)
  // Coffrets : au fond d'impasses COURTES (3 à 10 pas du bon chemin), faciles à atteindre,
  // et bien répartis sur tout le plateau (sélection gloutonne par éloignement).
  let pool = deadEnds.filter((d) => d.depth >= COFFRET_DEPTH[0] && d.depth <= COFFRET_DEPTH[1]);
  if (pool.length < COFFRET_COUNT) pool = [...deadEnds].sort((a, b) => a.depth - b.depth);
  const center = (SIZE - 1) / 2;
  const chosen = [pool.reduce((a, b) => (Math.hypot(b.x - 3, b.y - (SIZE - 4)) < Math.hypot(a.x - 3, a.y - (SIZE - 4)) ? b : a))];
  while (chosen.length < COFFRET_COUNT) {
    let best = null, bestScore = -Infinity;
    for (const c of pool) {
      if (chosen.includes(c)) continue;
      const minD = Math.min(...chosen.map((o) => Math.hypot(o.x - c.x, o.y - c.y)));
      const score = minD - Math.abs(c.depth - 5) * 0.4 - Math.hypot(c.x - center, c.y - center) * 0.05;
      if (score > bestScore) { bestScore = score; best = c; }
    }
    chosen.push(best);
  }
  const coffrets = chosen.map((c, i) => ({ id: i, x: c.x, y: c.y, facing: c.facing, depth: c.depth }));
  const vases = deadEnds.filter((d) => !chosen.includes(d)).map((d) => ({ x: d.x, y: d.y, facing: d.facing }));

  // Piliers : angles, croisements et extrémités des murs ; murs droits entre eux
  const isWall = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE && grid[y][x] === 1;
  const pillars = [];
  for (let y = 0; y < SIZE; y += 2) {
    for (let x = 0; x < SIZE; x += 2) {
      if (!isWall(x, y)) continue;
      const n = isWall(x, y - 1), e = isWall(x + 1, y), s = isWall(x, y + 1), w = isWall(x - 1, y);
      const straight = (n && s && !e && !w) || (e && w && !n && !s);
      if (!straight) pillars.push({ x, y, links: n + e + s + w });
    }
  }

  // Rosaces aux croisements (3 ou 4 directions)
  const crossings = [];
  for (let y = 1; y < SIZE; y += 2)
    for (let x = 1; x < SIZE; x += 2)
      if (!grid[y][x] && openNeighbours(grid, x, y).length >= 3) crossings.push({ x, y });

  // Lanternes : quelques piliers répartis, de façon déterministe
  const lr = mulberry32(seed ^ 0x5eed);
  const lanterns = pillars.filter((p) => (p.x % 8 === 0 && p.y % 8 === 0) || lr() < 0.06).map((p) => ({ x: p.x, y: p.y }));

  return { grid, size: SIZE, path, pathKeys, depth, deadEnds, coffrets, vases, pillars, crossings, lanterns, start: START, exit: EXIT, gate: GATE };
}

export const cellKey = key;
