// Post-traitement. Étape 1 : rendu direct avec tone mapping (le pipeline complet arrive ensuite).
import * as THREE from 'three';

export class PostFX {
  constructor(renderer, scene, camera) {
    this.renderer = renderer; this.scene = scene; this.camera = camera;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;
  }
  setQuality() {}
  setSize() {}
  render() { this.renderer.render(this.scene, this.camera); }
}
