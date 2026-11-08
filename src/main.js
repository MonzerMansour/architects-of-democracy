import * as THREE from 'three';
import gsap from 'gsap';
import { Woman } from './woman.js';
import { TextDirector } from './text.js';
import { textures, lerp, clamp, remap, smooth } from './utils.js';
import { assets, loading } from './assets.js';
import { Post } from './post.js';
import { CursorFX } from './cursor.js';
import { startMusic } from './music.js';
import { scenePnyx, sceneRuins, sceneFracture } from './scenes/greece.js';
import { sceneEmpires, sceneMap } from './scenes/history.js';
import { sceneHall, sceneInk, sceneChromosome } from './scenes/america.js';
import { sceneGallery, sceneQuay, sceneTwenties } from './scenes/rise.js';
import { sceneShadows, sceneDismantle, sceneReplace } from './scenes/modern.js';
import { sceneBlueprint, sceneFinale } from './scenes/future.js';

const FACTORIES = [
  scenePnyx, sceneRuins, sceneFracture, sceneEmpires, sceneMap, sceneHall, sceneInk, sceneChromosome,
  sceneGallery, sceneQuay, sceneTwenties, sceneShadows, sceneDismantle, sceneReplace, sceneBlueprint, sceneFinale,
];

/* ------------------------------------------------------------------ renderer */
const canvas = document.getElementById('stage');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = THREE.SRGBColorSpace;

const scene = new THREE.Scene();
scene.fog = new THREE.Fog('#000000', 10, 100);
scene.backgroundBlurriness = 0.0;
const camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 600);
const target = new THREE.Vector3();

const woman = new Woman();
scene.add(woman.group);

const ctx = {
  renderer, scene, camera, glowTex: textures.glow(), time: 0, mouse: { x: 0, y: 0 },
};
const post = new Post(renderer, scene, camera);

/* ------------------------------------------------------------------ environment (HDRI) */
const env = { id: null, tex: null, bgTex: null, wantBg: false, intensity: 1, bgIntensity: 1, rotation: 0 };
/** A blurred background reads fine from the 1k HDR; a sharp one uses the 4k WebP panorama. */
const usesSky = (spec) => !!spec.background && !spec.blur;
function prefetchEnv(spec) {
  if (!spec) return;
  assets.hdri(spec.id).catch(() => {});
  if (usesSky(spec)) assets.sky(spec.id).catch(() => {});
}
function applyEnv(active) {
  const spec = active.env;
  if (!spec) { env.id = null; env.tex = null; env.bgTex = null; scene.environment = null; scene.background = null; return; }
  const key = `${spec.id}:${usesSky(spec) ? 'sky' : 'hdr'}`;
  if (env.id !== key) {
    env.id = key;
    assets.hdri(spec.id).then((tex) => { if (env.id === key) env.tex = tex; }).catch((e) => console.warn('hdri failed', e));
    if (usesSky(spec)) assets.sky(spec.id).then((tex) => { if (env.id === key) env.bgTex = tex; }).catch((e) => console.warn('sky failed', e));
    else env.bgTex = null;
  }
  env.wantBg = !!spec.background;
  scene.backgroundBlurriness = spec.blur ?? 0;
  env.intensity = spec.intensity ?? 1;
  env.bgIntensity = spec.bgIntensity ?? 1;
  env.rotation = spec.rotation ?? 0;
}
function updateEnv(dt, bgColor) {
  if (env.tex) {
    scene.environment = env.tex;
    scene.environmentIntensity = env.intensity;
    scene.environmentRotation.set(0, env.rotation, 0);
    if (env.wantBg) {
      scene.background = env.bgTex || env.tex;
      scene.backgroundIntensity = env.bgIntensity;
      scene.backgroundRotation.set(0, env.rotation, 0);
    } else scene.background = null;
  } else { scene.environment = null; scene.background = null; }
  renderer.setClearColor(bgColor);
}

/* ------------------------------------------------------------------ DOM */
const sections = Array.from(document.querySelectorAll('.scene'));
const N = sections.length;
const veil = document.getElementById('veil');
const finalColor = document.getElementById('final-color');
const hudBar = document.getElementById('hud-bar');
const hudEra = document.getElementById('hud-era');
const hint = document.getElementById('scroll-hint');

/* ------------------------------------------------------------------ scenes */
const scenes = new Array(N).fill(null);
const cursorFx = new CursorFX();
function ensure(i) {
  if (i < 0 || i >= N) return null;
  if (!scenes[i]) scenes[i] = FACTORIES[i](ctx);
  return scenes[i];
}

const music = startMusic({
  sad: `${import.meta.env.BASE_URL}assets/audio/wildflower.m4a`,
  glad: `${import.meta.env.BASE_URL}assets/audio/schuyler-sisters.mp3`,
}, document.getElementById('hud-sound'));
const director = new TextDirector(sections, {
  onTrigger(i, name) {
    const s = ensure(i);
    s?.triggers?.[name]?.();
  },
  onEvent(i, type, payload) {
    const s = ensure(i);
    if (type === 'stamp') { s?.shake?.(); }
    if (type === 'replace') { s?.setStep?.(payload); }
  },
});

