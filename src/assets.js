import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { RGBELoader } from 'three/addons/loaders/RGBELoader.js';

/**
 * Asset pipeline for everything in public/assets (raw files: scripts/fetch-assets.mjs,
 * web versions: scripts/optimize-assets.mjs). Images and textures are WebP, models are
 * Draco .glb, HDRIs are 1k (lighting only) and visible skies are WebP panoramas.
 * All loaders are cached; models are cloned per request so scenes can own them.
 */
const BASE = `${import.meta.env.BASE_URL}assets/`;
const webp = (file) => file.replace(/\.(jpe?g|png)$/i, '.webp');

const texLoader = new THREE.TextureLoader();
const rgbeLoader = new RGBELoader();
const draco = new DRACOLoader();
const gltfLoader = new GLTFLoader().setDRACOLoader(draco);

const cache = new Map();
const memo = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

export const loading = { pending: 0, done: 0, listeners: new Set() };
function track(promise) {
  loading.pending++;
  const fin = () => { loading.done++; loading.listeners.forEach((l) => l(loading)); };
  promise.then(fin, fin);
  return promise;
}

export const assets = {
  /** Equirectangular 512px HDR for environment lighting. */
  hdri(id) {
    return memo(`hdri:${id}`, () => track(new Promise((resolve, reject) => {
      rgbeLoader.load(`${BASE}hdri/${id}.hdr`, (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        resolve(tex);
      }, undefined, reject);
    })));
  },

  /** Visible sky: a tone-mapped 4k WebP panorama of the same HDRI (a fraction of the HDR's weight). */
  sky(id) {
    return memo(`sky:${id}`, () => track(new Promise((resolve, reject) => {
      texLoader.load(`${BASE}sky/${id}.webp`, (tex) => {
        tex.mapping = THREE.EquirectangularReflectionMapping;
        tex.colorSpace = THREE.SRGBColorSpace;
        resolve(tex);
      }, undefined, reject);
    })));
  },

  /** Single color texture (sRGB) — paintings, photos, maps. */
  image(file, { repeat, srgb = true } = {}) {
    return memo(`img:${file}:${repeat}`, () => {
      const tex = texLoader.load(`${BASE}images/${webp(file)}`);
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.anisotropy = 8;
      if (repeat) { tex.wrapS = tex.wrapT = THREE.RepeatWrapping; tex.repeat.set(...repeat); }
      return tex;
    });
  },

  /** Poly Haven PBR set → MeshStandardMaterial (diffuse + normal + ARM). */
  pbr(id, { repeat = [1, 1], color = '#ffffff', roughness = 1, metalness = 1, normalScale = 1, ...rest } = {}) {
    const load = (map, srgb) => memo(`tex:${id}:${map}:${repeat}`, () => {
      const t = texLoader.load(`${BASE}textures/${id}/${id}_${map}_1k.webp`);
      if (srgb) t.colorSpace = THREE.SRGBColorSpace;
      t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(...repeat); t.anisotropy = 8;
      return t;
    });
    const arm = load('arm', false);
    const mat = new THREE.MeshStandardMaterial({
      map: load('diff', true), normalMap: load('nor_gl', false), aoMap: arm, roughnessMap: arm, metalnessMap: arm,
      roughness, metalness, color, normalScale: new THREE.Vector2(normalScale, normalScale), ...rest,
    });
    return mat;
  },

  /** Poly Haven model (Draco .glb, 1k WebP textures). Returns a fresh clone each call. */
  model(id) {
    return memo(`model:${id}`, () => track(new Promise((resolve, reject) => {
      gltfLoader.load(`${BASE}models/${id}.glb`, (g) => resolve(prep(g.scene)), undefined, reject);
    }))).then((scene) => scene.clone(true));
  },

  /** Smithsonian Draco GLB scan. */
  scan(file) {
    return memo(`scan:${file}`, () => track(new Promise((resolve, reject) => {
      gltfLoader.load(`${BASE}models/smithsonian/${file}`, (g) => resolve(prep(g.scene)), undefined, reject);
    }))).then((scene) => scene.clone(true));
  },
};

function prep(scene) {
  scene.traverse((o) => {
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true;
      if (o.material?.map) o.material.map.anisotropy = 8;
    }
  });
  return scene;
}

/** Uniformly scale an object so its bounding-box height equals `height`, and sit its base on y=0 (centered in x/z). */
export function fit(obj, height, { center = true, ground = true } = {}) {
  const box = new THREE.Box3().setFromObject(obj);
  const size = box.getSize(new THREE.Vector3());
  const s = height / Math.max(size.y, 1e-6);
  obj.scale.multiplyScalar(s);
  const box2 = new THREE.Box3().setFromObject(obj);
  const c = box2.getCenter(new THREE.Vector3());
  if (center) { obj.position.x -= c.x; obj.position.z -= c.z; }
  if (ground) obj.position.y -= box2.min.y;
  return obj;
}

/** Convenience: load, fit, position, and add to a parent; returns the promise of the object. */
export function place(parent, loader, { height, position = [0, 0, 0], rotation = [0, 0, 0], onReady } = {}) {
  return loader.then((obj) => {
    if (height) fit(obj, height);
    const holder = new THREE.Group();
    holder.add(obj);
    holder.position.set(...position);
    holder.rotation.set(...rotation);
    parent.add(holder);
    onReady?.(holder, obj);
    return holder;
  }).catch((e) => { console.warn('asset failed', e); return null; });
}

/** A framed picture built from a real painting texture and a real frame model (when loaded). */
export function picture(file, { width = 1.6, frameModel = 'fancy_picture_frame_01' } = {}) {
  const g = new THREE.Group();
  const tex = texLoader.load(`${BASE}images/${webp(file)}`, () => sizeTo());
  tex.colorSpace = THREE.SRGBColorSpace; tex.anisotropy = 8;
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.75, metalness: 0 }));
  canvas.castShadow = true;
  g.add(canvas);
  // size canvas to image aspect once loaded
  const sizeTo = () => {
    const img = tex.image; if (!img || !img.width) return;
    const h = width * (img.height / img.width);
    canvas.scale.set(width, h, 1);
    g.userData.height = h;
    // simple gilded frame (real frame models have fixed aspect; we build a fitted one)
    const gold = new THREE.MeshStandardMaterial({ color: '#b8923a', roughness: 0.35, metalness: 0.9 });
    const t = Math.max(0.06, width * 0.06);
    for (const [pw, ph, x, y] of [[width + 2 * t, t, 0, h / 2 + t / 2], [width + 2 * t, t, 0, -h / 2 - t / 2], [t, h, -width / 2 - t / 2, 0], [t, h, width / 2 + t / 2, 0]]) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, t * 1.4), gold); m.position.set(x, y, t * 0.2); m.castShadow = true; g.add(m);
    }
    const inner = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, h + 0.02, 0.02), new THREE.MeshStandardMaterial({ color: '#2a1d0c' })); inner.position.z = -0.012; g.add(inner);
  };
  g.userData.canvas = canvas;
  return g;
}
