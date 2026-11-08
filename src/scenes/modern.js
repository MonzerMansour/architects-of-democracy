import * as THREE from 'three';
import { lerp, clamp, remap, rng, smooth, particles } from '../utils.js';
import { makeColumn, makeOfficeTower, marbleMat, framedImage, photoPlate } from '../props.js';
import { assets, place } from '../assets.js';

/* ---------------------------------------------------------------- Scene 12: specters of Philadelphia and Athens */
export function sceneShadows(ctx) {
  const group = new THREE.Group();
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), assets.pbr('concrete_pavement_02', { repeat: [40, 40], color: '#6a6c72', roughness: 0.7 }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  // wet sheen
  const wet = new THREE.Mesh(new THREE.PlaneGeometry(220, 220), new THREE.MeshPhysicalMaterial({ color: '#0a0b10', roughness: 0.08, metalness: 0.2, transparent: true, opacity: 0.45, clearcoat: 1 }));
  wet.rotation.x = -Math.PI / 2; wet.position.y = 0.01; group.add(wet);
  const stark = new THREE.DirectionalLight('#dfe6ff', 3.5); stark.position.set(-18, 22, 8); stark.castShadow = true;
  stark.shadow.mapSize.set(2048, 2048); stark.shadow.camera.left = -40; stark.shadow.camera.right = 40; stark.shadow.camera.top = 40; stark.shadow.camera.bottom = -40; stark.shadow.camera.far = 150; stark.shadow.bias = -0.0008;
  group.add(stark);
  group.add(new THREE.AmbientLight('#1a1c24', 0.8));
  const r = rng(2026);
  // ancient pillars on a modern plaza
  for (let i = 0; i < 7; i++) {
    const c = makeColumn({ height: 7, radius: 0.5, drums: 7, broken: i % 3 === 0 ? 1 : 0, seed: 500 + i });
    c.position.set(-9 + i * 3, 0, -2 + (i % 2) * 2); group.add(c);
  }
  // the founders as marble, cold under floodlight; the Greek Slave lit from below
  place(group, assets.scan('washington_bust.glb'), { height: 2.6, position: [-12, 0, 2], rotation: [0, 0.6, 0] });
  place(group, assets.scan('waterston_bust.glb'), { height: 2.4, position: [11, 0, 1], rotation: [0, -0.5, 0] });
  place(group, assets.model('gothic_statue'), { height: 3.2, position: [4, 0, -6], rotation: [0, 0.3, 0] });
  const plinth = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 2), marbleMat()); plinth.position.set(-3, 0.5, 5); plinth.castShadow = plinth.receiveShadow = true; group.add(plinth);
  place(group, assets.scan('greek_slave.glb'), { height: 2.2, position: [-3, 1, 5], rotation: [0, 0.5, 0] });
  const uplight = new THREE.SpotLight('#9fc2ff', 80, 12, 0.6, 0.6, 1.2); uplight.position.set(-3, 0.2, 7); uplight.target.position.set(-3, 2.5, 5); group.add(uplight, uplight.target);
  // office towers looming
  const towers = [];
  for (let i = 0; i < 18; i++) {
    const w = 4 + r() * 5, h = 20 + r() * 40;
    const t = makeOfficeTower(w, h, w);
    // flanking the plaza so the painted ruin stays visible between them
    const side = i % 2 ? 1 : -1;
    t.position.set(side * (17 + r() * 22), h / 2, -4 - r() * 34); t.userData.h = h; t.userData.grow = 0;
    group.add(t); towers.push(t);
  }
  const rain = particles(2500, [60, 40, 60], '#9aa3b8', 0.04, 12, ctx.glowTex); rain.position.y = 15; group.add(rain);
  // Thomas Cole, Desolation (1836): the ruin of the classical republic hangs over the plaza like a ghost
  const ghost = photoPlate('cole_desolation.jpg', 240, { curve: 0.22, fadeX: 0.12, fadeTop: 0.1, fadeBottom: 0.25, tint: '#c8d0e0' });
  ghost.position.set(0, 0, -72); ghost.material.depthWrite = false;
  const sit = () => { if (ghost.scale.y > 1) ghost.position.y = ghost.scale.y / 2 - 14; else requestAnimationFrame(sit); };
  sit(); group.add(ghost);
  let grow = 0, growTarget = 0;
  return {
    name: 'The specters', theme: 'dark', bg: '#14161c', fog: ['#14161c', 24, 170], group, transitionIn: 'fade',
    env: { id: 'shanghai_bund', background: false, intensity: 0.7, rotation: 0.4 },
    grade: { saturation: 0.6, contrast: 1.15, warmth: -0.12, vignette: 1.3 },
    camera(local, cam, target) {
      cam.position.set(lerp(-6, 4, local), 1.2 + local * 3, 14 - local * 4);
      target.set(0, 6 + local * 6, -8);
      cam.fov = 58;
    },
    update(local, time, dt) {
      growTarget = Math.max(growTarget, remap(local, 0.3, 0.9));
      grow = lerp(grow, growTarget, dt * 1.2);
      for (const t of towers) { const s = 0.4 + grow * 0.6 + t.userData.grow; t.scale.y = s; t.position.y = (t.userData.h * s) / 2; t.userData.grow = lerp(t.userData.grow, 0, dt * 0.8); }
      rain.position.y = 15 - ((time * 6) % 20); rain.rotation.y = time * 0.01;
      stark.position.x = -18 + Math.sin(time * 0.2) * 6;
    },
    woman(local) {
      return { x: lerp(2, -4, local), y: 0, z: 4, scale: 1, facing: Math.PI * 0.9, walk: 0.5, beckon: 0, point: 0, opacity: 0.13, solid: 0, flow: 0.5 };
    },
    triggers: { tower: () => { growTarget = 1; towers.forEach((t) => (t.userData.grow += 0.25)); } },
  };
}

