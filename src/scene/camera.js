// Caméra : suit le pion en douceur, peut pivoter légèrement à la souris / au doigt
// puis revient seule ; mode « Vue du plateau » vu de haut.
import * as THREE from 'three';

const damp = (a, b, lambda, dt) => THREE.MathUtils.lerp(a, b, 1 - Math.exp(-lambda * dt));

export class CameraRig {
  constructor(camera, dom, { reducedMotion = false } = {}) {
    this.camera = camera;
    this.dom = dom;
    this.reduced = reducedMotion;
    this.mode = 'follow';
    this.target = new THREE.Vector3();
    this.focus = new THREE.Vector3();
    this.follow = { radius: 10, polar: 0.62, azimuth: 0 };
    this.board = { radius: 36, polar: 0.24, azimuth: 0, center: new THREE.Vector3(0, 0, 0.8) };
    this.user = { yaw: 0, pitch: 0, zoom: 0 };
    this.cur = { radius: 30, polar: 0.35, azimuth: -0.4 };
    this.idle = 10;
    this.drag = null;
    this.onTap = null;
    this.bind();
  }

  setMode(mode) { this.mode = mode; this.user.yaw = 0; this.user.pitch = 0; }

  bind() {
    const el = this.dom;
    el.addEventListener('pointerdown', (e) => {
      if (e.button !== 0 && e.pointerType === 'mouse') return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, sx: e.clientX, sy: e.clientY, moved: false, yaw: this.user.yaw, pitch: this.user.pitch };
      el.setPointerCapture?.(e.pointerId);
    });
    el.addEventListener('pointermove', (e) => {
      const d = this.drag; if (!d || d.id !== e.pointerId) return;
      const dx = e.clientX - d.sx, dy = e.clientY - d.sy;
      if (Math.hypot(dx, dy) > 6) d.moved = true;
      if (!d.moved) return;
      const w = el.clientWidth || 1;
      this.user.yaw = THREE.MathUtils.clamp(d.yaw - (dx / w) * 2.2, -0.75, 0.75);
      this.user.pitch = THREE.MathUtils.clamp(d.pitch - (dy / w) * 1.6, -0.35, 0.3);
      this.idle = 0;
    });
    const end = (e) => {
      const d = this.drag; if (!d || d.id !== e.pointerId) return;
      this.drag = null;
      if (!d.moved && e.type === 'pointerup') this.onTap?.(e.clientX, e.clientY);
      this.idle = 0;
    };
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);
    el.addEventListener('wheel', (e) => {
      e.preventDefault();
      this.user.zoom = THREE.MathUtils.clamp(this.user.zoom + Math.sign(e.deltaY) * 0.6, -2.5, 4);
    }, { passive: false });
  }

  update(dt, pawnPos) {
    if (!this.drag) this.idle += dt;
    // retour automatique après un court instant
    if (!this.drag && this.idle > 1.2) {
      this.user.yaw = damp(this.user.yaw, 0, 2.2, dt);
      this.user.pitch = damp(this.user.pitch, 0, 2.2, dt);
    }
    const goal = this.mode === 'board' ? this.board : this.follow;
    const center = this.mode === 'board' ? this.board.center : pawnPos;
    const speed = this.reduced ? 20 : this.mode === 'board' ? 2.4 : 3.2;
    const zoom = this.mode === 'board' ? this.user.zoom * 2 : this.user.zoom;
    this.focus.x = damp(this.focus.x, center.x, speed * 1.4, dt);
    this.focus.y = damp(this.focus.y, this.mode === 'board' ? 0 : 0.35, speed, dt);
    this.focus.z = damp(this.focus.z, center.z, speed * 1.4, dt);
    this.cur.radius = damp(this.cur.radius, goal.radius + zoom, speed, dt);
    this.cur.polar = damp(this.cur.polar, THREE.MathUtils.clamp(goal.polar + this.user.pitch, 0.05, 1.25), speed, dt);
    this.cur.azimuth = damp(this.cur.azimuth, goal.azimuth + this.user.yaw, speed, dt);
    const { radius, polar, azimuth } = this.cur;
    this.camera.position.set(
      this.focus.x + radius * Math.sin(polar) * Math.sin(azimuth),
      this.focus.y + radius * Math.cos(polar),
      this.focus.z + radius * Math.sin(polar) * Math.cos(azimuth)
    );
    this.camera.lookAt(this.focus);
  }

  snap(pawnPos) {
    this.focus.copy(pawnPos);
    const g = this.mode === 'board' ? this.board : this.follow;
    this.cur = { radius: g.radius, polar: g.polar, azimuth: g.azimuth };
  }
}
