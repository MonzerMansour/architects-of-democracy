import * as THREE from 'three';

export const lerp = (a, b, t) => a + (b - a) * t;
export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const smooth = (t) => t * t * (3 - 2 * t);
export const remap = (v, a, b, c = 0, d = 1) => lerp(c, d, clamp((v - a) / (b - a)));
export const easeOutCubic = (t) => 1 - Math.pow(1 - t, 3);
export const easeInOutCubic = (t) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Deterministic PRNG so every visitor sees the same world. */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Simple 2D value noise with fbm. */
export function makeNoise(seed = 7) {
  const r = rng(seed);
  const size = 256;
  const grid = new Float32Array(size * size);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  const at = (x, y) => grid[((y & (size - 1)) * size + (x & (size - 1)))];
  const noise = (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = smooth(xf), v = smooth(yf);
    const a = at(xi, yi), b = at(xi + 1, yi), c = at(xi, yi + 1), d = at(xi + 1, yi + 1);
    return lerp(lerp(a, b, u), lerp(c, d, u), v);
  };
  const fbm = (x, y, oct = 5) => {
    let sum = 0, amp = 0.5, f = 1, norm = 0;
    for (let i = 0; i < oct; i++) {
      sum += noise(x * f, y * f) * amp;
      norm += amp;
      amp *= 0.5;
      f *= 2;
    }
    return sum / norm;
  };
  return { noise, fbm };
}

export function canvasTexture(w, h, draw, opts = {}) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  draw(ctx, w, h);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = opts.repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  if (opts.repeat) tex.repeat.set(opts.repeat[0], opts.repeat[1]);
  tex.anisotropy = 4;
  return tex;
}

const N = makeNoise(11);

