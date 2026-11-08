import * as THREE from 'three';
import { lerp, clamp, remap, rng, smooth, particles } from '../utils.js';
import { makeBaizeTable, makeQuill, photoPlate, framedImage } from '../props.js';
import { assets, place } from '../assets.js';

/* ---------------------------------------------------------------- Scene 6: Assembly Room, Independence Hall */
export function sceneHall(ctx) {
  const group = new THREE.Group();
  const W = 14, D = 18, H = 6.5;
  const wall = assets.pbr('plastered_wall_02', { repeat: [4, 2], color: '#b4bdb0' }); // the grey-green of the real room
  const trimMat = new THREE.MeshStandardMaterial({ color: '#ebe7dc', roughness: 0.6 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(W, D), assets.pbr('old_wooden_floor_02', { repeat: [4, 5], color: '#b48b5e' }));
  floor.rotation.x = -Math.PI / 2; floor.receiveShadow = true; group.add(floor);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(W, D), trimMat); ceil.rotation.x = Math.PI / 2; ceil.position.y = H; group.add(ceil);

  // Back wall: the actual Assembly Room (photo plate) with the dais, Rising Sun chair and shell panel
  const backPlate = photoPlate('assembly_room.jpg', W + 0.4, { curve: 0, fade: false });
  backPlate.material.color.set('#cfcbc0'); // match the plate's exposure to the lit room
  backPlate.position.set(0, H / 2 - 0.1, -D / 2 + 0.05); group.add(backPlate);
  const frontWall = new THREE.Mesh(new THREE.PlaneGeometry(W, H), wall); frontWall.position.set(0, H / 2, D / 2); frontWall.rotation.y = Math.PI; group.add(frontWall);
  const shafts = [];
  for (const s of [-1, 1]) {
    const side = new THREE.Mesh(new THREE.PlaneGeometry(D, H), wall); side.position.set(s * W / 2, H / 2, 0); side.rotation.y = -s * Math.PI / 2; group.add(side);
    const wains = new THREE.Mesh(new THREE.BoxGeometry(0.12, 1.25, D), trimMat); wains.position.set(s * (W / 2 - 0.06), 0.62, 0); group.add(wains);
    const cornice = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.35, D), trimMat); cornice.position.set(s * (W / 2 - 0.15), H - 0.17, 0); group.add(cornice);
    for (let i = 0; i < 4; i++) {
      const z = -D / 2 + 2.5 + i * 4.3;
      // tall sash windows: glowing panes with 12-light muntins
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.7, 3.7), new THREE.MeshStandardMaterial({ color: '#fff6e2', emissive: '#ffe9c4', emissiveIntensity: 0.9 }));
      win.position.set(s * (W / 2 - 0.06), 3.2, z); win.rotation.y = -s * Math.PI / 2; group.add(win);
      const frame = new THREE.Mesh(new THREE.BoxGeometry(0.1, 4.0, 2.0), trimMat); frame.position.set(s * (W / 2 - 0.02), 3.2, z); group.add(frame);
      for (let m = -1; m <= 1; m++) { const mull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.7, 0.05), trimMat); mull.position.set(s * (W / 2 - 0.08), 3.2, z + m * 0.56); group.add(mull); }
      for (let m = -2; m <= 2; m++) { const mull = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.05, 1.7), trimMat); mull.position.set(s * (W / 2 - 0.08), 3.2 + m * 0.74, z); group.add(mull); }
      const shaft = new THREE.SpotLight('#fff0cf', 22, 20, 0.55, 0.7, 1.1); shaft.position.set(s * (W / 2 - 0.2), 3.6, z); shaft.target.position.set(s * 0.5, 0, z + 1);
      if (i === 1) { shaft.castShadow = true; shaft.shadow.mapSize.set(1024, 1024); shaft.shadow.bias = -0.0005; }
      group.add(shaft, shaft.target); shafts.push(shaft);
    }
  }
  // Dais in front of the photo so the real objects stand in the real room
  const dais = new THREE.Mesh(new THREE.BoxGeometry(5.2, 0.3, 2.4), assets.pbr('oak_wood_planks', { repeat: [3, 2], color: '#6f4a2a' })); dais.position.set(0, 0.15, -D / 2 + 1.5); dais.castShadow = dais.receiveShadow = true; group.add(dais);
  const speakerTable = makeBaizeTable(2.3, 0.95, 0.8); speakerTable.position.set(0, 0.3, -D / 2 + 1.9); group.add(speakerTable);
  place(group, assets.model('GreenChair_01'), { height: 1.4, position: [0, 0.3, -D / 2 + 1.1], rotation: [0, 0, 0] });
  place(group, assets.model('brass_candleholders'), { height: 0.5, position: [-0.7, 1.1, -D / 2 + 1.9], rotation: [0, 0.3, 0] });
  place(group, assets.model('book_encyclopedia_set_01'), { height: 0.26, position: [0.75, 1.1, -D / 2 + 1.95], rotation: [0, -0.3, 0] });
  // The desk on which the Declaration was drafted (Smithsonian scan), with the Declaration itself on it
  place(group, assets.scan('declaration_desk.glb'), { height: 0.28, position: [0.1, 1.1, -D / 2 + 1.85], rotation: [0, 0.15, 0] });

  // Semicircular rows of green-baize tables with real Windsor chairs, quills, papers
  const paperMat = new THREE.MeshStandardMaterial({ map: assets.image('declaration_independence.jpg'), color: '#b8ab90', roughness: 0.95 });
  const r = rng(1776);
  for (const [radius, count] of [[4, 7], [6.4, 9]]) {
    for (let i = 0; i < count; i++) {
      const a = Math.PI * 0.12 + (i / (count - 1)) * Math.PI * 0.76;
      const x = Math.cos(a) * radius, z = -D / 2 + 3.6 + Math.sin(a) * radius;
      const table = makeBaizeTable(1.6, 0.85, 0.78);
      const paper = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.55), paperMat); paper.rotation.x = -Math.PI / 2; paper.rotation.z = (r() - 0.5) * 0.6; paper.position.set(-0.3, 0.81, 0.05); table.add(paper);
      const quill = makeQuill(); quill.position.set(0.35, 0.8, 0.1); quill.rotation.z = -0.5; quill.rotation.x = 0.3; table.add(quill);
      table.position.set(x, 0, z); table.rotation.y = -a + Math.PI / 2; group.add(table);
      place(group, assets.model('WoodenChair_01'), { height: 1.05, position: [x + Math.cos(a) * 0.95, 0, z + Math.sin(a) * 0.95], rotation: [0, -a - Math.PI / 2 + (r() - 0.5) * 0.3, 0] });
      if (i % 3 === 0) place(table, assets.model('brass_candleholders'), { height: 0.36, position: [0.05, 0.8, -0.25] });
    }
  }
  // Real chandelier
  const chandLight = new THREE.PointLight('#ffd9a0', 40, 22, 2); chandLight.position.set(0, H - 2.2, -1); group.add(chandLight);
  let chand = null;
  place(group, assets.model('Chandelier_03'), { height: 2.0, position: [0, H - 2.6, -1], onReady: (h) => { chand = h; } });
  group.add(new THREE.AmbientLight('#aab8c8', 0.7), new THREE.HemisphereLight('#f4ecd8', '#5a4a3a', 0.9));
  const dust = particles(500, [12, 6, 16], '#fff2d8', 0.035, 6, ctx.glowTex); dust.position.y = 3; group.add(dust);

  let flicker = 0;
  return {
    name: 'Independence Hall, 1776', theme: 'light', bg: '#b9c2b2', fog: null, group, transitionIn: 'fade',
    env: { id: 'church_meeting_room', background: false, intensity: 0.7 },
    grade: { saturation: 1.0, contrast: 1.04, warmth: 0.12, bloom: 0.5 },
    camera(local, cam, target) {
      const t = smooth(local);
      cam.position.set(lerp(-3.4, 1.6, t), lerp(2.4, 1.7, t), lerp(7.5, -1.2, t));
      target.set(0, 1.6, -D / 2 + 1.5);
      cam.fov = lerp(50, 40, t);
    },
    update(local, time, dt) {
      flicker = lerp(flicker, 0, dt * 2);
      chandLight.intensity = 40 + Math.sin(time * 11) * 3 + flicker * 60;
      if (chand) chand.rotation.y = Math.sin(time * 0.3) * 0.02;
      dust.rotation.y = time * 0.015; dust.position.y = 3 + Math.sin(time * 0.2) * 0.2;
      for (const s of shafts) s.intensity = 22 + flicker * 30;
    },
    woman(local) {
      // standing beside the Speaker's chair, hands clasped — unacknowledged
      return { x: 1.9, y: 0.3, z: -D / 2 + 1.4, scale: 1, facing: 0.3, walk: 0, beckon: 0, point: 0, opacity: 0.12, solid: 0, flow: 0.7 };
    },
    triggers: { hall: () => { flicker = 1; }, allmen: () => { flicker = 2; } },
  };
}

