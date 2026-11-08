import * as THREE from 'three';
import { lerp, clamp, remap, rng, smooth, particles } from '../utils.js';
import { makeColumn, makeOliveTree, marbleMat, groundPatch, photoPlate } from '../props.js';
import { assets, place } from '../assets.js';

/* ---------------------------------------------------------------- Scene 15: neon blueprints */
export function sceneBlueprint(ctx) {
  const group = new THREE.Group();
  group.add(new THREE.AmbientLight('#102030', 0.8));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), new THREE.MeshPhysicalMaterial({ color: '#06101c', roughness: 0.12, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.1 }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.05; floor.receiveShadow = true; group.add(floor);
  const neon = new THREE.PointLight('#4df2ff', 0, 60, 2); neon.position.set(0, 9, 0); group.add(neon);

  // Build polylines for a civic building (steps, colonnade, pediment, dome)
  const lines = [];
  const add = (...pts) => lines.push(pts.map((p) => new THREE.Vector3(...p)));
  const arc = (cx, cy, cz, r, a0, a1, n, axis = 'xy') => { const pts = []; for (let i = 0; i <= n; i++) { const a = lerp(a0, a1, i / n); pts.push(axis === 'xy' ? [cx + Math.cos(a) * r, cy + Math.sin(a) * r, cz] : [cx + Math.cos(a) * r, cy, cz + Math.sin(a) * r]); } lines.push(pts.map((p) => new THREE.Vector3(...p))); };
  for (let i = 0; i < 4; i++) { const w = 12 - i * 0.6, z = 4 - i * 0.5, y = i * 0.3; add([-w, y, z], [w, y, z], [w, y, -4], [-w, y, -4], [-w, y, z]); add([-w, y + 0.3, z], [w, y + 0.3, z]); }
  for (let i = -5; i <= 5; i++) { const x = i * 2; add([x, 1.2, 2.6], [x, 7.2, 2.6]); add([x - 0.35, 7.2, 2.6], [x + 0.35, 7.2, 2.6]); add([x - 0.4, 1.2, 2.6], [x + 0.4, 1.2, 2.6]); }
  add([-11, 7.2, 2.6], [11, 7.2, 2.6], [11, 8.2, 2.6], [-11, 8.2, 2.6], [-11, 7.2, 2.6]);
  add([-11, 8.2, 2.6], [0, 11.5, 2.6], [11, 8.2, 2.6]);
  add([-11, 1.2, -4], [11, 1.2, -4], [11, 8.2, -4], [-11, 8.2, -4], [-11, 1.2, -4]);
  add([-11, 8.2, 2.6], [-11, 8.2, -4]); add([11, 8.2, 2.6], [11, 8.2, -4]);
  arc(0, 8.2, -0.7, 4.5, 0, Math.PI * 2, 48, 'xz'); arc(0, 11, -0.7, 4.5, 0, Math.PI * 2, 48, 'xz');
  for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; add([Math.cos(a) * 4.5, 8.2, -0.7 + Math.sin(a) * 4.5], [Math.cos(a) * 4.5, 11, -0.7 + Math.sin(a) * 4.5]); }
  for (let k = 0; k < 8; k++) { const a = (k / 8) * Math.PI; const pts = []; for (let i = 0; i <= 20; i++) { const t = (i / 20) * Math.PI; pts.push(new THREE.Vector3(Math.cos(t) * 4.5 * Math.cos(a), 11 + Math.sin(t) * 4.5, -0.7 + Math.cos(t) * 4.5 * Math.sin(a))); } lines.push(pts); }
  arc(0, 15.5, -0.7, 0.6, 0, Math.PI * 2, 16, 'xz'); add([0, 15.5, -0.7], [0, 17.5, -0.7]);
  add([-13, -0.5, 4.5], [13, -0.5, 4.5]); add([-13, -0.9, 4.5], [-13, -0.1, 4.5]); add([13, -0.9, 4.5], [13, -0.1, 4.5]);
  add([14, 0, 2.6], [14, 11.5, 2.6]); add([13.6, 11.5, 2.6], [14.4, 11.5, 2.6]); add([13.6, 0, 2.6], [14.4, 0, 2.6]);
  for (let i = -20; i <= 20; i += 2) { add([i * 2, -0.02, -40], [i * 2, -0.02, 40]); add([-40, -0.02, i * 2], [40, -0.02, i * 2]); }

  const segs = [], prog = [];
  const gridStart = lines.length - 42;
  let total = 0; const lens = lines.map((pl, li) => { let L = 0; for (let i = 1; i < pl.length; i++) L += pl[i].distanceTo(pl[i - 1]); if (li < gridStart) total += L; return L; });
  let acc = 0;
  lines.forEach((pl, li) => {
    let l0 = acc;
    for (let i = 1; i < pl.length; i++) {
      const a = pl[i - 1], b = pl[i], d = a.distanceTo(b);
      segs.push(a.x, a.y, a.z, b.x, b.y, b.z);
      const isGrid = li >= gridStart;
      prog.push(isGrid ? 0 : l0 / total, isGrid ? 0 : (l0 + d) / total);
      l0 += d;
    }
    acc += lens[li];
  });
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(new Float32Array(segs), 3));
  geo.setAttribute('aP', new THREE.BufferAttribute(new Float32Array(prog), 1));
  const uniforms = { uDraw: { value: 0 }, uTime: { value: 0 }, uColor: { value: new THREE.Color('#4df2ff') } };
  const lineMat = new THREE.ShaderMaterial({
    uniforms, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: `attribute float aP; varying float vP; varying float vY; void main(){ vP = aP; vY = position.y; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `uniform float uDraw; uniform float uTime; uniform vec3 uColor; varying float vP; varying float vY;
      void main(){ if (vP > uDraw) discard; float head = smoothstep(uDraw-0.03, uDraw, vP); float grid = vY < 0.0 ? 0.25 : 1.0; vec3 c = mix(uColor, vec3(1.0), head*0.9); gl_FragColor = vec4(c * (1.0 + head*2.0), (0.55 + 0.45*head) * grid * (0.85 + 0.15*sin(uTime*6.0 + vP*60.0))); }`,
  });
  const drawing = new THREE.LineSegments(geo, lineMat); group.add(drawing);
  for (const off of [[0.02, 0, 0], [-0.02, 0, 0], [0, 0.02, 0]]) { const g2 = new THREE.LineSegments(geo, lineMat.clone()); g2.material.uniforms = uniforms; g2.position.set(...off); group.add(g2); }
  // the building itself emerging as translucent glass volume behind the lines
  const glass = new THREE.MeshPhysicalMaterial({ color: '#4df2ff', transparent: true, opacity: 0, roughness: 0.1, metalness: 0.2, transmission: 0.6, thickness: 1.5, emissive: '#0a4a60', emissiveIntensity: 0.6, side: THREE.DoubleSide, depthWrite: false });
  const body = new THREE.Mesh(new THREE.BoxGeometry(22, 7, 6.6), glass); body.position.set(0, 4.7, -0.7); group.add(body);
  const dome = new THREE.Mesh(new THREE.SphereGeometry(4.5, 48, 24, 0, Math.PI * 2, 0, Math.PI / 2), glass); dome.position.set(0, 11, -0.7); group.add(dome);
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(4.5, 4.5, 2.8, 48, 1, true), glass); drum.position.set(0, 9.6, -0.7); group.add(drum);
  // real marble columns ghosting in as the design is finalised
  const ghostCols = [];
  const ghostMat = marbleMat().clone(); ghostMat.transparent = true; ghostMat.opacity = 0; ghostMat.emissive = new THREE.Color('#0c3a48'); ghostMat.emissiveIntensity = 0.4;
  for (let i = -5; i <= 5; i++) { const c = makeColumn({ height: 6, radius: 0.36, drums: 6, seed: 700 + i, mat: ghostMat }); c.position.set(i * 2, 1.2, 2.6); group.add(c); ghostCols.push(c); }
  const motes = particles(900, [60, 30, 60], '#4df2ff', 0.08, 15, ctx.glowTex); motes.position.y = 8; group.add(motes);

  let draw = 0, drawTarget = 0;
  return {
    name: 'The architects', theme: 'dark', bg: '#061020', fog: ['#061020', 30, 120], group, transitionIn: 'fade',
    env: { id: 'potsdamer_platz', background: false, intensity: 0.35 },
    grade: { saturation: 1.1, contrast: 1.1, warmth: -0.2, bloom: 1.6 },
    camera(local, cam, target) {
      const a = -0.9 + local * 1.4;
      cam.position.set(Math.sin(a) * 30, 6 + local * 6, Math.cos(a) * 30);
      target.set(0, 7, -0.7);
      cam.fov = 46;
    },
    update(local, time, dt) {
      drawTarget = Math.max(drawTarget, remap(local, 0.05, 0.75));
      draw = lerp(draw, drawTarget, dt * 1.5);
      uniforms.uDraw.value = draw; uniforms.uTime.value = time;
      motes.rotation.y = time * 0.03;
      const solid = remap(draw, 0.7, 1);
      glass.opacity = solid * 0.35; ghostMat.opacity = solid * 0.85;
      neon.intensity = 20 + draw * 60 + Math.sin(time * 5) * 6;
    },
    woman(local) {
      const a = -0.9 + local * 1.4;
      return { x: Math.sin(a) * 14, y: 0, z: Math.cos(a) * 14 + 6, scale: 1.3, facing: a + Math.PI / 2, walk: 1, beckon: 0, point: 0.6, opacity: 0.22, solid: 0, flow: 1.4 };
    },
    triggers: { draw: () => { drawTarget = 1; } },
  };
}

/* ---------------------------------------------------------------- Scene 16: boundless */
export function sceneFinale(ctx) {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight('#fff6e8', '#ffe7b8', 0.55));
  const key = new THREE.DirectionalLight('#fff4de', 1.7); key.position.set(6, 10, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -12; key.shadow.camera.right = 12; key.shadow.camera.top = 12; key.shadow.camera.bottom = -12; key.shadow.bias = -0.0004; key.shadow.normalBias = 0.02; group.add(key);
  // bright marble forecourt
  group.add(groundPatch('marble_01', { width: 140, depth: 80, z: -10, repeat: [40, 22], fade: 0.5, light: [0.72, 0.68, 0.6] }));
  // Albert Bierstadt, Among the Sierra Nevada (1868): open country and breaking light beyond the forum
  const vista = photoPlate('bierstadt_sierra.jpg', 200, { curve: 0.25, fadeX: 0.12, fadeTop: 0.12, fadeBottom: 0 });
  vista.position.set(0, 0, -90); vista.material.depthWrite = false;
  const sit = () => { if (vista.scale.y > 1) vista.position.y = vista.scale.y / 2 - 40; else requestAnimationFrame(sit); };
  sit(); group.add(vista);
  // a wide ring of new, whole columns — a forum open to the sky
  const R = 14, n = 18;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    if (Math.abs(a - Math.PI / 2) < 0.4) continue; // leave the viewer's side open
    const c = makeColumn({ height: 7, radius: 0.46, drums: 7, seed: 800 + i });
    c.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); group.add(c);
  }
  const r = rng(16);
  for (let i = 0; i < 10; i++) { const t = makeOliveTree(900 + i, 0.9 + r() * 0.6); const a = r() * Math.PI * 2, d = 20 + r() * 12; t.position.set(Math.cos(a) * d, -0.1, Math.sin(a) * d); group.add(t); }
  place(group, assets.model('boulder_01'), { height: 0.8, position: [-6, -0.1, 4], rotation: [0, 1, 0] });
  place(group, assets.model('boulder_01'), { height: 1.1, position: [7, -0.1, -3], rotation: [0, 2.3, 0] });
  const motes = particles(800, [40, 20, 40], '#ffd27a', 0.1, 16, ctx.glowTex); motes.material.opacity = 0.22; motes.position.y = 6; group.add(motes);

  let reveal = 0, revealTarget = 0;
  const api = {
    name: 'Feminism is democracy', theme: 'light', bg: '#fff3d6', fog: ['#fff3d6', 40, 240], group, transitionIn: 'fade',
    env: { id: 'kloppenheim_03_puresky', background: true, intensity: 0.72, bgIntensity: 0.62, rotation: -1.2 },
    grade: { saturation: 1.02, contrast: 1.0, warmth: 0.12, bloom: 0.08, grain: 0.016 },
    camera(local, cam, target) {
      const t = smooth(clamp(local / 0.7));
      cam.position.set(lerp(-3, 0, t), lerp(1.8, 1.5, t), lerp(10, 4.6, t));
      target.set(0, lerp(1.2, 1.15, t), 0);
      cam.fov = lerp(44, 38, t);
    },
    update(local, time, dt) {
      revealTarget = Math.max(revealTarget, remap(local, 0.2, 0.65));
      reveal = lerp(reveal, revealTarget, dt * 1.2);
      motes.rotation.y = time * 0.04;
      api.reveal = reveal;
    },
    woman(local) {
      const turnT = remap(local, 0.05, 0.35);
      return { x: 0, y: 0, z: 0, scale: 1, facing: lerp(Math.PI * 0.85, 0, smooth(turnT)), walk: 1 - turnT, beckon: 0, point: 0, opacity: lerp(0.18, 1, reveal), solid: reveal, flow: lerp(1.2, 0.6, reveal) };
    },
    triggers: { reveal: () => { revealTarget = 1; } },
    reveal: 0,
  };
  return api;
}
