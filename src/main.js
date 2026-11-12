// Point d'entrée : assemble la scène 3D, le jeu et l'interface.
import './styles.css';
import * as THREE from 'three';
import { content } from './content.js';
import { buildMaze, cellKey, COFFRET_COUNT } from './maze.js';
import { createMaterials, TEXTURE_SETS } from './scene/materials.js';
import { buildArchitecture } from './scene/architecture.js';
import { createPawn, createCoffret, createVases, createGate, createLanterns, createGoldDust, createSparkles, createDustMotes, createHedgeLeaves } from './scene/objects.js';
import { createEnvironment, createLighting, createLanternLights } from './scene/lighting.js';
import { PostFX } from './scene/postfx.js';
import { CameraRig } from './scene/camera.js';
import { toWorld, toGrid, TILE_TOP } from './scene/coords.js';
import { Game } from './game.js';
import { Sound } from './audio.js';
import { PRESETS, detectTier, readChoice, writeChoice, FpsGovernor } from './quality.js';
import { createLoading } from './ui/loading.js';
import { createIntro } from './ui/intro.js';
import { createHud } from './ui/hud.js';
import { createCardModal } from './ui/cards.js';
import { createNotebook } from './ui/notebook.js';
import { createFinal } from './ui/final.js';
import { anyDialog } from './ui/dialog.js';
import { confirmDialog } from './ui/confirm.js';

document.title = content.site.title;
const TEST = new URLSearchParams(location.search).has('test');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
const app = document.getElementById('app');
const canvas = document.getElementById('scene');
const loading = createLoading(app);

// ── Qualité ───────────────────────────────────────────────
let qualityChoice = readChoice();
let tier = qualityChoice === 'auto' ? detectTier() : qualityChoice;
let preset = PRESETS[tier];

// ── Moteur de rendu ───────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.VSMShadowMap;
// si un shader ne compile pas sur cet appareil, on le note pour basculer sans effets
let shaderError = false;
renderer.debug.onShaderError = (gl, program, vs, fs) => {
  shaderError = true;
  console.error('Shader refusé par la carte graphique :', gl.getProgramInfoLog(program), gl.getShaderInfoLog(vs), gl.getShaderInfoLog(fs));
};
canvas.addEventListener('webglcontextlost', (e) => { e.preventDefault(); console.warn('Contexte WebGL perdu, rechargement…'); setTimeout(() => location.reload(), 800); });

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(34, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 30, 20);

const maze = buildMaze();
const sound = new Sound();

// ── Chargement ────────────────────────────────────────────
const totalSteps = Object.keys(TEXTURE_SETS).length + 4;
let doneSteps = 0;
const progress = () => loading.set(++doneSteps / totalSteps);