export const textures = {
  marble(seed = 0) {
    return canvasTexture(512, 512, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = N.fbm(x / 90 + seed, y / 90, 5);
        const vein = Math.abs(Math.sin((x / 60 + N.fbm(x / 40, y / 40 + seed) * 6) + y / 140));
        const v = 225 - n * 40 - Math.pow(1 - vein, 10) * 60;
        const i = (y * w + x) * 4;
        img.data[i] = v; img.data[i + 1] = v - 4; img.data[i + 2] = v - 10; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }, { repeat: [1, 1] });
  },

  parchment() {
    return canvasTexture(1024, 1024, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = N.fbm(x / 160, y / 160, 6);
        const spots = N.fbm(x / 25 + 40, y / 25, 3);
        const dx = x / w - 0.5, dy = y / h - 0.5;
        const vign = Math.sqrt(dx * dx + dy * dy) * 1.4;
        const base = 232 - n * 45 - Math.max(0, spots - 0.62) * 160 - vign * vign * 90;
        const i = (y * w + x) * 4;
        img.data[i] = base; img.data[i + 1] = base * 0.9; img.data[i + 2] = base * 0.7; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    });
  },

  /** A stylised old-world map of the Americas with a parchment base. */
  map() {
    return canvasTexture(1536, 960, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = N.fbm(x / 180, y / 180, 6);
        const spots = N.fbm(x / 25 + 80, y / 25, 3);
        const dx = x / w - 0.5, dy = y / h - 0.5;
        const vign = Math.sqrt(dx * dx + dy * dy) * 1.4;
        let r = 222 - n * 45 - Math.max(0, spots - 0.6) * 150 - vign * vign * 110;
        let g = r * 0.88, b = r * 0.66;
        // Americas silhouette: two blobs (north + south) joined by an isthmus, warped by noise
        const nx = (x / w - 0.42) * 2.2, ny = (y / h - 0.5) * 2.2;
        const warp = (N.fbm(x / 120 + 5, y / 120 + 5, 4) - 0.5) * 0.5;
        const north = Math.hypot((nx + 0.05 + warp) / 0.55, (ny + 0.55) / 0.5);
        const south = Math.hypot((nx + 0.3 + warp * 0.6) / 0.3, (ny - 0.55) / 0.52);
        const isth = Math.hypot((nx + 0.18 + warp * 0.3) / 0.12, (ny + 0.02) / 0.28);
        const land = Math.min(north, south, isth) + N.fbm(x / 60, y / 60, 3) * 0.3;
        if (land < 1) {
          const coast = clamp((1 - land) * 6);
          r = lerp(r, 170 - n * 50, coast * 0.75); g = lerp(g, 150 - n * 50, coast * 0.75); b = lerp(b, 100 - n * 40, coast * 0.75);
        } else if (land < 1.06) {
          r *= 0.75; g *= 0.7; b *= 0.6; // ink coastline
        }
        const i = (y * w + x) * 4;
        img.data[i] = r; img.data[i + 1] = g; img.data[i + 2] = b; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
      // rhumb lines + compass rose
      ctx.strokeStyle = 'rgba(70,40,20,0.35)'; ctx.lineWidth = 2;
      const cx = w * 0.78, cy = h * 0.3;
      for (let a = 0; a < Math.PI * 2; a += Math.PI / 16) {
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * w, cy + Math.sin(a) * w); ctx.stroke();
      }
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(60,30,10,0.7)';
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2, R = k % 2 ? 60 : 110;
        ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + Math.cos(a) * R, cy + Math.sin(a) * R); ctx.stroke();
      }
      ctx.beginPath(); ctx.arc(cx, cy, 120, 0, Math.PI * 2); ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 20, 0, Math.PI * 2); ctx.stroke();
      // grid
      ctx.lineWidth = 1; ctx.strokeStyle = 'rgba(70,40,20,0.22)';
      for (let x = 0; x < w; x += w / 16) { ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, h); ctx.stroke(); }
      for (let y = 0; y < h; y += h / 10) { ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(w, y); ctx.stroke(); }
      ctx.font = 'italic 700 110px "IM Fell English", "Cormorant Garamond", serif';
      ctx.fillStyle = 'rgba(60,30,10,0.75)';
      ctx.fillText('AMERICA', w * 0.47, h * 0.9);
      ctx.font = 'italic 42px "IM Fell English", serif';
      ctx.fillText('Mare Oceanus', w * 0.62, h * 0.62);
      ctx.fillText('Terra Incognita', w * 0.1, h * 0.18);
    });
  },

  wood() {
    return canvasTexture(512, 512, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const plank = Math.floor(x / 64);
        const g = Math.sin((y / 18 + N.fbm(x / 30 + plank * 7, y / 200) * 8) * 1.2) * 0.5 + 0.5;
        const edge = (x % 64) < 2 ? 0.55 : 1;
        const base = (115 + g * 35 - N.fbm(x / 40, y / 40 + plank) * 25) * edge;
        const i = (y * w + x) * 4;
        img.data[i] = base; img.data[i + 1] = base * 0.62; img.data[i + 2] = base * 0.38; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }, { repeat: [4, 4] });
  },

  /** Building facade: rows of lit/unlit windows. */
  facade(cols, rows, { base = '#3a3440', lit = '#ffd79a', dark = '#171420', litRatio = 0.55, seed = 3 } = {}) {
    const r = rng(seed);
    return canvasTexture(cols * 32, rows * 48, (ctx, w, h) => {
      ctx.fillStyle = base; ctx.fillRect(0, 0, w, h);
      for (let yy = 0; yy < rows; yy++) for (let xx = 0; xx < cols; xx++) {
        ctx.fillStyle = r() < litRatio ? lit : dark;
        ctx.globalAlpha = 0.7 + r() * 0.3;
        ctx.fillRect(xx * 32 + 8, yy * 48 + 10, 16, 26);
      }
      ctx.globalAlpha = 1;
    });
  },

  /** Victorian shopfront with signage. */
  victorian(name, color, seed = 5) {
    const r = rng(seed);
    return canvasTexture(512, 768, (ctx, w, h) => {
      ctx.fillStyle = color; ctx.fillRect(0, 0, w, h);
      // storeys with tall arched windows
      for (let s = 0; s < 3; s++) {
        const y0 = 60 + s * 220;
        for (let k = 0; k < 4; k++) {
          const x0 = 40 + k * 115;
          ctx.fillStyle = '#1b1a22';
          ctx.beginPath(); ctx.moveTo(x0, y0 + 40); ctx.arc(x0 + 35, y0 + 40, 35, Math.PI, 0); ctx.lineTo(x0 + 70, y0 + 150); ctx.lineTo(x0, y0 + 150); ctx.closePath(); ctx.fill();
          ctx.fillStyle = `rgba(255,214,150,${0.25 + r() * 0.5})`;
          ctx.fillRect(x0 + 6, y0 + 30, 58, 110);
          ctx.strokeStyle = 'rgba(255,255,255,0.5)'; ctx.lineWidth = 4;
          ctx.beginPath(); ctx.moveTo(x0, y0 + 40); ctx.arc(x0 + 35, y0 + 40, 35, Math.PI, 0); ctx.lineTo(x0 + 70, y0 + 150); ctx.lineTo(x0, y0 + 150); ctx.closePath(); ctx.stroke();
        }
        ctx.fillStyle = 'rgba(255,255,255,0.35)'; ctx.fillRect(0, y0 + 180, w, 10);
      }
      // signage band
      ctx.fillStyle = '#231d1a'; ctx.fillRect(0, h - 90, w, 90);
      ctx.fillStyle = '#e9d7a7'; ctx.font = '700 44px "Cormorant Garamond", serif'; ctx.textAlign = 'center';
      ctx.fillText(name.toUpperCase(), w / 2, h - 34);
    });
  },

  /** Painterly portrait silhouette with name plate. */
  portrait(name, years, hue) {
    return canvasTexture(512, 640, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h * 0.35, 40, w / 2, h * 0.5, 420);
      g.addColorStop(0, `hsl(${hue}, 40%, 42%)`); g.addColorStop(1, `hsl(${hue}, 35%, 10%)`);
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
      // bust silhouette
      ctx.fillStyle = 'rgba(10,8,12,0.85)';
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.36, 80, 100, 0, 0, Math.PI * 2); ctx.fill();
      ctx.beginPath(); ctx.moveTo(w * 0.15, h); ctx.quadraticCurveTo(w * 0.2, h * 0.55, w / 2, h * 0.5); ctx.quadraticCurveTo(w * 0.8, h * 0.55, w * 0.85, h); ctx.closePath(); ctx.fill();
      // rim light
      ctx.strokeStyle = `hsla(${hue + 30}, 80%, 75%, 0.55)`; ctx.lineWidth = 6;
      ctx.beginPath(); ctx.ellipse(w / 2, h * 0.36, 80, 100, 0, -Math.PI * 0.9, -Math.PI * 0.2); ctx.stroke();
      // craquelure
      ctx.strokeStyle = 'rgba(255,255,255,0.08)'; ctx.lineWidth = 1;
      const r = rng(hue);
      for (let i = 0; i < 60; i++) {
        ctx.beginPath(); let x = r() * w, y = r() * h; ctx.moveTo(x, y);
        for (let k = 0; k < 6; k++) { x += (r() - 0.5) * 60; y += (r() - 0.5) * 60; ctx.lineTo(x, y); }
        ctx.stroke();
      }
      // plate
      ctx.fillStyle = '#c9a44c'; ctx.fillRect(w * 0.18, h - 86, w * 0.64, 62);
      ctx.fillStyle = '#2a1d0c'; ctx.textAlign = 'center';
      ctx.font = '700 30px "Cormorant Garamond", serif'; ctx.fillText(name, w / 2, h - 50);
      ctx.font = '20px "Cormorant Garamond", serif'; ctx.fillText(years, w / 2, h - 30);
    });
  },

  glow() {
    return canvasTexture(128, 128, (ctx, w, h) => {
      const g = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w / 2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,0.5)'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    });
  },

  cobble() {
    return canvasTexture(512, 512, (ctx, w, h) => {
      ctx.fillStyle = '#2a2724'; ctx.fillRect(0, 0, w, h);
      const r = rng(9);
      for (let y = 0; y < h; y += 28) for (let x = 0; x < w; x += 36) {
        const off = (Math.floor(y / 28) % 2) * 18;
        const v = 60 + r() * 35;
        ctx.fillStyle = `rgb(${v},${v - 3},${v - 8})`;
        ctx.beginPath(); ctx.roundRect(x + off + 2, y + 2, 32, 24, 7); ctx.fill();
      }
    }, { repeat: [6, 30] });
  },

  grass() {
    return canvasTexture(512, 512, (ctx, w, h) => {
      const img = ctx.createImageData(w, h);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const n = N.fbm(x / 70, y / 70, 5), d = N.fbm(x / 12 + 50, y / 12, 2);
        const i = (y * w + x) * 4;
        img.data[i] = 150 + n * 50 - d * 25; img.data[i + 1] = 135 + n * 50 - d * 20; img.data[i + 2] = 85 + n * 40 - d * 15; img.data[i + 3] = 255;
      }
      ctx.putImageData(img, 0, 0);
    }, { repeat: [8, 8] });
  },
};

