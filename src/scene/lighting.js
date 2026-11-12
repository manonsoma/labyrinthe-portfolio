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
      const hdr = await new HDRLoader().setDataType(THREE.FloatType).loadAsync(`${BASE}hdri/${file}`);
      // l'HDRI « coin du feu » est très orangé : on garde 40 % de sa saturation
      // pour des reflets chaleureux sans teinter tout le plateau.
      const d = hdr.image.data;
      for (let i = 0; i < d.length; i += 4) {
        const l = d[i] * 0.2126 + d[i + 1] * 0.7152 + d[i + 2] * 0.0722;
        d[i] = l + (d[i] - l) * 0.4; d[i + 1] = l + (d[i + 1] - l) * 0.4; d[i + 2] = l + (d[i + 2] - l) * 0.4;
      }
      hdr.needsUpdate = true;
      hdr.mapping = THREE.EquirectangularReflectionMapping;
      envTex = pmrem.fromEquirectangular(hdr).texture;
      hdr.dispose();
      scene.userData.hdri = true;
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
  // l'HDRI (salon au coin du feu, la nuit) ne sert qu'aux reflets : le fond reste sombre
  scene.environmentIntensity = scene.userData.hdri ? 0.6 : 0.55;
  scene.environmentRotation.set(0, 2.1, 0);
  scene.background = new THREE.Color('#06150f');
  onProgress?.();
  return envTex;
}

export function createLighting(scene, quality) {
  const group = new THREE.Group();
  group.name = 'lighting';

  const warm = kelvin(2850);
  const lamp = new THREE.SpotLight(warm, 2600, 80, 0.56, 0.8, 2);
  // un peu en arrière : le reflet de l'ampoule sur le marbre ne tombe pas dans l'œil de la caméra
  lamp.position.set(-7, 33, -6);
  lamp.target.position.set(0, 0, 0.5);
  lamp.castShadow = true;
  const sm = quality === 'high' ? 4096 : quality === 'medium' ? 2048 : 1024;
  lamp.shadow.mapSize.set(sm, sm);
  lamp.shadow.camera.near = 18;
  lamp.shadow.camera.far = 55;
  // ombres douces (VSM) : flou réglé par radius / blurSamples
  lamp.shadow.bias = -0.0004;
  lamp.shadow.normalBias = 0.015;
  lamp.shadow.radius = quality === 'low' ? 3 : 7;
  lamp.shadow.blurSamples = quality === 'high' ? 24 : 12;
  group.add(lamp, lamp.target);

  // lumière d'appoint très faible, froide, venant de la pièce
  const hemi = new THREE.HemisphereLight(0xb7cfc2, 0x2a1608, 0.22);
  group.add(hemi);
  // contre-jour très doux venant de la salle (éclaire les faces des murs tournées vers la caméra)
  const fill = new THREE.DirectionalLight(0xc9d8e6, 0.35);
  fill.position.set(6, 10, 22);
  group.add(fill);

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