/* ---------------------------------------------------------------- Scene 7: the Enlightenment — a floating study */
export function sceneInk(ctx) {
  const group = new THREE.Group();
  group.add(new THREE.HemisphereLight('#3a4a6a', '#0c0810', 0.8));
  const key = new THREE.PointLight('#ffd6a0', 70, 50, 2); key.position.set(3, 3, 5); key.castShadow = true; group.add(key);
  const r = rng(71);

  // Floating furniture of a philosopher's study: tables, lamps, books, portraits of Locke, Voltaire, Rousseau
  const floaters = [];
  const addFloater = (p, pos, rot = [0, 0, 0]) => place(group, p.loader, { height: p.height, position: pos, rotation: rot, onReady: (h) => { h.userData.base = h.position.clone(); h.userData.phase = r() * Math.PI * 2; h.userData.spin = (r() - 0.5) * 0.25; floaters.push(h); } });
  addFloater({ loader: assets.model('round_wooden_table_02'), height: 1.0 }, [-3, -1.5, -4], [0.2, 0.4, 0.1]);
  addFloater({ loader: assets.model('WoodenTable_01'), height: 1.0 }, [4, 1.5, -8], [-0.3, -0.6, 0.2]);
  addFloater({ loader: assets.model('ClassicConsole_01'), height: 1.1 }, [-6, 2.5, -10], [0.1, 1.2, -0.2]);
  addFloater({ loader: assets.model('vintage_oil_lamp'), height: 0.9 }, [1.5, 2.2, -3], [0, 0, 0.3]);
  addFloater({ loader: assets.model('vintage_oil_lamp'), height: 0.8 }, [-2, -2.5, -7], [0.3, 1, 0]);
  addFloater({ loader: assets.model('book_encyclopedia_set_01'), height: 0.5 }, [2.5, -1.8, -5], [0.5, 0.2, 0.4]);
  addFloater({ loader: assets.model('book_encyclopedia_set_01'), height: 0.55 }, [-4.5, 0.8, -3], [-0.4, 0.9, 0.2]);
  addFloater({ loader: assets.model('brass_candleholders'), height: 0.8 }, [5.5, -0.5, -4], [0.2, 0, -0.3]);
  addFloater({ loader: assets.model('seadogs_compass'), height: 0.35 }, [0, 3.2, -6], [1.2, 0, 0]);
  for (let i = 0; i < 4; i++) addFloater({ loader: assets.model('WoodenChair_01'), height: 1.1 }, [(r() - 0.5) * 14, (r() - 0.5) * 7, -4 - r() * 10], [r() * 2, r() * 6, r() * 2]);
  const portraits = [['locke.jpg', [-5.5, 3.2, -8]], ['voltaire.jpg', [5.2, 3.4, -11]], ['rousseau.jpg', [0.5, -3, -12]]];
  for (const [file, pos] of portraits) {
    const f = framedImage(file, 1.5); f.position.set(...pos); f.rotation.set((r() - 0.5) * 0.3, (r() - 0.5) * 0.8, (r() - 0.5) * 0.2);
    f.userData.base = f.position.clone(); f.userData.phase = r() * 6; f.userData.spin = (r() - 0.5) * 0.1; group.add(f); floaters.push(f);
  }
  // floating pages: pages of the Declaration drifting
  const pageMat = new THREE.MeshStandardMaterial({ map: assets.image('declaration_independence.jpg'), color: '#a89c88', side: THREE.DoubleSide, roughness: 0.9 });
  const pages = [];
  for (let i = 0; i < 18; i++) {
    const p = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 1.3, 4, 4), pageMat);
    p.position.set((r() - 0.5) * 18, (r() - 0.5) * 10, -3 - r() * 16); p.rotation.set(r() * 3, r() * 3, r() * 3);
    p.userData.spin = new THREE.Vector3(r() - 0.5, r() - 0.5, r() - 0.5).multiplyScalar(0.3); p.castShadow = true;
    group.add(p); pages.push(p);
  }
  // quills
  for (let i = 0; i < 6; i++) { const q = makeQuill(); q.scale.setScalar(1.8); q.position.set((r() - 0.5) * 12, (r() - 0.5) * 6, -2 - r() * 8); q.rotation.set(r() * 3, r() * 3, r() * 3); q.userData.base = q.position.clone(); q.userData.phase = r() * 6; q.userData.spin = 0.4; group.add(q); floaters.push(q); }
  // ink drops + splash
  const drops = particles(500, [22, 14, 18], '#2a3cff', 0.12, 22, ctx.glowTex); drops.position.z = -6; group.add(drops);
  const ring = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.26, 48), new THREE.MeshBasicMaterial({ color: '#4a5cff', transparent: true, opacity: 0, side: THREE.DoubleSide })); group.add(ring);
  let splash = 0;
  // Lemonnier, The Salon of Madame Geoffrin (1812): the room these men argued in, hosted by a woman
  const salon = photoPlate('lemonnier_salon.jpg', 84, { curve: 0.3, fadeX: 0.16, fadeTop: 0.14, fadeBottom: 0.14, tint: '#b8aa98' });
  salon.position.set(0, -1, -24); salon.material.depthWrite = false; group.add(salon);

  return {
    name: 'The Enlightenment', theme: 'dark', bg: '#0b0a14', fog: ['#0b0a14', 16, 70], group, transitionIn: 'fade',
    env: { id: 'old_room', background: false, intensity: 0.7, rotation: 0.8 },
    grade: { saturation: 0.95, contrast: 1.1, warmth: 0.05, vignette: 1.4 },
    camera(local, cam, target) {
      const a = local * 1.2 - 0.6;
      cam.position.set(Math.sin(a) * 9, 1 + local, Math.cos(a) * 9);
      target.set(0, 0, -5);
      cam.fov = 48;
    },
    update(local, time, dt) {
      for (const f of floaters) {
        f.position.y = f.userData.base.y + Math.sin(time * 0.6 + f.userData.phase) * 0.35;
        f.rotation.y += dt * f.userData.spin;
      }
      for (const p of pages) { p.rotation.x += p.userData.spin.x * dt; p.rotation.y += p.userData.spin.y * dt; p.position.y += Math.sin(time + p.position.x) * dt * 0.2; }
      drops.rotation.y = time * 0.04;
      splash = Math.max(0, splash - dt * 0.8);
      ring.material.opacity = splash; ring.scale.setScalar(1 + (1 - splash) * 12); ring.position.copy(ctx.camera.position).add(new THREE.Vector3(0, 0, -6).applyQuaternion(ctx.camera.quaternion)); ring.quaternion.copy(ctx.camera.quaternion);
    },
    woman(local) {
      return { x: -3 + local * 6, y: -1.2, z: -4, scale: 1.2, facing: Math.PI / 2, walk: 0.5, beckon: 0, point: 0, opacity: 0.15, solid: 0, flow: 1.4 };
    },
    triggers: { ink: () => { splash = 1; key.color.set('#4a5cff'); setTimeout(() => key.color.set('#ffd6a0'), 500); } },
  };
}