async function init() {
  const mats = await createMaterials(renderer, { quality: tier, onProgress: progress });
  await createEnvironment(renderer, scene, progress);
  await new Promise((r) => setTimeout(r, 0));

  const arch = buildArchitecture(maze, mats);
  scene.add(arch.group);
  progress();

  const pawn = createPawn(mats);
  scene.add(pawn);

  const coffrets = maze.coffrets.map((c) => {
    const obj = createCoffret(mats);
    const { x, z } = toWorld(c.x, c.y);
    obj.position.set(x, 0, z);
    obj.rotation.y = Math.atan2(c.facing.x, c.facing.y);
    scene.add(obj);
    return obj;
  });
  scene.add(createVases(maze, mats));
  const leaves = createHedgeLeaves(arch.hedges, mats, PRESETS.high.leaves);
  scene.add(leaves);
  const gate = createGate(maze, mats);
  scene.add(gate);
  const lanterns = createLanterns(arch.pillarTops, mats);
  scene.add(lanterns.group);
  const dust = createGoldDust();
  scene.add(dust.mesh);
  const sparkles = createSparkles();
  scene.add(sparkles.points);
  const motes = createDustMotes(PRESETS.high.dust, new THREE.Vector3(0, 0, 0.5), 11, 9);
  scene.add(motes.points);
  progress();

  const lighting = createLighting(scene, tier);
  const lanternLights = createLanternLights(scene, lanterns, 8);
  const coffretLight = new THREE.PointLight(0xffc977, 0, 3, 2);
  scene.add(coffretLight);
  const postfx = new PostFX(renderer, scene, camera, preset);
  progress();

  // ── Jeu ─────────────────────────────────────────────────
  const rig = new CameraRig(camera, canvas, { reducedMotion });
  const animations = [];
  const animate = (dur, fn, done) => animations.push({ t: 0, dur: reducedMotion ? Math.min(dur, 0.25) : dur, fn, done });

  const game = new Game(maze, pawn, {
    onStep(cell, isNew) {
      dust.add(cell.x, cell.y);
      sound.clack(isNew ? 1 : 0.8);
    },
    onGateLocked(found) { hud.toast(content.messages.gateLocked(found, COFFRET_COUNT)); },
    onDeadEnd(i) { hud.toast(content.messages.deadEnds[i] || content.messages.deadEnds[0]); },
    onCoffret(cf, order, gateNowOpen) { openCoffret(cf, order, gateNowOpen); },
    onExit() { game.paused = true; showFinal(true); },
  });

  function applyStateToScene(instant = true) {
    dust.clear();
    for (const k of game.visited) dust.add(k % maze.size, Math.floor(k / maze.size));
    coffrets.forEach((obj, id) => {
      const open = game.opened.includes(id);
      obj.userData.lidPivot.rotation.x = open ? -1.95 : 0;
      obj.userData.glow.material.opacity = open ? 0.35 : 0;
    });
    gate.userData.bars.position.y = game.gateOpen ? -gate.userData.travel : 0;
    gate.userData.light.intensity = game.gateOpen ? 3.2 : 0;
    gate.userData.burst = false;
    hud.setCount(game.opened.length);
    game.placePawn();
    if (instant) rig.snap(pawn.position);
  }

  function openCoffret(cf, order, gateNowOpen) {
    game.paused = true;
    const obj = coffrets[cf.id];
    const wp = obj.position;
    coffretLight.position.set(wp.x, 0.55, wp.z);
    sound.chime();
    animate(1.4, (k) => {
      // ouverture sur les charnières avec un léger rebond en fin de course
      const e = k < 0.8 ? 1 - Math.pow(1 - k / 0.8, 3) : 1 + Math.sin(((k - 0.8) / 0.2) * Math.PI) * 0.035;
      obj.userData.lidPivot.rotation.x = -1.95 * e;
      obj.userData.glow.material.opacity = 0.9 * Math.min(1, k * 1.6);
      coffretLight.intensity = 3.2 * Math.sin(Math.min(1, k * 1.2) * Math.PI * 0.5);
      if (k > 0.35 && !obj.userData.burst) { obj.userData.burst = true; sparkles.burst(new THREE.Vector3(wp.x, 0.45, wp.z)); }
      if (k > 0.8 && !obj.userData.thud) { obj.userData.thud = true; sound.thud(); }
    }, async () => {
      obj.userData.burst = false; obj.userData.thud = false;
      hud.setCount(game.opened.length);
      hud.setBadge(true);
      await cardModal.show(order);
      animate(1.2, (k) => { coffretLight.intensity = 3.2 * (1 - k); obj.userData.glow.material.opacity = 0.9 - 0.55 * k; });
      if (gateNowOpen) openGate(); else game.paused = false;
    });
  }

  function openGate() {
    hud.toast(content.messages.gateOpen, 5000);
    sound.melody();
    sound.rumble(4.2);
    const bars = gate.userData.bars, light = gate.userData.light, travel = gate.userData.travel;
    const prevMode = rig.mode;
    rig.setMode('follow');
    // la caméra va voir la grille pendant qu'elle descend
    const gp = gate.position.clone();
    rig.lookOverride = gp;
    animate(4.2, (k) => {
      const e = k < 0.5 ? 4 * k * k * k : 1 - Math.pow(-2 * k + 2, 3) / 2;
      bars.position.y = -travel * e;
      bars.position.x = k < 0.9 && !reducedMotion ? Math.sin(k * 160) * 0.003 * (1 - k) : 0;
      light.intensity = 3.2 * Math.min(1, k * 1.5);
      if (k > 0.15 && !gate.userData.burst) { gate.userData.burst = true; sparkles.burst(new THREE.Vector3(gate.position.x, 0.4, gate.position.z - 0.3)); }
    }, () => { rig.lookOverride = null; rig.setMode(prevMode); game.paused = false; });
  }

  // ── Interface ───────────────────────────────────────────
  const notebook = createNotebook(app, {
    onOpenCard: (i) => cardModal.show(i, { reveal: false }),
  });
  const cardModal = createCardModal(app);
  const final = createFinal(app, {
    onClose: () => { final.close(); resumeAfterFinal(); },
    onNotebook: () => notebook.open(game.opened.length),
    onReplay: () => { final.close(); restart(); startGame(); },
    onPlay: () => { final.close(); startGame(); },
  });

  let started = false;
  function showFinal(completed) {
    intro.hide();
    final.open({ revealed: game.opened.length, completed });
  }
  function resumeAfterFinal() {
    if (!started) { intro.show(); return; }
    game.paused = false;
  }

  const hud = createHud(app, {
    onNotebook: () => { hud.setBadge(false); notebook.open(game.opened.length); },
    onView: () => { const board = rig.mode !== 'board'; rig.setMode(board ? 'board' : 'follow'); hud.setView(board); postfx.setBoardView(board); },
    onSound: () => { sound.unlock(); sound.setEnabled(!sound.enabled); hud.setSound(sound.enabled); if (sound.enabled && ambienceWanted) sound.setAmbience(true); },
    onAmbience: (on) => { ambienceWanted = on; sound.unlock(); sound.setAmbience(on); hud.setAmbience(on); },
    onQuality: (q) => setQuality(q, true),
    onRestart: async () => { if (await confirmDialog(app, content.messages.restartConfirm, { ok: content.ui.restart })) restart(); },
    onDirDown: (d) => { sound.unlock(); if (rig.mode === 'board') {} game.setHeld(d); },
    onDirUp: (d) => { if (game.held === d) game.setHeld(null); },
    onDirTap: (d) => game.step(d),
  });
  let ambienceWanted = false;
  hud.setSound(sound.enabled);
  hud.setQuality(qualityChoice);

  const intro = createIntro(app, {
    resumed: game.resumed,
    onStart: () => { sound.unlock(); startGame(); },
    onSkip: () => showFinal(false),
  });

  function startGame() {
    started = true;
    intro.hide();
    hud.show();
    game.paused = false;
    if (game.resumed && !startGame.told) { startGame.told = true; hud.toast(content.messages.resumed); }
    canvas.focus({ preventScroll: true });
  }

  function restart() {
    game.reset(true);
    applyStateToScene(false);
    hud.setBadge(false);
    rig.setMode('follow'); hud.setView(false);
    game.paused = !started;
  }

  // lien d'évitement « Aller directement au parcours »
  document.querySelector('.skip')?.addEventListener('click', (e) => { e.preventDefault(); showFinal(game.finished); });

  // ── Clavier ─────────────────────────────────────────────
  const KEYS = { arrowup: 'up', z: 'up', w: 'up', arrowdown: 'down', s: 'down', arrowleft: 'left', q: 'left', a: 'left', arrowright: 'right', d: 'right' };
  const pressed = [];
  window.addEventListener('keydown', (e) => {
    if (anyDialog() || !started) return;
    if (e.target.closest?.('.menu')) return;
    const k = e.key.toLowerCase();
    const dir = KEYS[k];
    if (dir) {
      e.preventDefault();
      sound.unlock();
      if (!pressed.includes(dir)) pressed.push(dir);
      if (!e.repeat) game.setHeld(dir);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    if (k === 'c') hud.el.querySelector('[data-nb]').click();
    if (k === 'v') hud.el.querySelector('[data-view]').click();
    if (k === 'm') hud.el.querySelector('[data-sound]').click();
  });
  window.addEventListener('keyup', (e) => {
    const dir = KEYS[e.key.toLowerCase()];
    if (!dir) return;
    const i = pressed.indexOf(dir); if (i >= 0) pressed.splice(i, 1);
    game.setHeld(pressed[pressed.length - 1] || null);
  });
  window.addEventListener('blur', () => { pressed.length = 0; game.setHeld(null); });

  // ── Clic sur une case alignée ───────────────────────────
  const ray = new THREE.Raycaster();
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -TILE_TOP);
  const hit = new THREE.Vector3();
  const cellFromScreen = (cx, cy) => {
    const r = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1), camera);
    if (!ray.ray.intersectPlane(plane, hit)) return null;
    return toGrid(hit.x, hit.z);
  };
  rig.onTap = (cx, cy) => {
    if (!started || anyDialog()) return;
    sound.unlock();
    const c = cellFromScreen(cx, cy);
    if (c) game.clickCell(c.x, c.y);
  };
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType !== 'mouse' || rig.drag) return;
    const c = cellFromScreen(e.clientX, e.clientY);
    let ok = false;
    if (c && started && !game.paused && (c.x === game.pos.x) !== (c.y === game.pos.y)) {
      ok = true;
      const dx = Math.sign(c.x - game.pos.x), dy = Math.sign(c.y - game.pos.y);
      for (let x = game.pos.x, y = game.pos.y; x !== c.x || y !== c.y;) { x += dx; y += dy; if (!game.isOpen(x, y)) { ok = false; break; } }
    }
    canvas.classList.toggle('can-move', ok);
  });

  // ── Qualité ─────────────────────────────────────────────
  let elapsed = 0;
  // 3 contrôles seulement après le départ / un changement de qualité (lire des pixels ralentit le GPU)
  let nextBlackCheck = 2, blackFrames = 0, blackChecks = 0;
  function applyPreset() {
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, preset.pixelRatio));
    lighting.lamp.shadow.mapSize.set(preset.shadowMap, preset.shadowMap);
    lighting.lamp.shadow.map?.dispose(); lighting.lamp.shadow.map = null;
    lanternLights.setCount(preset.lanternLights);
    motes.points.geometry.setDrawRange(0, preset.dust);
    motes.points.visible = preset.dust > 0;
    leaves.count = preset.leaves;
    leaves.visible = preset.leaves > 0;
    postfx.setQuality(preset);
    blackChecks = 0; nextBlackCheck = elapsed + 2;
    resize();
  }
  function setQuality(choice, persist) {
    qualityChoice = choice;
    if (persist) writeChoice(choice);
    tier = choice === 'auto' ? detectTier() : choice;
    preset = PRESETS[tier];
    hud.setQuality(choice);
    applyPreset();
  }
  const governor = new FpsGovernor(() => {
    if (qualityChoice !== 'auto') return;
    const next = tier === 'high' ? 'medium' : tier === 'medium' ? 'low' : null;
    if (!next) return;
    tier = next; preset = PRESETS[tier]; applyPreset();
  });

  // ── Redimensionnement ───────────────────────────────────
  function resize() {
    const w = window.innerWidth, h = window.innerHeight;
    renderer.setSize(w, h);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    const span = 31.5, t = Math.tan(THREE.MathUtils.degToRad(camera.fov / 2));
    rig.board.radius = Math.max(span / 2 / t, span / 2 / (t * camera.aspect)) * 1.05;
    rig.follow.radius = camera.aspect < 0.8 ? 13 : 10;
    postfx.setSize(w, h);
  }
  window.addEventListener('resize', resize);

  applyStateToScene();
  applyPreset();
  rig.cur = { radius: rig.board.radius * 0.9, polar: 0.55, azimuth: -0.5 };
  rig.focus.set(0, 0, 0);

  // ── Boucle ──────────────────────────────────────────────
  const timer = new THREE.Timer();
  timer.connect(document);
  const lookTmp = new THREE.Vector3();
  const px = new Uint8Array(4);
  const gl = renderer.getContext();
  // lit quelques pixels juste après le rendu (même image) : tout à 0 = écran noir
  function isBlackFrame() {
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    let lit = 0;
    for (const [fx, fy] of [[0.5, 0.5], [0.35, 0.45], [0.65, 0.55], [0.5, 0.3], [0.5, 0.7]]) {
      gl.readPixels(Math.floor(w * fx), Math.floor(h * fy), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
      if (px[0] + px[1] + px[2] > 6) lit++;
    }
    return lit === 0;
  }
  renderer.setAnimationLoop(() => {
    timer.update();
    const dt = Math.min(timer.getDelta(), TEST ? 0.5 : 1 / 20);
    elapsed += dt;
    game.update(dt);
    for (let i = animations.length - 1; i >= 0; i--) {
      const a = animations[i];
      a.t += dt;
      const k = Math.min(1, a.t / a.dur);
      a.fn(k);
      if (k >= 1) { animations.splice(i, 1); a.done?.(); }
    }
    // avant le début : lent survol du plateau
    if (!started) {
      rig.cur.azimuth = -0.5 + Math.sin(elapsed * 0.08) * 0.35;
      rig.camera.position.set(Math.sin(rig.cur.azimuth) * Math.sin(rig.cur.polar) * rig.cur.radius, Math.cos(rig.cur.polar) * rig.cur.radius, Math.cos(rig.cur.azimuth) * Math.sin(rig.cur.polar) * rig.cur.radius);
      camera.lookAt(0, 0, 0);
    } else {
      rig.update(dt, rig.lookOverride ? lookTmp.copy(rig.lookOverride).lerp(pawn.position, 0.35) : pawn.position);
    }
    sparkles.update(dt);
    if (motes.points.visible && !reducedMotion) motes.update(dt, elapsed);
    lanternLights.update(dt, elapsed, rig.focus);
    if (started) governor.tick(dt);
    try {
      postfx.render(dt);
    } catch (err) {
      console.error(err);
      if (!postfx.failed) { postfx.disableEffects(); } else throw err;
    }
    // filet de sécurité : image entièrement noire avec les effets → on les coupe
    if (shaderError && !postfx.failed) { postfx.disableEffects(); hud.toast('Effets visuels désactivés sur cet appareil.'); }
    if (started && !postfx.failed && postfx.composer && blackChecks < 3 && elapsed > nextBlackCheck) {
      nextBlackCheck = elapsed + 1.5; blackChecks++;
      if (isBlackFrame()) { blackFrames++; if (blackFrames >= 2) { console.warn('Image noire détectée : effets désactivés.'); postfx.disableEffects(); hud.toast('Effets visuels désactivés sur cet appareil.'); } }
      else blackFrames = 0;
    }
  });

  loading.done();
  intro.show();
  if (game.finished && location.hash === '#final') showFinal(true);

  // accès pour le débogage dans la console
  window.__labyrinthe = { game, rig, renderer, scene, setQuality, postfx };
}

init().catch((err) => {
  console.error(err);
  const p = document.createElement('p');
  p.style.cssText = 'position:fixed;inset:auto 0 2rem;text-align:center;color:#ead39a;font-family:serif;z-index:99';
  p.textContent = "Le plateau n'a pas pu se charger sur cet appareil. Rechargez la page, ou essayez un navigateur récent.";
  document.body.appendChild(p);
});
