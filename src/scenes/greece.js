import * as THREE from 'three';
import { makeColumn, makeBeam, marbleMat, makeOliveTree, photoPlate, groundPatch } from '../props.js';
import { assets, place } from '../assets.js';
import { lerp, clamp, remap, rng, smooth } from '../utils.js';

/** Height of the hilltop terrain at horizontal distance d from the summit (summit = 0). */
export const hillY = (d) => -3.5 * (1 - Math.exp(-(d * d) / 2200));

function hill(size = 240) {
  const geo = new THREE.PlaneGeometry(size, size, 120, 120);
  const pos = geo.attributes.position;
  const r = rng(5);
  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i), y = pos.getY(i), d = Math.hypot(x, y);
    pos.setZ(i, hillY(d) + Math.sin(x * 0.31) * Math.cos(y * 0.27) * 0.18 * Math.min(1, d / 10) + (r() - 0.5) * 0.04);
  }
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, assets.pbr('rocky_terrain_02', { repeat: [14, 14], color: '#d8c9a8' }));
  m.rotation.x = -Math.PI / 2; m.position.y = -0.05; m.receiveShadow = true;
  return m;
}

function sun(group, { color = '#ffe3b4', intensity = 3, position = [14, 18, 10], size = 28 } = {}) {
  const s = new THREE.DirectionalLight(color, intensity);
  s.position.set(...position); s.castShadow = true;
  s.shadow.mapSize.set(2048, 2048);
  s.shadow.camera.left = -size; s.shadow.camera.right = size; s.shadow.camera.top = size; s.shadow.camera.bottom = -size;
  s.shadow.camera.far = 120; s.shadow.bias = -0.0004; s.shadow.normalBias = 0.02;
  group.add(s);
  return s;
}

function scatterBoulders(group, count, seed, radiusMin, radiusMax, yAt = () => 0) {
  const r = rng(seed);
  for (let i = 0; i < count; i++) {
    const a = r() * Math.PI * 2, d = radiusMin + r() * (radiusMax - radiusMin);
    const x = Math.cos(a) * d, z = Math.sin(a) * d;
    place(group, assets.model('boulder_01'), { height: 0.5 + r() * 1.3, position: [x, yAt(x, z) - 0.15, z], rotation: [0, r() * Math.PI * 2, 0] });
  }
}