/* ------------------------------------------------------------------ scroll state */
const state = {
  scrollY: window.scrollY, smoothY: window.scrollY, lastY: window.scrollY, dir: 1,
  active: -1, roll: 0, fovBump: 0, veilExtra: 0,
};
let layout = [];
function measure() {
  layout = sections.map((s) => ({ top: s.offsetTop, h: s.offsetHeight }));
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(window.innerWidth, window.innerHeight);
  post.setSize(window.innerWidth, window.innerHeight);
}
measure();
window.addEventListener('resize', measure);
window.addEventListener('scroll', () => { state.scrollY = window.scrollY; }, { passive: true });
window.addEventListener('pointermove', (e) => { ctx.mouse.x = (e.clientX / window.innerWidth) * 2 - 1; ctx.mouse.y = -((e.clientY / window.innerHeight) * 2 - 1); });

/** Which section index is "active" for a given scroll position (sticky text on screen). */
function indexAt(y) {
  let i = 0;
  for (let k = 0; k < N; k++) if (y >= layout[k].top) i = k;
  return i;
}
function localAt(i, y) {
  const start = layout[i].top;
  const end = i + 1 < N ? layout[i + 1].top : start + Math.max(1, layout[i].h - window.innerHeight);
  return clamp((y - start) / Math.max(1, end - start));
}

function flashVeil(peak = 1, dur = 0.4) {
  gsap.killTweensOf(state, 'veilExtra');
  gsap.fromTo(state, { veilExtra: peak }, { veilExtra: 0, duration: dur, ease: 'power2.out' });
}

/* ------------------------------------------------------------------ switching */
function activate(i) {
  if (i === state.active) return;
  const prev = scenes[state.active];
  if (prev) scene.remove(prev.group);
  const next = ensure(i);
  scene.add(next.group);
  state.active = i;
  cursorFx.set(i);
  document.body.dataset.theme = next.theme;
  hudEra.textContent = sections[i].dataset.era;
  applyEnv(next);
  post.set(next.grade);
  const w = next.woman(localAt(i, state.scrollY), ctx.time);
  woman.set(w); woman.place(w.x, w.y, w.z);
  warmAround(i);
}

/** Build the next scenes (and fetch their skies) while the visitor reads this one, never the whole essay at once. */
let warmTimer = 0;
function warmAround(i) {
  clearTimeout(warmTimer);
  const queue = [i + 1, i - 1, i + 2].filter((k) => k >= 0 && k < N && !scenes[k]);
  const step = () => {
    const k = queue.shift();
    if (k === undefined) return;
    prefetchEnv(ensure(k)?.env);
    warmTimer = setTimeout(step, 250);
  };
  warmTimer = setTimeout(step, 120);
}

/* ------------------------------------------------------------------ loop */
const bgColor = new THREE.Color();
const fogColor = new THREE.Color();
const clock = new THREE.Clock();
const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

