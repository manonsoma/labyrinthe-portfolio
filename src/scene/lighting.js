// Éclairage : lampe principale chaude au-dessus de la table, environnement pour les reflets,
// lanternes (quelques vraies sources de lumière qui suivent le pion, les autres en émissif).
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';

const BASE = import.meta.env.BASE_URL;
const kelvin = (k) => {
  // approximation de la couleur du corps noir (Tanner Helland)
  const t = k / 100; let r, g, b;
  r = t <= 66 ? 255 : 329.698727446 * Math.pow(t - 60, -0.1332047592);
  g = t <= 66 ? 99.4708025861 * Math.log(t) - 161.1195681661 : 288.1221695283 * Math.pow(t - 60, -0.0755148492);
  b = t >= 66 ? 255 : t <= 19 ? 0 : 138.5177312231 * Math.log(t - 10) - 305.0447927307;
  const c = (x) => Math.min(255, Math.max(0, x)) / 255;
  return new THREE.Color().setRGB(c(r), c(g), c(b), THREE.SRGBColorSpace);
};

export async function createEnvironment(renderer, scene, onProgress) {
  const pmrem = new THREE.PMREMGenerator(renderer);
  let envTex = null;
  try {
    const r = await fetch(`${BASE}hdri/manifest.json`);
    if (r.ok && (r.headers.get('content-type') || '').includes('json')) {
      const { file } = await r.json();
      const hdr = await new HDRLoader().loadAsync(`${BASE}hdri/${file}`);
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      envTex = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
    }
  } catch { /* secours : environnement de studio généré */ }
  if (!envTex) {
    const room = new RoomEnvironment();
    // teinte ambrée de la pièce virtuelle
    room.traverse((o) => { if (o.material && o.material.color) o.material.color.multiply(new THREE.Color(1.0, 0.86, 0.66)); });
    envTex = pmrem.fromScene(room, 0.04).texture;
  }
  pmrem.dispose();
  scene.environment = envTex;
  scene.environmentIntensity = 0.42;
  scene.background = new THREE.Color('#050c09');
  onProgress?.();
  return envTex;
}

export function createLighting(scene, quality) {
  const group = new THREE.Group();
  group.name = 'lighting';

  const warm = kelvin(2700);
  const lamp = new THREE.SpotLight(warm, 2400, 80, 0.5, 0.75, 2);
  lamp.position.set(-2.5, 34, 7);
  lamp.target.position.set(0, 0, 0.5);
  lamp.castShadow = true;
  const sm = quality === 'high' ? 4096 : quality === 'medium' ? 2048 : 1024;
  lamp.shadow.mapSize.set(sm, sm);
  lamp.shadow.camera.near = 20;
  lamp.shadow.camera.far = 45;
  lamp.shadow.bias = -0.00012;
  lamp.shadow.normalBias = 0.02;
  lamp.shadow.radius = 4;
  lamp.shadow.blurSamples = 16;
  group.add(lamp, lamp.target);

  // lumière d'appoint très faible, froide, venant de la pièce
  const hemi = new THREE.HemisphereLight(0x8fa7a0, 0x1a120a, 0.12);
  group.add(hemi);

  scene.add(group);
  return { group, lamp, hemi, warm };
}

/** Pool de vraies lumières de lanternes (8 max) attribuées aux lanternes les plus proches. */
export function createLanternLights(scene, lanterns, max = 8) {
  const lights = [];
  const n = Math.min(max, lanterns.positions.length);
  for (let i = 0; i < n; i++) {
    const l = new THREE.PointLight(kelvin(1900), 0.9, 3.2, 2);
    l.castShadow = false;
    scene.add(l);
    lights.push(l);
  }
  const phase = lanterns.positions.map((_, i) => i * 1.731);
  const dummy = new THREE.Object3D();
  const order = lanterns.positions.map((_, i) => i);
  let acc = 1;
  return {
    lights,
    setCount(c) { lights.forEach((l, i) => (l.visible = i < c)); },
    update(dt, time, focus) {
      // vacillement des flammes (toutes) : échelle instanciée
      if (lanterns.flames) {
        lanterns.positions.forEach((p, i) => {
          const f = 1 + Math.sin(time * 9 + phase[i]) * 0.06 + Math.sin(time * 23.1 + phase[i] * 2) * 0.04;
          dummy.position.set(p.x, lanterns.baseY, p.z);
          dummy.scale.set(1, f, 1); dummy.updateMatrix();
          lanterns.flames.setMatrixAt(i, dummy.matrix);
        });
        lanterns.flames.instanceMatrix.needsUpdate = true;
      }
      acc += dt;
      if (acc > 0.5 && focus) {
        acc = 0;
        order.sort((a, b) => lanterns.positions[a].distanceToSquared(focus) - lanterns.positions[b].distanceToSquared(focus));
      }
      lights.forEach((l, i) => {
        const idx = order[i]; if (idx === undefined) return;
        l.position.copy(lanterns.positions[idx]);
        l.intensity = 0.85 * (1 + Math.sin(time * 11 + phase[idx]) * 0.08 + Math.sin(time * 27 + phase[idx]) * 0.05);
      });
    },
  };
}