/* ---------------------------------------------------------------- Scene 8: the Y chromosome */
export function sceneChromosome(ctx) {
  const group = new THREE.Group();
  group.add(new THREE.AmbientLight('#203040', 0.8));
  const key = new THREE.PointLight('#7fe9ff', 80, 60, 2); key.position.set(0, 2, 6); group.add(key);

  // Y built from instanced glass-like cubes so it can shatter
  const r = rng(8);
  const pts = [];
  const seg = (a, b, n) => { for (let i = 0; i <= n; i++) pts.push(new THREE.Vector3().lerpVectors(a, b, i / n)); };
  const o = new THREE.Vector3(0, 0, 0);
  seg(o, new THREE.Vector3(0, -3.2, 0), 26);
  seg(o, new THREE.Vector3(-2.2, 2.8, 0), 24);
  seg(o, new THREE.Vector3(2.2, 2.8, 0), 24);
  const all = [];
  for (const p of pts) for (let k = 0; k < 5; k++) all.push(p.clone().add(new THREE.Vector3((r() - 0.5) * 0.5, (r() - 0.5) * 0.3, (r() - 0.5) * 0.5)));
  const count = all.length;
  const mat = new THREE.MeshStandardMaterial({ color: '#1a6ad4', emissive: '#2ec4ff', emissiveIntensity: 0.85, roughness: 0.28, metalness: 0.25 });
  const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(0.2, 0.2, 0.2), mat, count);
  const dummy = new THREE.Object3D();
  const vel = [];
  all.forEach((p, i) => {
    dummy.position.copy(p); dummy.rotation.set(r() * 3, r() * 3, r() * 3); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
    vel.push(new THREE.Vector3(p.x + (r() - 0.5) * 2, p.y + (r() - 0.5) * 2, (r() - 0.5) * 6).normalize().multiplyScalar(2 + r() * 6));
  });
  group.add(inst);
  // The men behind the chromosome: four marble busts orbiting it (Washington ×2 as scan, Poly Haven bust ×2)
  const busts = [];
  const orbit = (loader, a, rad) => place(group, loader, { height: 1.8, position: [Math.cos(a) * rad, -0.9, Math.sin(a) * rad], onReady: (h) => { h.userData.a = a; h.userData.rad = rad; busts.push(h); } });
  orbit(assets.scan('washington_bust.glb'), 0.4, 8); orbit(assets.model('marble_bust_01'), Math.PI / 2 + 0.3, 8); orbit(assets.scan('waterston_bust.glb'), Math.PI + 0.2, 8); orbit(assets.model('marble_bust_01'), Math.PI * 1.5, 8);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: ctx.glowTex, color: '#49d5ff', transparent: true, opacity: 0.45, depthWrite: false, blending: THREE.AdditiveBlending }));
  halo.scale.set(7, 7, 1); group.add(halo);
  const stars = particles(2000, [80, 60, 80], '#9fd8ff', 0.07, 33, ctx.glowTex); group.add(stars);

  // sit the Y in the right half, clear of the paragraph on the left
  group.position.x = 3.2;

  let shatter = 0, kick = 0;
  return {
    name: 'Of the men, by the men', theme: 'dark', bg: '#050810', fog: null, group, transitionIn: 'fade',
    env: { id: 'studio_small_09', background: false, intensity: 0.8 },
    grade: { saturation: 1.05, contrast: 1.08, warmth: -0.12, bloom: 0.45 },
    camera(local, cam, target) {
      const t = smooth(clamp(local / 0.35));
      cam.position.set(3.2 + Math.sin(local * 1.4) * 0.6, 0.2, lerp(16, 10, t) + shatter * 3);
      target.set(3.2, 0.1, 0);
      cam.fov = lerp(42, 36, t);
    },
    update(local, time, dt) {
      // holds whole while the paragraph is read, then bursts on the way out (or on the trigger word)
      kick = Math.max(0, kick - dt * 1.2);
      const target = Math.max(kick, smooth(remap(local, 0.72, 0.96)));
      shatter = lerp(shatter, Math.min(1, target), Math.min(1, dt * 3.5));
      inst.rotation.y = time * 0.3 * (1 - shatter);
      all.forEach((p, i) => {
        dummy.position.copy(p).addScaledVector(vel[i], shatter * shatter * 3);
        dummy.rotation.set(time * (1 + i % 3) * shatter, time * 0.7, i);
        const s = 1 - shatter * 0.9;
        dummy.scale.setScalar(Math.max(0.01, s)); dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
      });
      inst.instanceMatrix.needsUpdate = true;
      mat.emissiveIntensity = 0.85 + Math.sin(time * 3) * 0.15 + shatter * 1.4;
      halo.material.opacity = 0.22 * (1 - shatter) + shatter * 0.5 * (1 - shatter);
      halo.scale.setScalar(8 + shatter * 18);
      stars.rotation.y = time * 0.02;
      for (const b of busts) {
        const a = b.userData.a + time * 0.12;
        const rad = b.userData.rad + shatter * 14;
        b.position.set(Math.cos(a) * rad, -0.9 + Math.sin(time * 0.5 + b.userData.a) * 0.2 - shatter * 6, Math.sin(a) * rad);
        b.rotation.y = -a + Math.PI / 2; b.rotation.x = shatter * 2;
      }
    },
    woman(local) {
      return { x: 0.6, y: -3.4, z: 2, scale: 1.3, facing: 0.6, walk: 0, beckon: 0, point: 0.8, opacity: 0.14, solid: 0, flow: 1.2 };
    },
    triggers: { shatter: () => { kick = 1; } },
  };
}