/* ---------------------------------------------------------------- Scene 13: dismantling */
export function sceneDismantle(ctx) {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight('#9fb0d8', '#1a1218', 0.9));
  const key = new THREE.DirectionalLight('#fff', 1.8); key.position.set(5, 10, 5); group.add(key);
  const spinner = new THREE.Group(); group.add(spinner);
  const r = rng(13);
  const bits = [];
  const mats = [marbleMat(), new THREE.MeshPhysicalMaterial({ color: '#0f1218', metalness: 0.9, roughness: 0.15, clearcoat: 1 }), new THREE.MeshStandardMaterial({ color: '#c9a44c', metalness: 0.8, roughness: 0.3 }), assets.pbr('oak_wood_planks', { repeat: [1, 1], color: '#6b4a2c' })];
  const register = (m, a, rad, y) => { m.userData.a = a; m.userData.rad = rad; m.userData.y = y; m.userData.spin = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5); m.userData.s = 1; spinner.add(m); bits.push(m); };
  for (let i = 0; i < 70; i++) {
    const kind = i % 4;
    const geo = kind === 0 ? new THREE.CylinderGeometry(0.4, 0.42, 0.9, 32) : kind === 1 ? new THREE.BoxGeometry(1.2, 2 + r() * 2, 1.2) : kind === 2 ? new THREE.TorusGeometry(0.5, 0.08, 8, 20) : new THREE.BoxGeometry(1.4, 0.1, 0.9);
    const m = new THREE.Mesh(geo, mats[kind]); m.castShadow = true;
    register(m, r() * Math.PI * 2, 1 + r() * 4, (r() - 0.5) * 6);
  }
  // real furniture and artefacts of the old order whirl away too
  const whirl = (loader, height) => place(spinner, loader, { height, onReady: (h) => register(h, r() * Math.PI * 2, 1.5 + r() * 3.5, (r() - 0.5) * 6) });
  whirl(assets.model('WoodenChair_01'), 1.2); whirl(assets.model('GreenChair_01'), 1.3); whirl(assets.model('marble_bust_01'), 1.2); whirl(assets.scan('washington_bust.glb'), 1.4);
  whirl(assets.model('brass_candleholders'), 0.8); whirl(assets.model('book_encyclopedia_set_01'), 0.6); whirl(assets.model('fancy_picture_frame_01'), 1.2); whirl(assets.model('hanging_picture_frame_03'), 1.1);
  whirl(assets.model('Lantern_01'), 0.8); whirl(assets.model('WoodenTable_01'), 1.4); whirl(assets.model('seadogs_compass'), 0.5); whirl(assets.model('vintage_oil_lamp'), 0.9);
  const dust = particles(900, [16, 12, 16], '#c9b9a0', 0.06, 131, ctx.glowTex); group.add(dust);
  let spinSpeed = 0;
  return {
    name: 'So we shall rewrite', theme: 'dark', bg: '#0e0c14', fog: ['#0e0c14', 10, 50], group, transitionIn: 'spin',
    env: { id: 'studio_small_09', background: false, intensity: 0.9 },
    grade: { saturation: 0.9, contrast: 1.1, warmth: 0, vignette: 1.6 },
    camera(local, cam, target) {
      cam.position.set(0, 1 + local * 2, lerp(14, 9, local));
      target.set(0, 0, 0);
      cam.fov = lerp(60, 80, local);
    },
    update(local, time, dt) {
      spinSpeed = lerp(spinSpeed, 0.4 + local * 3.5, dt);
      spinner.rotation.y += dt * spinSpeed;
      const spread = 1 + local * 5;
      for (const b of bits) {
        const ang = b.userData.a + time * 0.2;
        b.position.set(Math.cos(ang) * b.userData.rad * spread, b.userData.y * (1 + local * 2), Math.sin(ang) * b.userData.rad * spread);
        b.rotation.x += b.userData.spin.x * dt * (1 + local * 6); b.rotation.y += b.userData.spin.y * dt * (1 + local * 6); b.rotation.z += b.userData.spin.z * dt * 3;
        b.scale.setScalar(Math.max(0.01, (1 - local * 0.5)));
      }
      dust.rotation.y = -time * 0.3; dust.scale.setScalar(spread * 0.6);
    },
    woman(local) {
      return { x: 0, y: -1.2, z: 3, scale: 1.2, facing: Math.PI, walk: 0, beckon: 0, point: 0, opacity: 0.2, solid: 0, flow: 2.2 };
    },
    triggers: {},
  };
}