function frame() {
  const dt = Math.min(0.05, clock.getDelta());
  ctx.time += dt;
  const vh = window.innerHeight;

  // smooth the scroll; text and 3D share the same active scene
  const k = reduce ? 1 : 1 - Math.pow(0.0001, dt);
  state.smoothY = lerp(state.smoothY, state.scrollY, k);
  if (Math.abs(state.scrollY - state.lastY) > 0.5) state.dir = Math.sign(state.scrollY - state.lastY) || 1;
  state.lastY = state.scrollY;

  // --- 3D world (smoothed scroll) — text uses the same active index so they leave together
  const y = state.smoothY;
  const i = indexAt(y);
  // transition window: TW viewports tall, centred on each section boundary
  let trans = null;
  const TW = vh * 0.4, half = TW / 2;
  const nextTop = i + 1 < N ? layout[i + 1].top : Infinity;
  if (y > nextTop - half) trans = { from: i, to: i + 1, t: clamp((y - (nextTop - half)) / TW) };
  else if (i > 0 && y < layout[i].top + half) trans = { from: i - 1, to: i, t: clamp((y - (layout[i].top - half)) / TW) };

  let veilAmt = 0;
  state.roll = lerp(state.roll, 0, dt * 4);
  state.fovBump = lerp(state.fovBump, 0, dt * 4);
  if (trans) {
    const toScene = ensure(trans.to);
    const kind = toScene.transitionIn;
    const t = trans.t;
    const bell = Math.sin(t * Math.PI);
    if (kind === 'fade') veilAmt = Math.pow(bell, 0.8) * (toScene.theme === 'light' ? 0.28 : 0.85);
    else if (kind === 'spin') { state.roll = smooth(t) * Math.PI * 2 * (trans.to > trans.from ? 1 : -1); state.fovBump = bell * 18; veilAmt = Math.pow(bell, 3) * 0.35; }
    else if (kind === 'zoom') { state.fovBump = (t < 0.5 ? -t * 2 : (1 - t) * 2) * -18; veilAmt = Math.pow(bell, 4) * 0.45; }
    else if (kind === 'stamp') veilAmt = Math.pow(bell, 2.5) * 0.22;
    else veilAmt = Math.pow(bell, 6) * 0.35; // cut: a quick blink
    activate(t < 0.5 ? trans.from : trans.to);
  } else {
    activate(i);
  }
  const active = scenes[state.active];
  const local = localAt(state.active, y);

  sections.forEach((sec, k) => {
    if (k === state.active) { director.show(k, state.dir); director.progress(k, localAt(k, y)); }
    else director.hide(k, state.dir);
  });
  hint.classList.toggle('hidden', state.scrollY > vh * 0.3);
  hudBar.style.width = `${(state.scrollY / Math.max(1, document.body.scrollHeight - vh)) * 100}%`;

  // scene update + camera
  active.update(local, ctx.time, dt);
  active.camera(local, camera, target);
  camera.fov = clamp(camera.fov + state.fovBump, 15, 120);
  camera.lookAt(target);
  post.setFocus(active.focus ? active.focus(local, camera, target) : camera.position.distanceTo(target));
  camera.rotateZ(state.roll);
  camera.updateProjectionMatrix();

  // environment
  bgColor.copy(active.bgDyn || bgColor.set(active.bg));
  if (active.env && (env.intensity !== (active.env.intensity ?? 1) || env.bgIntensity !== (active.env.bgIntensity ?? 1))) { env.intensity = active.env.intensity ?? 1; env.bgIntensity = active.env.bgIntensity ?? 1; }
  updateEnv(dt, bgColor);
  if (active.fog) { fogColor.set(active.fog[0]); scene.fog.color.copy(active.bgDyn || fogColor); scene.fog.near = active.fog[1]; scene.fog.far = active.fog[2]; }
  else { scene.fog.color.copy(bgColor); scene.fog.near = 400; scene.fog.far = 600; }
  if (document.body.dataset.theme !== active.theme) document.body.dataset.theme = active.theme;
  if (active.grade) post.set(active.grade);

  // the guide
  const w = active.woman(local, ctx.time);
  woman.set(w);
  woman.moveTo(w.x, w.y, w.z, dt);
  woman.update(dt, ctx.time);

  // veil + a late, clean hold card — not a mid-scene gold flash over the copy
  veil.style.opacity = clamp(veilAmt + state.veilExtra).toFixed(3);
  const endSec = sections[N - 1];
  if (state.active === N - 1) {
    const wash = remap(local, 0.96, 1);
    const op = smooth(wash);
    finalColor.style.opacity = op.toFixed(3);
    finalColor.style.pointerEvents = op > 0.85 ? 'auto' : 'none';
    endSec.classList.toggle('ending', op > 0.02);
  } else {
    if (finalColor.style.opacity !== '0') finalColor.style.opacity = '0';
    endSec.classList.remove('ending');
  }

  cursorFx.tick(dt, ctx.time);
  // sad score through the critique; blend into Schuyler Sisters as we rewrite
  music?.setMix(state.active < 11 ? 0 : state.active === 11 ? remap(local, 0.4, 1) : 1);
  post.render(dt, ctx.time, 0);
  requestAnimationFrame(frame);
}

/* ------------------------------------------------------------------ boot */
async function boot() {
  veil.style.opacity = '1';
  state.veilExtra = 1;
  try { await document.fonts?.ready; } catch (_) { /* ignore */ }
  const start = indexAt(window.scrollY);
  ensure(start);
  measure();
  activate(start);
  // wait (briefly) for the first scene's lighting, sky and pending models before lifting the veil
  const first = scenes[start];
  const waits = [];
  if (first?.env) { waits.push(assets.hdri(first.env.id)); if (usesSky(first.env)) waits.push(assets.sky(first.env.id)); }
  const settled = new Promise((r) => { const check = () => (loading.done >= loading.pending ? r() : setTimeout(check, 100)); check(); });
  await Promise.race([Promise.allSettled([...waits, settled]), new Promise((r) => setTimeout(r, 8000))]);
  requestAnimationFrame(frame);
  gsap.to(state, { veilExtra: 0, duration: 2.4, ease: 'power2.inOut' });
}
boot();

// loading indicator in the HUD
loading.listeners.add(({ pending, done }) => {
  hudEra.dataset.loading = pending > done ? `${done}/${pending}` : '';
});

// small debug handle (harmless in production): window.__essay.woman.set({ opacity: 1 })
window.__essay = { woman, scenes, state, ctx, post, env, music };
window.__go = (i, local = 0.5) => {
  const start = layout[i].top;
  const end = i + 1 < N ? layout[i + 1].top : start + layout[i].h - window.innerHeight;
  window.scrollTo(0, start + local * Math.max(1, end - start));
};