/** Gradient sky dome. */
export function makeSky(top, bottom, radius = 400) {
  const geo = new THREE.SphereGeometry(radius, 24, 16);
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    uniforms: { top: { value: new THREE.Color(top) }, bottom: { value: new THREE.Color(bottom) } },
    vertexShader: `varying vec3 vP; void main(){ vP = position; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: `uniform vec3 top; uniform vec3 bottom; varying vec3 vP;
      void main(){ float h = normalize(vP).y * 0.5 + 0.5; gl_FragColor = vec4(mix(bottom, top, pow(h, 0.7)), 1.0); }`,
  });
  const m = new THREE.Mesh(geo, mat);
  m.frustumCulled = false;
  return m;
}

export function sprite(tex, color, size, opacity = 1) {
  const mat = new THREE.SpriteMaterial({ map: tex, color, transparent: true, opacity, depthWrite: false, blending: THREE.AdditiveBlending });
  const s = new THREE.Sprite(mat);
  s.scale.set(size, size, 1);
  return s;
}

/** Points cloud helper. */
export function particles(count, spread, color, size = 0.06, seed = 1, tex) {
  const r = rng(seed);
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = (r() - 0.5) * spread[0];
    pos[i * 3 + 1] = (r() - 0.5) * spread[1];
    pos[i * 3 + 2] = (r() - 0.5) * spread[2];
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, map: tex || null, sizeAttenuation: true });
  return new THREE.Points(geo, mat);
}