/* ---------------------------------------------------------------- Scene 14: replacements */
export function sceneReplace(ctx) {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight('#aab6d8', '#241a1a', 0.7));
  const key = new THREE.SpotLight('#fff6e8', 600, 60, 0.6, 0.5, 1.4); key.position.set(4, 12, 8); key.castShadow = true; key.shadow.mapSize.set(2048, 2048); key.shadow.bias = -0.0004; key.target.position.set(0, 1, 0); group.add(key, key.target);
  const rim = new THREE.DirectionalLight('#6fb7ff', 1.4); rim.position.set(-6, 6, -8); group.add(rim);
  const fill = new THREE.PointLight('#ffe8c8', 40, 18, 2); fill.position.set(0, 4, 6); group.add(fill);
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(4, 4.6, 0.6, 64), assets.pbr('marble_01', { repeat: [4, 1], color: '#5a5660' })); plinth.position.y = 0.3; plinth.receiveShadow = plinth.castShadow = true; group.add(plinth);
  const floor = new THREE.Mesh(new THREE.CircleGeometry(60, 48), assets.pbr('floor_tiles_06', { repeat: [30, 30], color: '#3a383f' })); floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);

  // Each pair: [old artefact, new artefact]. Builders return a Group whose contents may arrive async.
  const lazy = (loader, height, rot = [0, 0, 0]) => () => { const g = new THREE.Group(); place(g, loader, { height, rotation: rot }); return g; };
  const camelliaPortrait = () => {
    const g = new THREE.Group();
    const f = framedImage('sheppard.jpg', 2.0, { frameColor: '#e8e2d6', glow: 0.35 }); f.position.y = 2.0; g.add(f);
    const flower = new THREE.Group();
    for (let i = 0; i < 8; i++) { const petal = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 8), new THREE.MeshStandardMaterial({ color: '#ffffff', roughness: 0.6 })); const a = (i / 8) * Math.PI * 2; petal.position.set(Math.cos(a) * 0.12, 0, Math.sin(a) * 0.12); petal.scale.set(1, 0.5, 1.4); petal.rotation.y = -a; flower.add(petal); }
    const center = new THREE.Mesh(new THREE.SphereGeometry(0.07, 8, 8), new THREE.MeshStandardMaterial({ color: '#f1c232' })); flower.add(center);
    flower.position.set(0.9, 0.9, 0.3); flower.rotation.x = -Math.PI / 3; g.add(flower);
    return g;
  };
  const portrait = (file, frameColor = '#c9a44c', width = 2.4, glow = 0.15) => () => {
    const g = new THREE.Group();
    const f = framedImage(file, width, { frameColor, depth: 0.12, glow });
    f.position.y = 2.15; g.add(f);
    return g;
  };
  const monolith = () => { const m = new THREE.Mesh(new THREE.BoxGeometry(1.4, 4, 0.6), new THREE.MeshPhysicalMaterial({ color: '#06060a', roughness: 0.15, metalness: 0.9, clearcoat: 1 })); m.position.y = 2; m.castShadow = true; return m; };
  const circle = () => {
    const g = new THREE.Group();
    const ringM = new THREE.Mesh(new THREE.TorusGeometry(2.4, 0.08, 10, 64), new THREE.MeshStandardMaterial({ color: '#ffd27a', emissive: '#ffd27a', emissiveIntensity: 1.2 })); ringM.rotation.x = Math.PI / 2; ringM.position.y = 0.5; g.add(ringM);
    for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2; place(g, assets.model('WoodenChair_01'), { height: 1.0, position: [Math.cos(a) * 2.4, 0.5, Math.sin(a) * 2.4], rotation: [0, -a - Math.PI / 2, 0] }); }
    return g;
  };
  // Each pair: the original artefact holds alone, then is struck for its replacement.
  const pairs = [
    [portrait('klenze_athens.jpg', '#c9a44c', 3.1), portrait('wampum.jpg', '#4a2d16', 2.8)],
    [portrait('assembly_room.jpg', '#c9a44c', 3.1), portrait('lambton_quay_1880.jpg', '#4a3a2a', 3.0)],
    [portrait('declaration_independence.jpg', '#8a6a3a', 2.35, 0), portrait('declaration_sentiments.jpg', '#c9a44c', 2.2, 0)],
    [lazy(assets.model('marble_bust_01'), 3.1), camelliaPortrait],
    [portrait('jefferson.jpg', '#c9a44c', 2.4), portrait('anthony.jpg', '#c9a44c', 2.4)],
    [lazy(assets.scan('washington_bust.glb'), 3.2), portrait('edith_wilson.jpg', '#e8e2d6', 2.4)],
    [monolith, circle],
  ];
  const olds = [], news = [];
  pairs.forEach(([o, n]) => {
    const a = o(), b = n();
    a.position.y += 0.6; b.position.y += 0.6; a.visible = b.visible = false;
    a.userData.s = a.scale.x; b.userData.s = b.scale.x; a.scale.setScalar(0.0001); b.scale.setScalar(0.0001);
    group.add(a, b); olds.push(a); news.push(b);
  });
  const sparks = particles(600, [8, 6, 8], '#ffd27a', 0.1, 14, ctx.glowTex); sparks.material.opacity = 0; sparks.position.y = 2; group.add(sparks);

  // Per step (seconds): the original grows in and holds alone, then is struck away as its replacement arrives.
  // Keep SWAP in sync with the strike timing of `.rep` rows in text.js.
  const GROW = 0.55, SWAP = 2.0, OUT = 0.55;
  const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
  let step = -1, stepT = 0, spark = 0, sparked = false, camA = 0;
  const api = {
    name: 'The rewrite', theme: 'dark', bg: '#0b0a10', fog: ['#0b0a10', 12, 50], group, transitionIn: 'cut',
    env: { id: 'studio_small_09', background: false, intensity: 0.7 },
    grade: { saturation: 1.0, contrast: 1.1, warmth: 0.05, vignette: 1.6 },
    camera(local, cam, target) {
      camA = local * 0.8 - 0.4;
      // pan sideways so the plinth sits in the right half, clear of the list on the left
      const px = -Math.cos(camA) * 2.2, pz = Math.sin(camA) * 2.2;
      cam.position.set(Math.sin(camA) * 9.5 + px, 3.2, Math.cos(camA) * 9.5 + pz);
      target.set(px * 0.35, 2.3, pz * 0.35);
      cam.fov = 44;
    },
    update(local, time, dt) {
      const idx = Math.min(6, Math.floor(remap(local, 0.04, 0.94) * 7));
      if (idx !== step) api.setStep(idx);
      stepT += Math.min(dt, 0.05); api._step = step; api._stepT = stepT;
      if (!sparked && stepT >= SWAP) { sparked = true; spark = 1; }
      const sway = Math.sin(time * 0.6) * 0.18;
      olds.forEach((o, i) => {
        const on = i === step;
        const out = clamp((stepT - SWAP) / OUT);
        const s = on ? easeOut(stepT / GROW) * (1 - out) * o.userData.s : 0;
        o.visible = on && out < 1; o.scale.setScalar(Math.max(0.0001, s));
        o.rotation.y = camA + sway + out * 4; o.position.y = 0.6 + out * out * 3;
      });
      news.forEach((n, i) => {
        const on = i === step;
        const t = clamp((stepT - SWAP - 0.1) / 0.6);
        const e = on ? easeOut(t) : 0;
        const s = e * n.userData.s * (1 + Math.sin(t * Math.PI) * 0.1);
        n.visible = on && e > 0; n.scale.setScalar(Math.max(0.0001, s));
        n.rotation.y = camA + (1 - e) * -1.5 + sway;
      });
      spark = Math.max(0, spark - dt);
      sparks.material.opacity = spark; sparks.scale.setScalar(1 + (1 - spark) * 2); sparks.rotation.y = time;
      key.intensity = 600 + spark * 1800;
      key.color.set(step === 6 ? '#ffd27a' : '#fff6e8');
    },
    setStep(i) { step = i; stepT = 0; sparked = false; api._step = i; api._stepT = 0; },
    woman(local) {
      const a = local * 0.8 - 0.4;
      return { x: Math.sin(a + 0.9) * 5.5, y: 0, z: Math.cos(a + 0.9) * 5.5, scale: 1, facing: a + 0.9 + Math.PI, walk: 0.6, beckon: 0, point: 1, opacity: 0.2, solid: 0, flow: 1.4 };
    },
    triggers: {},
  };
  return api;
}