/* ---------------------------------------------------------------- Scene 1 */
export function scenePnyx(ctx) {
  const group = new THREE.Group();
  group.add(hill());
  const sunLight = sun(group, { position: [18, 22, 14], intensity: 3.2 });

  // Real view from the Orator's Bema (Acropolis + Lycabettus) as a far cyclorama, blended with fog
  const plate = photoPlate('pnyx_view.jpg', 210, { curve: 0.45, fadeX: 0.32, fadeTop: 0.55, fadeBottom: 0.12 });
  plate.position.set(-8, 22, -100); group.add(plate);

  // Rock-cut bema: three stepped blocks of weathered limestone
  const rock = assets.pbr('large_sandstone_blocks_01', { repeat: [3, 1], color: '#cdbfa5' });
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(9 - i * 2, 0.5, 5 - i), rock);
    step.position.set(0, 0.25 + i * 0.5, -3); step.receiveShadow = step.castShadow = true; group.add(step);
  }

  // Semicircle of Doric columns with entablature
  const cols = [];
  const R = 11, n = 9;
  for (let i = 0; i < n; i++) {
    const a = Math.PI * 0.15 + (i / (n - 1)) * Math.PI * 0.7;
    const c = makeColumn({ height: 6.5, radius: 0.46, drums: 7, seed: i + 1 });
    c.position.set(Math.cos(a) * R, hillY(R) + 0.1, -Math.sin(a) * R - 2);
    c.rotation.y = -a;
    group.add(c); cols.push(c);
  }
  for (let i = 0; i < n - 1; i++) {
    const a0 = Math.PI * 0.15 + (i / (n - 1)) * Math.PI * 0.7, a1 = Math.PI * 0.15 + ((i + 1) / (n - 1)) * Math.PI * 0.7;
    const p0 = new THREE.Vector3(Math.cos(a0) * R, 0, -Math.sin(a0) * R - 2), p1 = new THREE.Vector3(Math.cos(a1) * R, 0, -Math.sin(a1) * R - 2);
    const beam = makeBeam(p0.distanceTo(p1) + 0.9, cols[0].userData.height + hillY(R) + 0.1);
    beam.position.add(p0.clone().add(p1).multiplyScalar(0.5)); beam.lookAt(p1.x, beam.position.y, p1.z); beam.rotateY(Math.PI / 2);
    group.add(beam);
  }
  // Olive grove + boulders
  const r = rng(21);
  for (let i = 0; i < 18; i++) {
    let tx, tz, tries = 0;
    do { const a = r() * Math.PI * 2, d = 16 + r() * 26; tx = Math.cos(a) * d; tz = Math.sin(a) * d - 4; tries++; }
    while (tries < 20 && tz > 2 && Math.abs(tx) < 12); // keep the camera's approach clear
    const t = makeOliveTree(30 + i, 0.9 + r() * 0.9);
    t.position.set(tx, hillY(Math.hypot(tx, tz)) - 0.2, tz); t.rotation.y = r() * Math.PI * 2; group.add(t);
  }
  scatterBoulders(group, 14, 8, 6, 30, (x, z) => hillY(Math.hypot(x, z)));
  // a toppled marble bust at the foot of the bema
  place(group, assets.model('marble_bust_01'), { height: 0.9, position: [3.6, 0, 0.2], rotation: [0, -0.8, 0] });

  let sunPulse = 0, camNudge = 0;
  return {
    name: 'Pnyx Hill, 507 BCE', theme: 'light', bg: '#dfe7f0', fog: ['#e9e2d2', 50, 170], group, transitionIn: 'fade',
    env: { id: 'kloofendal_48d_partly_cloudy_puresky', background: true, intensity: 1.1, bgIntensity: 1.0, rotation: 1.2 },
    grade: { saturation: 1.05, contrast: 1.03, warmth: 0.08, bloom: 0.4 },
    camera(local, cam, target) {
      const t = smooth(local);
      cam.position.set(lerp(-7, 2, t), lerp(3.4, 2.0, t), lerp(23, 11, t) + Math.sin(ctx.time * 0.2) * 0.3);
      target.set(0, lerp(3.6, 2.2, t), -3);
      cam.fov = lerp(42, 36, t) + camNudge;
    },
    update(local, time, dt) {
      sunPulse = lerp(sunPulse, 0, dt * 2); camNudge = lerp(camNudge, 0, dt * 3);
      sunLight.intensity = 3.2 + sunPulse * 2;
    },
    woman(local) {
      return { x: 0, y: 1.5, z: -2.6, facing: 0.2, walk: 0, beckon: 1, point: 0, opacity: 0.1 + local * 0.05, solid: 0, flow: 1 };
    },
    triggers: { sun: () => { sunPulse = 1; }, pnyx: () => { camNudge = -6; } },
  };
}

