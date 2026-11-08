import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { BokehPass } from 'three/addons/postprocessing/BokehPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { lerp } from './utils.js';
import { PaintPass } from './paint.js';

/**
 * Painterly post chain, after the "light does most of the work" look:
 *   MSAA render → depth of field (soft background, blurred foreground) → soft warm bloom (halation)
 *   → grade: mid-tone veil, lift, contrast/saturation/warmth/sepia, paint texture, vignette,
 *     chromatic aberration, grain on twos → tone-mapping + sRGB.
 * Scenes describe their look via `grade: { saturation, contrast, warmth, sepia, vignette, bloom, veil, lift,
 * paint, aperture, maxblur }`; values ease between scenes.
 */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uSaturation: { value: 1 },
    uContrast: { value: 1 },
    uWarmth: { value: 0 },
    uSepia: { value: 0 },
    uVignette: { value: 1 },
    uAberration: { value: 1 },
    uGrain: { value: 0.045 },
    uVeil: { value: 1.12 },
    uLift: { value: 0.006 },
    uPaint: { value: 0.14 },
    uSplit: { value: 0 },
    uResolution: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uSaturation, uContrast, uWarmth, uSepia, uVignette, uAberration, uGrain, uVeil, uLift, uPaint, uSplit; uniform vec2 uResolution;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
    float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
      return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
    float fbm(vec2 p){ float s = 0.0, a = 0.5; for (int k = 0; k < 5; k++) { s += noise(p) * a; p = p * 2.03 + 11.7; a *= 0.5; } return s; }
    void main(){
      vec2 uv = vUv;
      vec2 d = uv - 0.5;
      float r2 = dot(d, d);
      float aspect = uResolution.x / uResolution.y;
      // chromatic aberration grows toward the corners
      float ab = uAberration * 0.0012 * r2 * 4.0;
      vec3 col;
      col.r = texture2D(tDiffuse, uv + d * ab).r;
      col.g = texture2D(tDiffuse, uv).g;
      col.b = texture2D(tDiffuse, uv - d * ab).b;
      // warmth: toward amber, or toward steel blue (linear light, pre-tonemap)
      col *= vec3(1.0 + uWarmth * 0.35, 1.0 + uWarmth * 0.08, 1.0 - uWarmth * 0.35);
      // the veil: sink the mid-tones so the lit pools read; highlights keep their place
      col = pow(max(col, 0.0), vec3(uVeil));
      // contrast around mid grey
      col = (col - 0.18) * uContrast + 0.18;
      col = max(col, 0.0) + uLift;
      // saturation
      float l = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(l), col, uSaturation);
      // sepia
      vec3 sep = vec3(dot(col, vec3(0.393, 0.769, 0.189)), dot(col, vec3(0.349, 0.686, 0.168)), dot(col, vec3(0.272, 0.534, 0.131)));
      col = mix(col, sep, uSepia);
      // split: the right half of the frame goes cold, grey and dim; the left half stays warm and lit
      if (uSplit > 0.001) {
        float side = smoothstep(-1.5, 1.5, gl_FragCoord.x - uResolution.x * 0.5);
        vec3 cold = vec3(dot(col, vec3(0.2126, 0.7152, 0.0722))) * vec3(0.74, 0.82, 1.0) * 0.5;
        col = mix(col, cold, side * uSplit * 0.92);
        col *= 1.0 + (1.0 - side) * uSplit * vec3(0.14, 0.06, -0.06);
        // a soft shadow either side of the seam so its light reads even against a bright sky
        float dx = abs(gl_FragCoord.x - uResolution.x * 0.5) / uResolution.y;
        col *= 1.0 - uSplit * 0.55 * exp(-dx * 9.0);
      }
      // paint: a static, low-frequency mottle plus a fine canvas weave, soft-lighted into the image
      vec2 puv = vec2(uv.x * aspect, uv.y);
      float mottle = fbm(puv * 7.0) - 0.5;
      float weave = (sin(puv.x * uResolution.y * 0.9) * sin(puv.y * uResolution.y * 0.9)) * 0.5;
      float paint = mottle * 0.8 + weave * 0.2;
      col *= 1.0 + paint * uPaint * (0.5 + 0.5 * (1.0 - l));
      // vignette
      float vig = 1.0 - smoothstep(0.2, 0.9, r2 * uVignette);
      col *= mix(0.5, 1.0, vig);
      // grain on twos
      float tick = floor(uTime * 12.0) / 12.0;
      float g = hash(uv * uResolution + fract(tick) * 100.0) - 0.5;
      col += g * uGrain * (0.6 + 0.4 * l);
      gl_FragColor = vec4(col, 1.0);
    }`,
};

const DEFAULTS = { saturation: 1, contrast: 1, warmth: 0, sepia: 0, vignette: 1, bloom: 1, aberration: 1, veil: 1.12, lift: 0.006, paint: 0.14, aperture: 0.004, maxblur: 0.003, brush: 1.8, ink: 0.9, split: 0, grain: 0.045 };

export class Post {
  constructor(renderer, scene, camera) {
    this.renderer = renderer;
    const size = renderer.getSize(new THREE.Vector2()).multiplyScalar(renderer.getPixelRatio());
    const rt = new THREE.WebGLRenderTarget(size.x, size.y, { type: THREE.HalfFloatType, samples: 4 });
    this.composer = new EffectComposer(renderer, rt);
    this.renderPass = new RenderPass(scene, camera);
    this.bokeh = new BokehPass(scene, camera, { focus: 10, aperture: DEFAULTS.aperture, maxblur: DEFAULTS.maxblur });
    this.bloom = new UnrealBloomPass(new THREE.Vector2(size.x, size.y), 0.3, 0.6, 0.95);
    this.paint = new PaintPass();
    this.grade = new ShaderPass(GradeShader);
    this.output = new OutputPass();
    this.composer.addPass(this.renderPass);
    this.composer.addPass(this.bokeh);
    this.composer.addPass(this.bloom);
    this.composer.addPass(this.paint);
    this.composer.addPass(this.grade);
    this.composer.addPass(this.output);
    this.target = { ...DEFAULTS };
    this.cur = { ...DEFAULTS };
    this.focus = 10;
    this.setSize(window.innerWidth, window.innerHeight);
  }
  setSize(w, h) {
    this.composer.setSize(w, h);
    const pr = this.renderer.getPixelRatio();
    this.grade.uniforms.uResolution.value.set(w * pr, h * pr);
    this.bokeh.setSize?.(w * pr, h * pr);
  }
  /** Desired grade (scene-provided; missing keys fall back to defaults). */
  set(grade = {}) {
    Object.assign(this.target, DEFAULTS, grade);
  }
  /** World-space distance the lens is focused on (usually camera → look target). */
  setFocus(distance) { this.focus = distance; }
  render(dt, time, extraBloom = 0) {
    const k = 1 - Math.pow(0.02, dt);
    for (const key in this.target) {
      const drop = key === 'bloom' && this.target[key] < this.cur[key];
      this.cur[key] = lerp(this.cur[key], this.target[key], drop ? 1 - Math.pow(0.0002, dt) : k);
    }
    const u = this.grade.uniforms;
    u.uTime.value = time;
    u.uSaturation.value = this.cur.saturation; u.uContrast.value = this.cur.contrast; u.uWarmth.value = this.cur.warmth;
    u.uSepia.value = this.cur.sepia; u.uVignette.value = this.cur.vignette; u.uAberration.value = this.cur.aberration;
    u.uVeil.value = this.cur.veil; u.uLift.value = this.cur.lift; u.uPaint.value = this.cur.paint; u.uSplit.value = this.cur.split;
    u.uGrain.value = this.cur.grain ?? 0.045;
    this.bloom.strength = 0.3 * this.cur.bloom + extraBloom;
    const pu = this.paint.uniforms, pr = this.renderer.getPixelRatio();
    pu.uRadius.value = 4.5 * pr * this.cur.brush; pu.uInk.value = this.cur.ink; pu.uMix.value = Math.min(1, this.cur.brush * 4);
    const b = this.bokeh.uniforms;
    b.focus.value = lerp(b.focus.value, this.focus, k);
    b.aperture.value = this.cur.aperture; b.maxblur.value = this.cur.maxblur;
    this.composer.render();
  }
}
