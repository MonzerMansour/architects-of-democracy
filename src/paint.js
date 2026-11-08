import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

/**
 * Oil-paint pass: an anisotropic Kuwahara filter (after Kyprianidis et al. 2009).
 * 1. A structure tensor of the image, at half resolution, gives the local edge direction.
 * 2. Each pixel averages the flattest of 8 sectors of an ellipse stretched along that edge, so flat areas become
 *    broad strokes that follow the forms, and hard polygon edges dissolve into brushwork.
 * 3. Strong edges get a thin, soft ink line, like the drawing under a painting.
 * Works on HDR input: values are compressed with x/(1+x) for filtering and expanded again afterwards.
 */
const TensorShader = {
  uniforms: { tDiffuse: { value: null }, uTexel: { value: new THREE.Vector2() } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform vec2 uTexel; varying vec2 vUv;
    float L(vec2 o){ vec3 c = texture2D(tDiffuse, vUv + o * uTexel).rgb; c = c / (1.0 + c); return dot(c, vec3(0.299, 0.587, 0.114)); }
    void main(){
      float tl = L(vec2(-1, 1)), t = L(vec2(0, 1)), tr = L(vec2(1, 1));
      float l = L(vec2(-1, 0)), r = L(vec2(1, 0));
      float bl = L(vec2(-1, -1)), b = L(vec2(0, -1)), br = L(vec2(1, -1));
      float gx = (tr + 2.0 * r + br) - (tl + 2.0 * l + bl);
      float gy = (tl + 2.0 * t + tr) - (bl + 2.0 * b + br);
      gl_FragColor = vec4(gx * gx, gy * gy, gx * gy, 1.0);
    }`,
};

const KuwaharaShader = {
  uniforms: {
    tDiffuse: { value: null },
    tTensor: { value: null },
    uTexel: { value: new THREE.Vector2() },
    uRadius: { value: 5 },
    uInk: { value: 1 },
    uMix: { value: 1 },
    uSharp: { value: 3000 },
    uBristle: { value: 1 },
    uRes: { value: new THREE.Vector2(1, 1) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse, tTensor; uniform vec2 uTexel; uniform float uRadius, uInk, uMix, uSharp, uBristle; uniform vec2 uRes; varying vec2 vUv;
    const float PI = 3.14159265;
    float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    float vnoise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
      return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
    vec3 C(vec2 uv){ vec3 c = texture2D(tDiffuse, uv).rgb; return c / (1.0 + c); }
    void main(){
      // smoothed structure tensor
      vec2 tt = uTexel * 3.0;
      vec3 T = texture2D(tTensor, vUv).rgb * 0.36
             + (texture2D(tTensor, vUv + vec2(tt.x, 0)).rgb + texture2D(tTensor, vUv - vec2(tt.x, 0)).rgb
             +  texture2D(tTensor, vUv + vec2(0, tt.y)).rgb + texture2D(tTensor, vUv - vec2(0, tt.y)).rgb) * 0.16;
      float E = T.x, G = T.y, F = T.z;
      float D = sqrt(max((E - G) * (E - G) + 4.0 * F * F, 0.0));
      float l1 = 0.5 * (E + G + D), l2 = 0.5 * (E + G - D);
      vec2 v = vec2(l1 - E, -F);
      vec2 dir = dot(v, v) > 1e-10 ? normalize(v) : vec2(0.0, 1.0);
      float A = (l1 + l2) > 1e-6 ? (l1 - l2) / (l1 + l2) : 0.0;  // anisotropy 0..1
      float a = uRadius * clamp(1.0 + A, 0.5, 2.0);                  // along the edge
      float b = uRadius * clamp(1.0 / (1.0 + A), 0.5, 2.0);          // across it
      mat2 R = mat2(dir.x, dir.y, -dir.y, dir.x);

      vec3 c0 = C(vUv);
      vec3 means[8]; float sigs[8]; float minSig = 1e9;
      for (int k = 0; k < 8; k++) {
        vec3 m = c0, s = c0 * c0; float n = 1.0;
        for (int j = 0; j < 3; j++) {
          float ang = (float(k) + (float(j) - 1.0) * 0.33) * PI * 0.25;
          vec2 u = vec2(cos(ang), sin(ang));
          for (int q = 1; q <= 2; q++) {
            float rr = float(q) * 0.5;
            float w = exp(-rr * rr * 1.5);
            vec2 o = R * (u * rr * vec2(a, b));
            vec3 c = C(vUv + o * uTexel);
            m += c * w; s += c * c * w; n += w;
          }
        }
        m /= n; s = abs(s / n - m * m);
        means[k] = m; sigs[k] = s.r + s.g + s.b; minSig = min(minSig, sigs[k]);
      }
      // weight each sector by how much busier it is than the flattest one (that one always counts fully)
      vec3 sumC = vec3(0.0); float sumW = 0.0;
      for (int k = 0; k < 8; k++) {
        float wk = 1.0 / (1.0 + pow((sigs[k] - minSig) * uSharp, 4.0));
        sumC += means[k] * wk; sumW += wk;
      }
      vec3 paint = sumC / sumW;
      // bristle streaks: noise stretched along the stroke direction, strongest where the paint is flat
      vec2 px = vUv * uRes / max(uRadius, 1.0);
      vec2 sp = vec2(dot(px, dir), dot(px, vec2(-dir.y, dir.x)));
      float br = vnoise(sp * vec2(0.35, 2.6)) * 0.65 + vnoise(sp * vec2(0.9, 6.0)) * 0.35;
      paint *= 1.0 + (br - 0.5) * 0.14 * uBristle * (1.0 - A * 0.5);
      // soft ink on strong edges, like the under-drawing showing through
      vec3 Tc = texture2D(tTensor, vUv).rgb;
      float g = sqrt(max(Tc.x + Tc.y, 0.0));
      float edge = smoothstep(0.12, 0.45, g) * (1.0 - smoothstep(0.55, 0.95, dot(paint, vec3(0.333))));
      paint *= 1.0 - edge * 0.22 * uInk;
      vec3 outc = mix(c0, paint, uMix);
      outc = min(outc, vec3(0.995));
      gl_FragColor = vec4(outc / (1.0 - outc), 1.0);
    }`,
};

export class PaintPass extends Pass {
  constructor() {
    super();
    this.tensorRT = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType });
    this.tensor = new THREE.ShaderMaterial({ ...TensorShader, uniforms: THREE.UniformsUtils.clone(TensorShader.uniforms), depthTest: false, depthWrite: false });
    this.kuwahara = new THREE.ShaderMaterial({ ...KuwaharaShader, uniforms: THREE.UniformsUtils.clone(KuwaharaShader.uniforms), depthTest: false, depthWrite: false });
    this.uniforms = this.kuwahara.uniforms;
    this.quad = new FullScreenQuad(this.tensor);
    this.pixelScale = 1;
  }
  setSize(w, h) {
    this.tensorRT.setSize(Math.max(1, w >> 1), Math.max(1, h >> 1));
    this.tensor.uniforms.uTexel.value.set(2 / w, 2 / h);
    this.kuwahara.uniforms.uTexel.value.set(1 / w, 1 / h);
    this.kuwahara.uniforms.uRes.value.set(w, h);
  }
  render(renderer, writeBuffer, readBuffer) {
    this.tensor.uniforms.tDiffuse.value = readBuffer.texture;
    this.quad.material = this.tensor;
    renderer.setRenderTarget(this.tensorRT);
    this.quad.render(renderer);
    this.kuwahara.uniforms.tDiffuse.value = readBuffer.texture;
    this.kuwahara.uniforms.tTensor.value = this.tensorRT.texture;
    this.quad.material = this.kuwahara;
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    if (this.clear) renderer.clear();
    this.quad.render(renderer);
  }
  dispose() { this.tensorRT.dispose(); this.tensor.dispose(); this.kuwahara.dispose(); this.quad.dispose(); }
}
