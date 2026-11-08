import * as THREE from 'three';
import { lerp, clamp } from './utils.js';

/**
 * The Invisible Woman — a translucent guide in a flowing dress.
 * Built procedurally: lathe dress with a wind shader, capsule limbs, fresnel skin.
 * Opacity is tiny by default (you must look closely); the finale makes her solid.
 */
export class Woman {
  constructor() {
    this.group = new THREE.Group();
    this.group.name = 'InvisibleWoman';

    this.uniforms = {
      uTime: { value: 0 },
      uOpacity: { value: 0.12 },
      uSolid: { value: 0 },
      uFlow: { value: 1 },
      uColor: { value: new THREE.Color('#f6f1ff') },
      uTint: { value: new THREE.Color('#8ad7ff') },
    };

    const vert = `
      uniform float uTime; uniform float uFlow;
      attribute float aDress;
      varying vec3 vN; varying vec3 vV; varying float vY; varying float vD;
      void main(){
        vec3 p = position;
        float hem = aDress * smoothstep(1.05, 0.0, p.y);
        float ang = atan(p.z, p.x);
        p.x += sin(uTime*2.1 + p.y*6.0 + ang*3.0) * 0.07 * hem * uFlow;
        p.z += cos(uTime*1.7 + p.y*5.0 + ang*2.0) * 0.07 * hem * uFlow;
        p.x += sin(uTime*0.9) * 0.05 * hem * uFlow;
        p.z -= (0.5 + 0.5*sin(uTime*1.3)) * 0.12 * hem * uFlow; // trailing in the wind
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        vN = normalize(normalMatrix * normal);
        vV = normalize(-mv.xyz);
        vY = p.y; vD = aDress;
        gl_Position = projectionMatrix * mv;
      }`;
    const frag = `
      uniform float uOpacity; uniform float uSolid; uniform float uTime; uniform vec3 uColor; uniform vec3 uTint;
      varying vec3 vN; varying vec3 vV; varying float vY; varying float vD;
      void main(){
        float ndv = abs(dot(normalize(vN), normalize(vV)));
        float fres = pow(1.0 - ndv, 2.2);
        float shimmer = 0.5 + 0.5*sin(uTime*2.5 + vY*18.0);
        float ghost = uOpacity * (0.12 + 0.88*fres) * (0.8 + 0.2*shimmer);
        float solid = uOpacity * (0.75 + 0.25*ndv);
        float a = mix(ghost, solid, uSolid);
        vec3 col = mix(uColor, vec3(1.0), fres*0.5);
        col = mix(col, uTint, (1.0-uSolid) * 0.35 * (1.0-fres));
        // solid shading: soft wrap light from above-right
        float l = 0.65 + 0.35*clamp(dot(normalize(vN), normalize(vec3(0.4,1.0,0.6))), 0.0, 1.0);
        col = mix(col, col * l, uSolid);
        gl_FragColor = vec4(col, a);
      }`;

    this.material = new THREE.ShaderMaterial({
      uniforms: this.uniforms,
      vertexShader: vert,
      fragmentShader: frag,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

    const mark = (geo, dress) => {
      const n = geo.attributes.position.count;
      geo.setAttribute('aDress', new THREE.BufferAttribute(new Float32Array(n).fill(dress), 1));
      return geo;
    };

    // Dress (lathe): hem at y=0, waist ~1.0, bodice to 1.32
    const pts = [];
    const prof = [
      [0.0, 0.0], [0.62, 0.0], [0.6, 0.05], [0.48, 0.28], [0.36, 0.52], [0.25, 0.75], [0.17, 0.96],
      [0.16, 1.05], [0.2, 1.18], [0.22, 1.3], [0.17, 1.36],
    ];
    for (const [r, y] of prof) pts.push(new THREE.Vector2(r, y));
    const dress = new THREE.Mesh(mark(new THREE.LatheGeometry(pts, 48), 1), this.material);
    this.group.add(dress);

    // Veil / sash trailing from shoulders
    const veilPts = [];
    for (let i = 0; i <= 10; i++) { const t = i / 10; veilPts.push(new THREE.Vector2(0.12 + t * 0.35, 1.36 - t * 1.25)); }
    const veil = new THREE.Mesh(mark(new THREE.LatheGeometry(veilPts, 24, Math.PI * 0.9, Math.PI * 1.2), 1), this.material);
    veil.position.z = -0.04;
    this.group.add(veil);

    // Torso/neck/head
    const neck = new THREE.Mesh(mark(new THREE.CylinderGeometry(0.045, 0.06, 0.14, 16), 0), this.material);
    neck.position.y = 1.42; this.group.add(neck);
    const head = new THREE.Mesh(mark(new THREE.SphereGeometry(0.125, 28, 20), 0), this.material);
    head.scale.set(0.92, 1.08, 0.98); head.position.y = 1.6; this.group.add(head);
    // hair: flowing lathe behind the head
    const hairPts = [];
    for (let i = 0; i <= 8; i++) { const t = i / 8; hairPts.push(new THREE.Vector2(0.14 * (1 - t * 0.5) + 0.02, 1.7 - t * 0.7)); }
    const hair = new THREE.Mesh(mark(new THREE.LatheGeometry(hairPts, 20, Math.PI * 0.6, Math.PI * 1.8), 1), this.material);
    hair.position.z = -0.05; this.group.add(hair);

    // Arms with shoulder pivots
    this.arms = [];
    for (const side of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(side * 0.2, 1.32, 0);
      const upper = new THREE.Mesh(mark(new THREE.CapsuleGeometry(0.04, 0.3, 4, 10), 0), this.material);
      upper.position.y = -0.17;
      const elbow = new THREE.Group(); elbow.position.y = -0.33;
      const fore = new THREE.Mesh(mark(new THREE.CapsuleGeometry(0.035, 0.28, 4, 10), 0), this.material);
      fore.position.y = -0.15;
      const hand = new THREE.Mesh(mark(new THREE.SphereGeometry(0.045, 12, 10), 0), this.material);
      hand.position.y = -0.3;
      elbow.add(fore, hand);
      pivot.add(upper, elbow);
      pivot.rotation.z = side * 0.18;
      this.group.add(pivot);
      this.arms.push({ side, pivot, elbow });
    }

    // Soft aura so she can be located in dark scenes
    const auraTex = Woman.glowTexture();
    this.aura = new THREE.Sprite(new THREE.SpriteMaterial({ map: auraTex, color: '#9fd8ff', transparent: true, opacity: 0.08, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.aura.scale.set(2.2, 3.2, 1); this.aura.position.y = 0.9;
    this.group.add(this.aura);

    // Pose state (targets) and smoothed state
    this.pose = { walk: 0, beckon: 0, point: 0, facing: 0, opacity: 0.12, solid: 0, flow: 1, scale: 1 };
    this.cur = { ...this.pose };
    this.phase = 0;
    this.visible = true;
  }

  static glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 128;
    const ctx = c.getContext('2d');
    const g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.4, 'rgba(255,255,255,0.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 128, 128);
    const t = new THREE.CanvasTexture(c); return t;
  }

  /** Set pose targets. */
  set(p) { Object.assign(this.pose, { walk: 0, beckon: 0, point: 0, solid: 0, flow: 1, scale: 1 }, p); }

  update(dt, time) {
    const c = this.cur, p = this.pose;
    const k = 1 - Math.pow(0.001, dt); // exponential smoothing
    for (const key in c) c[key] = lerp(c[key], p[key], k);

    this.uniforms.uTime.value = time;
    this.uniforms.uOpacity.value = c.opacity;
    this.uniforms.uSolid.value = c.solid;
    this.uniforms.uFlow.value = c.flow;
    this.material.depthWrite = c.solid > 0.55;
    this.aura.material.opacity = clamp(c.opacity * 0.5, 0, 0.2) * (1 - c.solid);

    this.phase += dt * (1.2 + c.walk * 4.8);
    const w = c.walk;
    this.group.scale.setScalar(c.scale);
    // body bob & sway while walking, idle breathing otherwise
    this.group.position.y = this.baseY + (Math.abs(Math.sin(this.phase)) * 0.035 * w + Math.sin(time * 1.4) * 0.01) * c.scale;
    this.group.rotation.y = c.facing + Math.sin(this.phase) * 0.06 * w;
    this.group.rotation.z = Math.sin(this.phase) * 0.03 * w;

    for (const arm of this.arms) {
      const s = arm.side;
      // walking swing
      const swing = Math.sin(this.phase + (s > 0 ? Math.PI : 0)) * 0.45 * w;
      let rx = swing, rz = s * 0.18, ex = -0.25 - 0.2 * w;
      // beckon: right arm raised forward, hand curling
      if (s > 0 && c.beckon > 0) {
        rx = lerp(rx, -2.3, c.beckon);
        rz = lerp(rz, 0.3, c.beckon);
        ex = lerp(ex, -0.9 - Math.sin(time * 3.2) * 0.5, c.beckon);
      }
      // point: right arm extended sideways
      if (s > 0 && c.point > 0) {
        rx = lerp(rx, -1.1, c.point);
        rz = lerp(rz, -1.35, c.point);
        ex = lerp(ex, -0.1, c.point);
      }
      arm.pivot.rotation.x = rx;
      arm.pivot.rotation.z = rz;
      arm.elbow.rotation.x = ex;
    }
  }

  get baseY() { return this._baseY || 0; }
  set baseY(v) { this._baseY = v; }

  /** Smoothly move the guide toward a world position (feet at position). */
  moveTo(x, y, z, dt = 0.016) {
    if (!this._pos) { this._pos = new THREE.Vector3(x, y, z); }
    const k = 1 - Math.pow(0.0005, dt);
    this._pos.x = lerp(this._pos.x, x, k);
    this._pos.y = lerp(this._pos.y, y, k);
    this._pos.z = lerp(this._pos.z, z, k);
    this.group.position.x = this._pos.x;
    this.group.position.z = this._pos.z;
    this.baseY = this._pos.y;
  }

  /** Teleport (used when scenes hard-cut). */
  place(x, y, z) {
    this._pos = new THREE.Vector3(x, y, z);
    this.group.position.set(x, y, z);
    this.baseY = y;
    for (const key in this.cur) this.cur[key] = this.pose[key];
  }
}