/* ---------------------------------------------------------------- Scene 2 */
export function sceneRuins(ctx) {
  const group = new THREE.Group();
  // Frederic Church, The Parthenon (1871): the real ruin on the hill beyond the fallen drums
  const plate = photoPlate('church_parthenon.jpg', 200, { curve: 0.18, fadeX: 0.14, fadeTop: 0.12, fadeBottom: 0 });
  plate.position.set(4, 0, -120); plate.material.depthWrite = false;
  const sit = () => { if (plate.scale.y > 1) plate.position.y = plate.scale.y / 2 - 50; else requestAnimationFrame(sit); };
  sit(); group.add(plate);
  group.add(groundPatch('rocky_terrain_02', { width: 200, depth: 70, z: -12, repeat: [30, 10], fade: 0.5, light: [2.1, 1.65, 1.0] }));
  sun(group, { color: '#ffc287', intensity: 2.6, position: [-30, 9, 16], size: 34 });
  const r = rng(3);
  const glowMat = marbleMat().clone(); glowMat.emissive = new THREE.Color('#000'); glowMat.emissiveIntensity = 0;
  const columns = [];
  for (let i = 0; i < 16; i++) {
    const c = makeColumn({ height: 5 + r() * 3, radius: 0.42, drums: 6, broken: r() < 0.65 ? 1 : 0, seed: 40 + i, mat: glowMat });
    c.position.set(-18 + i * 2.4 + (r() - 0.5), 0, -4 - (r() * 6));
    group.add(c); columns.push(c);
  }
  // fallen drums & capitals scattered in the grass
  for (let i = 0; i < 18; i++) {
    const d = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.4, 0.8, 32), glowMat);
    d.rotation.set(Math.PI / 2 + (r() - 0.5) * 0.4, r() * Math.PI, 0);
    d.position.set(-18 + r() * 38, 0.3, 2 + r() * 5); d.castShadow = d.receiveShadow = true; group.add(d);
  }
  const slab = new THREE.Mesh(new THREE.BoxGeometry(6, 0.5, 1.6), glowMat); slab.position.set(4, 0.25, 4); slab.rotation.y = 0.5; slab.rotation.z = 0.08; slab.castShadow = true; group.add(slab);
  scatterBoulders(group, 10, 12, 8, 22);
  // a toppled bust and a weathered gothic statue among the ruins
  place(group, assets.model('marble_bust_01'), { height: 1.1, position: [-6, 0, 3.2], rotation: [0.9, 0.6, 0.4], onReady: (h) => { h.position.y = 0.45; } });
  place(group, assets.model('gothic_statue'), { height: 2.6, position: [9, 0, -6], rotation: [0, -0.4, 0] });
  for (let i = 0; i < 8; i++) { const t = makeOliveTree(60 + i, 0.8 + r() * 0.7); t.position.set(-30 + r() * 60, -0.1, -16 - r() * 14); group.add(t); }

  const glowColor = new THREE.Color('#000'); let glowAmt = 0;
  return {
    name: 'Marble ruins', theme: 'light', bg: '#e7cfae', fog: ['#e8d7bd', 70, 240], group, transitionIn: 'fade',
    env: { id: 'kloppenheim_06_puresky', background: true, intensity: 0.8, bgIntensity: 0.85, rotation: -0.6 },
    grade: { saturation: 1.1, contrast: 1.05, warmth: 0.18, bloom: 0.4 },
    camera(local, cam, target) {
      const x = lerp(-14, 14, local);
      cam.position.set(x, 2.4 + Math.sin(local * 6) * 0.2, 12);
      target.set(x * 0.6, 2.8, -4);
      cam.fov = 40;
    },
    update(local, time, dt) {
      glowAmt = lerp(glowAmt, 0, dt * 1.2);
      glowMat.emissive.copy(glowColor); glowMat.emissiveIntensity = glowAmt * 0.6;
    },
    woman(local) {
      const x = lerp(-10, 16, local);
      return { x, y: 0, z: 3, facing: Math.PI / 2, walk: 1, beckon: 0, point: 0, opacity: 0.13, solid: 0, flow: 1.3 };
    },
    triggers: {
      demos: () => { glowColor.set('#d9a63a'); glowAmt = 1; },
      kratos: () => { glowColor.set('#c0392b'); glowAmt = 1; },
    },
  };
}

