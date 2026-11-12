// Post-traitement cinématique mais discret (pmndrs/postprocessing) :
// occlusion ambiante N8AO → lueur (bloom) sur l'or et les lanternes → tone mapping ACES
// → étalonnage chaud → vignettage → SMAA → effet miniature (tilt-shift) + grain de film.
// En qualité « Basse », rendu direct (beaucoup plus léger).
import * as THREE from 'three';
import {
  EffectComposer, RenderPass, EffectPass, Effect, BlendFunction,
  SMAAEffect, SMAAPreset, ToneMappingEffect, ToneMappingMode,
  BloomEffect, VignetteEffect, NoiseEffect, TiltShiftEffect, KernelSize,
} from 'postprocessing';
import { N8AOPostPass } from 'n8ao';

/**
 * Nettoyage HDR : sur les vraies cartes graphiques (demi-flottants), un reflet extrême peut devenir
 * « infini » ; le flou de la lueur l'étale alors en NaN sur tout l'écran (écran noir). On borne tout.
 */
class SanitizeEffect extends Effect {
  constructor() {
    super('SanitizeEffect', /* glsl */ `
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        if (any(isnan(c)) || any(isinf(c))) c = vec3(0.0);
        outputColor = vec4(clamp(c, 0.0, 24.0), 1.0);
      }`);
  }
}

/** Étalonnage : ombres légèrement chaudes (brun), hautes lumières dorées. */
class GradeEffect extends Effect {
  constructor({ shadows = new THREE.Color(1.04, 0.98, 0.9), highlights = new THREE.Color(1.05, 1.0, 0.86), amount = 1, saturation = 1.06 } = {}) {
    super('GradeEffect', /* glsl */ `
      uniform vec3 shadowTint;
      uniform vec3 highlightTint;
      uniform float amount;
      uniform float saturation;
      void mainImage(const in vec4 inputColor, const in vec2 uv, out vec4 outputColor) {
        vec3 c = inputColor.rgb;
        float l = dot(c, vec3(0.2126, 0.7152, 0.0722));
        vec3 sh = mix(vec3(1.0), shadowTint, (1.0 - smoothstep(0.0, 0.45, l)) * amount);
        vec3 hi = mix(vec3(1.0), highlightTint, smoothstep(0.45, 1.0, l) * amount);
        c *= sh * hi;
        c = mix(vec3(dot(c, vec3(0.2126, 0.7152, 0.0722))), c, saturation);
        outputColor = vec4(c, inputColor.a);
      }`, {
      uniforms: new Map([
        ['shadowTint', new THREE.Uniform(shadows)],
        ['highlightTint', new THREE.Uniform(highlights)],
        ['amount', new THREE.Uniform(amount)],
        ['saturation', new THREE.Uniform(saturation)],
      ]),
    });
  }
}

export class PostFX {
  constructor(renderer, scene, camera, preset) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    this.exposure = 1.1;
    this.composer = null;
    this.setQuality(preset);
  }

  build() {
    const { renderer, scene, camera, preset } = this;
    const size = renderer.getSize(new THREE.Vector2());
    const composer = new EffectComposer(renderer, { frameBufferType: THREE.HalfFloatType, multisampling: 0 });
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new EffectPass(camera, new SanitizeEffect()));

    if (preset.ao) {
      const ao = new N8AOPostPass(scene, camera, size.x, size.y);
      ao.configuration.aoRadius = 0.55;
      ao.configuration.distanceFalloff = 0.6;
      ao.configuration.intensity = 3.2;
      ao.configuration.color = new THREE.Color('#1a120a');
      // NB : le mode demi-résolution de N8AO 2.0 plante avec three r187 → pleine résolution,
      // et moins d'échantillons sur les appareils modestes.
      ao.configuration.halfRes = false;
      ao.configuration.gammaCorrection = false;
      ao.setQualityMode(preset.aoHalf ? 'Performance' : 'Medium');
      composer.addPass(ao);
      this.ao = ao;
    }

    // 1) lueur + tone mapping + étalonnage + vignettage (effets fusionnés en une passe)
    const main = [];
    if (preset.bloom) {
      this.bloom = new BloomEffect({ luminanceThreshold: 0.95, luminanceSmoothing: 0.25, intensity: 0.45, radius: 0.7, mipmapBlur: true, levels: preset.dof ? 7 : 5 });
      main.push(this.bloom);
    }
    this.toneMapping = new ToneMappingEffect({ mode: ToneMappingMode.ACES_FILMIC });
    main.push(this.toneMapping, new GradeEffect(), new VignetteEffect({ offset: 0.35, darkness: 0.45 }));
    composer.addPass(new EffectPass(camera, ...main));

    // 2) anticrénelage
    if (preset.smaa) composer.addPass(new EffectPass(camera, new SMAAEffect({ preset: SMAAPreset.HIGH })));

    // 3) effet miniature + grain très léger
    const last = [];
    if (preset.dof) {
      this.tilt = new TiltShiftEffect({ offset: 0.0, focusArea: 0.95, feather: 0.6, kernelSize: KernelSize.SMALL, resolutionScale: 0.5 });
      last.push(this.tilt);
    }
    const noise = new NoiseEffect({ premultiply: true, blendFunction: BlendFunction.SOFT_LIGHT });
    noise.blendMode.opacity.value = 0.12;
    last.push(noise);
    composer.addPass(new EffectPass(camera, ...last));

    this.composer = composer;
  }

  /** Vue du plateau : effet miniature plus marqué. */
  setBoardView(board) {
    if (!this.tilt) return;
    // zone nette : |y| < focusArea − feather (en demi-hauteurs d'écran)
    this.tilt.focusArea = board ? 0.8 : 0.95;
    this.tilt.feather = board ? 0.5 : 0.6;
  }

  /** Repli sans effets (si la carte graphique refuse un shader ou rend une image noire). */
  disableEffects() {
    this.failed = true;
    this.setQuality(this.preset);
  }

  setQuality(preset) {
    this.preset = preset;
    this.composer?.dispose();
    this.composer = null; this.ao = null; this.bloom = null; this.tilt = null;
    const direct = this.failed || (!preset.ao && !preset.smaa && !preset.bloom);
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
