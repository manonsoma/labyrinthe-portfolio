// Post-traitement (pmndrs/postprocessing) : occlusion ambiante N8AO, SMAA, tone mapping.
// En qualité « Basse », rendu direct (plus léger).
import * as THREE from 'three';
import { EffectComposer, RenderPass, EffectPass, SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode } from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

export class PostFX {
  constructor(renderer, scene, camera, preset) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.exposure = 1.1;
    this.composer = null;
    this.setQuality(preset);
  }

  build() {
    const { renderer, scene, camera } = this;
    const size = renderer.getSize(new THREE.Vector2());
    const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(scene, camera));
    if (this.preset.ao) {
      const ao = new N8AOPostPass(scene, camera, size.x, size.y);
      ao.configuration.aoRadius = 0.55;
      ao.configuration.distanceFalloff = 0.6;
      ao.configuration.intensity = 3.2;
      ao.configuration.color = new THREE.Color('#1a120a');
      // NB : le mode demi-résolution de N8AO 2.0 plante avec three r187 → pleine résolution,
      // et moins d'échantillons sur les appareils modestes.
      ao.configuration.halfRes = false;
      ao.configuration.gammaCorrection = false;
      ao.setQualityMode(this.preset.aoHalf ? 'Performance' : 'Medium');
      composer.addPass(ao);
      this.ao = ao;
    }
    const effects = [];
    if (this.preset.smaa) effects.push(new SMAAEffect({ preset: SMAAPreset.HIGH }));
    this.toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    effects.push(this.toneMapping);
    composer.addPass(new EffectPass(camera, ...effects));
    this.composer = composer;
  }

  setQuality(preset) {
    this.preset = preset;
    this.composer?.dispose();
    this.composer = null; this.ao = null;
    const direct = !preset.ao && !preset.smaa;
    this.renderer.toneMapping = direct ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    this.renderer.toneMappingExposure = this.exposure;
    if (!direct) this.build();
  }

  setSize(w, h) { this.composer?.setSize(w, h); }

  render(dt) {
    if (this.composer) {
      this.renderer.toneMappingExposure = this.exposure;
      this.composer.render(dt);
    } else this.renderer.render(this.scene, this.camera);
  }
}