/* ---------------------------------------------------------------- Scene 3 */
export function sceneFracture(ctx) {
  const group = new THREE.Group();
  // agora pavement: large marble slabs, then the earth beyond
  const ground = new THREE.Mesh(new THREE.CircleGeometry(22, 64), assets.pbr('marble_01', { repeat: [10, 10], color: '#cfc6b6' }));
  ground.rotation.x = -Math.PI / 2; ground.receiveShadow = true; group.add(ground);
  const earth = groundPatch('rocky_terrain_02', { width: 220, depth: 100, z: -10, repeat: [26, 12], fade: 0.55, light: [2.3, 1.85, 1.15] });
  earth.position.y = -0.03; group.add(earth);
  // Leo von Klenze, The Acropolis at Athens (1846): the city whose democracy is about to split
  const plate = photoPlate('klenze_athens.jpg', 300, { curve: 0.25, fadeX: 0.1, fadeTop: 0.1, fadeBottom: 0 });
  plate.position.set(0, 0, -110); plate.material.depthWrite = false;
  const sit = () => { if (plate.scale.y > 1) plate.position.y = plate.scale.y / 2 - 108; else requestAnimationFrame(sit); };
  sit(); group.add(plate);
  const rr = rng(78);
  for (let i = 0; i < 10; i++) { const t = makeOliveTree(120 + i, 0.9 + rr() * 0.8); const a = rr() * Math.PI * 2, d = 24 + rr() * 16; t.position.set(Math.cos(a) * d, -0.1, Math.sin(a) * d); group.add(t); }
  sun(group, { color: '#ffd1a0', intensity: 2.4, position: [-22, 14, 18], size: 30 });
  const columns = [];
  const n = 12, R = 8;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const c = makeColumn({ height: 7, radius: 0.5, drums: 8, seed: 90 + i });
    c.position.set(Math.cos(a) * R, 0, Math.sin(a) * R); group.add(c); columns.push(c);
  }
  // Hiram Powers' Greek Slave (Smithsonian CC0 scan): the chained woman at the centre of the "democracy"
  const plinth = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.3, 0.8, 40), marbleMat()); plinth.position.y = 0.4; plinth.castShadow = plinth.receiveShadow = true; group.add(plinth);
  place(group, assets.scan('greek_slave.glb'), { height: 2.4, position: [0, 0.8, 0], rotation: [0, Math.PI * 0.1, 0] });

  const crackMat = new THREE.MeshBasicMaterial({ color: '#15110d', transparent: true, opacity: 0 });
  const cracks = [];
  const r = rng(77);
  for (let i = 0; i < 28; i++) {
    const a = r() * Math.PI * 2, len = 6 + r() * 16;
    const m = new THREE.Mesh(new THREE.PlaneGeometry(len, 0.06 + r() * 0.12), crackMat);
    m.rotation.x = -Math.PI / 2; m.rotation.z = a; m.position.set(Math.cos(a) * len / 2, 0.015, Math.sin(a) * len / 2);
    group.add(m); cracks.push(m);
  }
  const dust = new THREE.Points(new THREE.BufferGeometry(), new THREE.PointsMaterial({ color: '#e8dcc4', size: 0.14, transparent: true, opacity: 0, depthWrite: false, map: ctx.glowTex, blending: THREE.AdditiveBlending }));
  const dpos = new Float32Array(700 * 3); for (let i = 0; i < 700; i++) { dpos[i * 3] = (r() - 0.5) * 30; dpos[i * 3 + 1] = r() * 10; dpos[i * 3 + 2] = (r() - 0.5) * 30; }
  dust.geometry.setAttribute('position', new THREE.BufferAttribute(dpos, 3)); group.add(dust);

  let fracture = 0, fractureTarget = 0, red = 0, redTarget = 0;
  const tint = new THREE.Color('#e3cdb0');
  const api = {
    name: 'The fracture', theme: 'light', bg: '#e3cdb0', bgDyn: tint, fog: ['#e3cdb0', 60, 280], group, transitionIn: 'cut',
    env: { id: 'kloppenheim_06_puresky', background: true, intensity: 0.8, bgIntensity: 0.85, rotation: 2.2 },
    grade: { saturation: 1.0, contrast: 1.08, warmth: 0.1, bloom: 0.4 },
    camera(local, cam, target) {
      const z = smooth(clamp(local / 0.35));
      cam.position.set(lerp(0.9, 0, z), lerp(2.0, 9, z) + local * 2, lerp(4.2, 24, z));
      target.set(0, lerp(2.2, 3, z), 0);
      cam.fov = lerp(30, 58, z);
    },
    update(local, time, dt) {
      fractureTarget = Math.max(fractureTarget, remap(local, 0.25, 0.9));
      fracture = lerp(fracture, fractureTarget, dt * 1.5);
      red = lerp(red, redTarget, dt * 1.5);
      for (const c of columns) {
        const drums = c.userData.drums;
        drums.forEach((d, i) => {
          const f = fracture * (i / drums.length);
          d.position.copy(d.userData.rest).addScaledVector(d.userData.dir, f * 2.5);
          d.position.y = d.userData.rest.y + f * 3 * d.userData.dir.y;
          d.rotation.set(d.userData.restRot.x + f * d.userData.spin, d.userData.restRot.y, d.userData.restRot.z + f * d.userData.spin * 0.7);
        });
      }
      crackMat.opacity = fracture * 0.9;
      dust.material.opacity = fracture * 0.7;
      dust.rotation.y = time * 0.05;
      tint.set('#e3cdb0').lerp(new THREE.Color('#8a4a3e'), red * 0.6);
      api.grade.saturation = 1 - red * 0.55; api.grade.warmth = 0.1 + red * 0.7; api.grade.contrast = 1.08 + red * 0.2; api.grade.vignette = 1 + red * 0.9;
      api.env.bgIntensity = 0.85 - red * 0.55; api.env.intensity = 0.8 - red * 0.4;
    },
    woman(local) {
      return { x: 2.2, y: 0, z: 3.5, facing: -0.3, walk: 0, beckon: 0, point: 1, opacity: 0.14, solid: 0, flow: 1.4 };
    },
    triggers: {
      half: () => { fractureTarget = Math.max(fractureTarget, 0.6); },
      patriarchy: () => { fractureTarget = 1; redTarget = 1; },
    },
  };
  return api;
}
