import * as THREE from 'three';
import { lerp, clamp, remap, rng, smooth, particles } from '../utils.js';
import { makeLamp, photoPlate, framedImage, makeBuilding, makeQuill } from '../props.js';
import { assets, place } from '../assets.js';

/* ---------------------------------------------------------------- Scene 9: gallery of the first democratic thinkers */
export function sceneGallery(ctx) {
  const group = new THREE.Group();
  group.add(new THREE.AmbientLight('#2a2430', 0.6));
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 30), assets.pbr('old_wooden_floor_02', { repeat: [14, 7], color: '#5a4030' }));
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.01; floor.receiveShadow = true; group.add(floor);
  const wallMat = assets.pbr('red_plaster_weathered', { repeat: [10, 2], color: '#5a2a2c' });
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(60, 9), wallMat); wall.position.set(0, 4.5, -4.3); wall.receiveShadow = true; group.add(wall);
  const dado = new THREE.Mesh(new THREE.BoxGeometry(60, 1.1, 0.12), new THREE.MeshStandardMaterial({ color: '#2a1a12', roughness: 0.5 })); dado.position.set(0, 0.55, -4.25); group.add(dado);
  const rail = new THREE.Mesh(new THREE.BoxGeometry(60, 0.12, 0.16), new THREE.MeshStandardMaterial({ color: '#c9a44c', metalness: 0.8, roughness: 0.3 })); rail.position.set(0, 1.1, -4.22); group.add(rail);
  const cornice = new THREE.Mesh(new THREE.BoxGeometry(60, 0.5, 0.4), new THREE.MeshStandardMaterial({ color: '#e8e1d2', roughness: 0.7 })); cornice.position.set(0, 8.75, -4.1); group.add(cornice);

  // Real portraits: Christine de Pizan, Abigail Adams, Mary Wollstonecraft, Olympe de Gouges
  const people = [
    ['pizan.jpg', 'Christine de Pizan', '1364 – c.1430'],
    ['adams.jpg', 'Abigail Adams', '1744 – 1818'],
    ['wollstonecraft.jpg', 'Mary Wollstonecraft', '1759 – 1797'],
    ['gouges.jpg', 'Olympe de Gouges', '1748 – 1793'],
  ];
  const frames = [], spots = [];
  people.forEach(([file, name, years], i) => {
    const f = framedImage(file, 1.9, { frameColor: '#c9a44c', depth: 0.14 });
    f.position.set(-7.5 + i * 5, 3.0, -4.1); f.userData.base = f.position.clone(); f.userData.phase = i;
    group.add(f); frames.push(f);
    // brass nameplate
    const plate = new THREE.Mesh(new THREE.BoxGeometry(1.1, 0.16, 0.03), new THREE.MeshStandardMaterial({ color: '#c9a44c', metalness: 0.9, roughness: 0.3 })); plate.position.set(f.position.x, 1.55, -4.15); group.add(plate);
    const spot = new THREE.SpotLight('#ffe7c4', 0, 14, 0.42, 0.55, 1.4); spot.position.set(f.position.x, 7.8, 1.2); spot.target = f; spot.castShadow = i === 1; group.add(spot); spots.push(spot);
    // small furniture beneath each portrait
    if (i % 2 === 0) place(group, assets.model('ClassicConsole_01'), { height: 0.95, position: [f.position.x, 0, -3.6] });
    else place(group, assets.model('GreenChair_01'), { height: 1.1, position: [f.position.x, 0, -3.5], rotation: [0, (i - 1.5) * 0.2, 0] });
  });
  place(group, assets.model('marble_bust_01'), { height: 0.7, position: [-7.5, 0.95, -3.6] });
  place(group, assets.model('book_encyclopedia_set_01'), { height: 0.3, position: [2.5, 0.95, -3.6], rotation: [0, 0.3, 0] });
  const chandLight = new THREE.PointLight('#ffd9a0', 25, 24, 2); chandLight.position.set(0, 6.5, 0); group.add(chandLight);
  place(group, assets.model('Chandelier_03'), { height: 2.0, position: [0, 6.0, 0] });
  const dust = particles(600, [30, 10, 14], '#ffe7c4', 0.05, 91, ctx.glowTex); dust.position.y = 3; group.add(dust);
  const lit = [0, 0, 0, 0];

  return {
    name: 'The first democratic thinkers', theme: 'dark', bg: '#0d0a12', fog: ['#0d0a12', 14, 40], group, transitionIn: 'fade',
    env: { id: 'museum_of_ethnography', background: false, intensity: 0.6 },
    grade: { saturation: 1.0, contrast: 1.08, warmth: 0.15, vignette: 1.5 },
    camera(local, cam, target) {
      const x = lerp(-8, 8, local);
      cam.position.set(x, 2.4, 6.5);
      target.set(x, 2.8, -4);
      cam.fov = 44;
    },
    update(local, time, dt) {
      frames.forEach((f, i) => {
        f.position.y = f.userData.base.y + Math.sin(time * 0.7 + f.userData.phase) * 0.04;
        const reach = remap(local, i * 0.22 - 0.05, i * 0.22 + 0.15);
        lit[i] = lerp(lit[i], 0, dt * 0.6);
        spots[i].intensity = 30 * reach + lit[i] * 90;
      });
      dust.rotation.y = time * 0.02;
    },
    woman(local) {
      const x = lerp(-9, 9, local);
      return { x, y: 0, z: -1.5, scale: 1, facing: Math.PI / 2, walk: 1, beckon: 0, point: 1, opacity: 0.17, solid: 0, flow: 1.2 };
    },
    triggers: Object.fromEntries(people.map((_, i) => [`portrait-${i}`, () => { lit[i] = 1; }])),
  };
}

/* ---------------------------------------------------------------- Scene 10: Lambton Quay, Wellington, 1893 */
export function sceneQuay(ctx) {
  const group = new THREE.Group();
  const sun = new THREE.DirectionalLight('#ffc98a', 3.2); sun.position.set(-26, 9, -30); sun.castShadow = true; sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -40; sun.shadow.camera.right = 40; sun.shadow.camera.top = 40; sun.shadow.camera.bottom = -40; sun.shadow.camera.far = 120; sun.shadow.bias = -0.0005; group.add(sun);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(14, 160), assets.pbr('cobblestone_floor_08', { repeat: [4, 48], color: '#b9b0a0' }));
  road.rotation.x = -Math.PI / 2; road.receiveShadow = true; group.add(road);
  for (const x of [-1.2, -0.4, 0.4, 1.2]) { const rail = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.02, 160), new THREE.MeshStandardMaterial({ color: '#4a4440', metalness: 0.7, roughness: 0.55 })); rail.position.set(x, 0.011, 0); group.add(rail); }
  for (const side of [-1, 1]) { const path = new THREE.Mesh(new THREE.BoxGeometry(3, 0.2, 160), assets.pbr('concrete_pavement_02', { repeat: [1, 40], color: '#a9a399' })); path.position.set(side * 5.5, 0.1, 0); path.receiveShadow = true; group.add(path); }

  // Real 1880s Lambton Quay photograph as the end-of-street cyclorama
  const plate = photoPlate('lambton_quay_1880.jpg', 90, { curve: 0.45 });
  plate.position.set(0, 20, -78); group.add(plate);

  // Victorian shopfronts: PBR plaster/brick with timber verandahs on posts, parapets, sash windows
  const r = rng(1893);
  const plasters = [
    assets.pbr('plastered_wall_02', { repeat: [2, 2], color: '#d8c8a8' }),
    assets.pbr('red_plaster_weathered', { repeat: [2, 2], color: '#b8907a' }),
    assets.pbr('brick_wall_09', { repeat: [3, 2], color: '#a88a78' }),
    assets.pbr('plastered_wall_02', { repeat: [2, 2], color: '#9fae9c' }),
    assets.pbr('plastered_wall_02', { repeat: [2, 2], color: '#d9cbb5' }),
  ];
  const timber = new THREE.MeshStandardMaterial({ color: '#3b2d22', roughness: 0.8 });
  const white = new THREE.MeshStandardMaterial({ color: '#b3a994', roughness: 0.85 });
  const glass = new THREE.MeshPhysicalMaterial({ color: '#1c2430', roughness: 0.1, metalness: 0.6, reflectivity: 1 });
  const lamps = [];
  for (const side of [-1, 1]) {
    for (let i = 0; i < 11; i++) {
      const w = 6 + r() * 3, h = 7.5 + r() * 5, d = 8;
      const b = makeBuilding(d, h, w, plasters[(i * 2 + (side > 0 ? 1 : 0)) % plasters.length]);
      const z = 20 - i * 9.5 - r() * 2;
      b.position.set(side * (7 + d / 2), h / 2, z); group.add(b);
      const fx = side * 7.02; // facade plane x
      // ground-floor shopfront glazing
      const shop = new THREE.Mesh(new THREE.BoxGeometry(0.1, 2.4, w - 1.2), glass); shop.position.set(fx - side * 0.02, 1.6, z); group.add(shop);
      // upper sash windows
      const cols = Math.max(2, Math.round(w / 2));
      for (let f = 1; f < Math.floor(h / 3.4); f++) for (let c = 0; c < cols; c++) {
        const wy = 3.3 + f * 3.0, wz = z - w / 2 + (c + 0.5) * (w / cols);
        const win = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.7, 0.9), glass); win.position.set(fx, wy, wz); group.add(win);
        const sill = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.1, 1.1), white); sill.position.set(fx - side * 0.1, wy - 0.9, wz); group.add(sill);
        const head = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.25, 1.2), white); head.position.set(fx - side * 0.1, wy + 0.98, wz); group.add(head);
      }
      // verandah
      const ver = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.12, w), timber); ver.position.set(side * 5.8, 3.2, z); ver.castShadow = true; group.add(ver);
      const fascia = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.5, w), white); fascia.position.set(side * 4.52, 3.0, z); group.add(fascia);
      for (const k of [-1, 1]) { const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 3.2, 8), timber); post.position.set(side * 4.6, 1.6, z + k * (w / 2 - 0.4)); post.castShadow = true; group.add(post); }
      // parapet + cornice
      const par = new THREE.Mesh(new THREE.BoxGeometry(d + 0.3, 0.7, w + 0.3), white); par.position.set(side * (7 + d / 2), h + 0.35, z); group.add(par);
      const corn = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.3, w + 0.4), white); corn.position.set(fx - side * 0.1, h - 0.4, z); group.add(corn);
      if (i % 2 === 0) { const lamp = makeLamp(); lamp.position.set(side * 4.2, 0.2, z + 3); group.add(lamp); lamps.push(lamp); }
    }
  }
  // Wellington hills behind the plate
  const hillMat = assets.pbr('grass_ground', { repeat: [20, 8], color: '#4d6b4a' });
  for (let i = 0; i < 6; i++) { const hmesh = new THREE.Mesh(new THREE.SphereGeometry(26 + r() * 18, 24, 14), hillMat); hmesh.position.set(-40 + i * 16, -14, -120 - r() * 20); hmesh.scale.y = 0.9; group.add(hmesh); }
  // horse tram
  const tram = new THREE.Group();
  const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 2.4, 6), new THREE.MeshStandardMaterial({ color: '#7a1f1f', roughness: 0.5 })); body.position.y = 1.7; body.castShadow = true; tram.add(body);
  const roof = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.2, 6.4), new THREE.MeshStandardMaterial({ color: '#2a2a2a' })); roof.position.y = 2.95; tram.add(roof);
  for (let i = 0; i < 5; i++) { const win = new THREE.Mesh(new THREE.BoxGeometry(2.24, 0.9, 0.8), glass); win.position.set(0, 2.1, -2.2 + i * 1.1); tram.add(win); }
  for (let i = 0; i < 4; i++) { const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.2, 16), new THREE.MeshStandardMaterial({ color: '#222' })); wheel.rotation.z = Math.PI / 2; wheel.position.set(i % 2 ? 1 : -1, 0.4, i < 2 ? 2 : -2); tram.add(wheel); }
  tram.position.set(1.15, 0, -30); group.add(tram);
  // Kate Sheppard's portrait appears on a shop wall as a hanging picture
  const sheppard = framedImage('sheppard.jpg', 1.4, { frameColor: '#6b5a3a' }); sheppard.position.set(-6.95, 2.4, -2); sheppard.rotation.y = Math.PI / 2; group.add(sheppard);
  // Camellia petals (Kate Sheppard's white camellia)
  const petals = particles(500, [16, 10, 60], '#ffffff', 0.14, 1893, ctx.glowTex); petals.material.opacity = 0; petals.position.y = 6; group.add(petals);

  let shake = 0, lampsOn = 0, lampsTarget = 0, petalAmt = 0;
  return {
    name: 'Lambton Quay, 19 September 1893', theme: 'light', bg: '#e5d3b8', fog: ['#e5d3b8', 40, 140], group, transitionIn: 'stamp',
    env: { id: 'kiara_1_dawn', background: true, intensity: 1.0, bgIntensity: 1.0, rotation: 2.8 },
    grade: { saturation: 0.9, contrast: 1.1, warmth: 0.3, sepia: 0.3, bloom: 0.7, veil: 1.3, vignette: 1.4 },
    camera(local, cam, target) {
      const z = lerp(26, -40, local);
      const sx = (Math.random() - 0.5) * shake, sy = (Math.random() - 0.5) * shake;
      // Ride the left of the street and hop the tram instead of clipping through it.
      const over = smooth(clamp(1 - Math.abs(z - tram.position.z) / 10));
      cam.position.set(-1.9 - over * 0.45 + sx, 2.45 + over * 2.3 + sy, z);
      target.set(0.35, 2.15 + over * 0.4, z - 18);
      cam.fov = 52 - shake * 5;
    },
    update(local, time, dt) {
      shake = lerp(shake, 0, dt * 4);
      lampsTarget = Math.max(lampsTarget, remap(local, 0.5, 0.8));
      lampsOn = lerp(lampsOn, lampsTarget, dt * 2);
      for (const l of lamps) l.userData.setOn(lampsOn);
      tram.position.z += dt * 1.5; if (tram.position.z > 40) tram.position.z = -80;
      petalAmt = lerp(petalAmt, 0, dt * 0.4);
      petals.material.opacity = petalAmt; petals.position.y = 6 - (1 - petalAmt) * 5; petals.rotation.y = time * 0.1;
    },
    woman(local) {
      const z = lerp(18, -48, local);
      return { x: -1.6, y: 0, z, scale: 1, facing: Math.PI, walk: 1, beckon: 0, point: 0, opacity: 0.14, solid: 0, flow: 1.2 };
    },
    triggers: {
      stamp: () => { shake = 1.2; },
      lamps: () => { lampsTarget = 1; },
      sheppard: () => { petalAmt = 1; },
    },
    shake: () => { shake = 1.2; },
  };
}

/* ---------------------------------------------------------------- Scene 11: the Oval Office, Edith Wilson, 1920 */
export function sceneTwenties(ctx) {
  const group = new THREE.Group();
  const RX = 6.4, RZ = 8.2, H = 5.2;
  const wall = assets.pbr('plastered_wall_02', { repeat: [8, 2], color: '#7a8462', side: THREE.DoubleSide }); // Wilson-era sage
  const trim = new THREE.MeshStandardMaterial({ color: '#c4b496', roughness: 0.55, side: THREE.DoubleSide });
  const goldM = new THREE.MeshStandardMaterial({ color: '#c9a44c', roughness: 0.35, metalness: 0.85 });
  const wood = assets.pbr('oak_wood_planks', { repeat: [6, 8], color: '#8a5a32' });

  const floor = new THREE.Mesh(new THREE.CircleGeometry(1, 64), wood);
  floor.rotation.x = -Math.PI / 2; floor.scale.set(RX, RZ, 1); floor.receiveShadow = true; group.add(floor);
  const ceil = new THREE.Mesh(new THREE.CircleGeometry(1, 64), trim);
  ceil.rotation.x = Math.PI / 2; ceil.position.y = H; ceil.scale.set(RX, RZ, 1); group.add(ceil);
  const oval = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, H, 64, 1, true, 0.12 * Math.PI, 1.76 * Math.PI), wall);
  oval.scale.set(RX, 1, RZ); oval.position.y = H / 2; group.add(oval);
  const wainscot = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1.15, 64, 1, true, 0.12 * Math.PI, 1.76 * Math.PI), trim);
  wainscot.scale.set(RX - 0.02, 1, RZ - 0.02); wainscot.position.y = 0.57; group.add(wainscot);
  const cornice = new THREE.Mesh(new THREE.TorusGeometry(1, 0.07, 8, 64, 1.76 * Math.PI), trim);
  cornice.rotation.set(Math.PI / 2, 0, 0.12 * Math.PI); cornice.scale.set(RX, RZ, 1); cornice.position.y = H - 0.08; group.add(cornice);

  const rug = new THREE.Mesh(new THREE.CircleGeometry(1, 48), new THREE.MeshStandardMaterial({ color: '#5c1c22', roughness: 0.9 }));
  rug.rotation.x = -Math.PI / 2; rug.position.y = 0.02; rug.scale.set(2.6, 3.6, 1); group.add(rug);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(1, 0.035, 8, 48), goldM);
  ring.rotation.x = Math.PI / 2; ring.position.y = 0.03; ring.scale.set(2.6, 3.6, 1); group.add(ring);

  const onWall = (theta, y, inset = 0.08) => {
    const x = Math.sin(theta) * (RX - inset), z = Math.cos(theta) * (RZ - inset);
    return { x, y, z, rotY: Math.atan2(-x, -z) };
  };

  // Three tall windows behind the desk — the Oval Office silhouette
  const windows = [];
  const drapeM = new THREE.MeshStandardMaterial({ color: '#d7c39a', roughness: 0.85, side: THREE.DoubleSide });
  for (const theta of [Math.PI - 0.42, Math.PI, Math.PI + 0.42]) {
    const { x, z, rotY } = onWall(theta, 2.85, 0.04);
    const pane = new THREE.Mesh(
      new THREE.PlaneGeometry(1.35, 2.85),
      new THREE.MeshStandardMaterial({ color: '#d7e4f2', emissive: '#ffe2b0', emissiveIntensity: 1.1, roughness: 0.22, metalness: 0.08, side: THREE.DoubleSide })
    );
    pane.position.set(x, 2.85, z); pane.rotation.y = rotY; group.add(pane); windows.push(pane);
    const sash = (w, h, ox, oy) => {
      const b = new THREE.Mesh(new THREE.BoxGeometry(w, h, 0.08), trim);
      b.position.set(x + Math.cos(rotY) * ox, 2.85 + oy, z - Math.sin(rotY) * ox);
      b.rotation.y = rotY; group.add(b);
    };
    sash(1.5, 0.09, 0, 1.47); sash(1.5, 0.09, 0, -1.47);
    sash(0.09, 3.04, -0.72, 0); sash(0.09, 3.04, 0.72, 0);
    sash(0.045, 2.85, 0, 0); sash(1.35, 0.045, 0, 0);
    for (const side of [-0.82, 0.82]) {
      const drape = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 3.35), drapeM);
      drape.position.set(x + Math.cos(rotY) * side, 2.7, z - Math.sin(rotY) * side);
      drape.rotation.y = rotY; group.add(drape);
    }
    const shaft = new THREE.SpotLight('#ffe4b8', 22, 16, 0.55, 0.75, 1.15);
    shaft.position.set(x * 0.92, 3.5, z * 0.92);
    shaft.target.position.set(x * 0.15, 0.4, z * 0.15);
    group.add(shaft, shaft.target);
    pane.userData.shaft = shaft;
  }

  // Edith hangs where a president's portrait would — left of the windows
  const ep = onWall(Math.PI + 0.72, 3.05, 0.1);
  const portrait = framedImage('edith_wilson.jpg', 1.7, { frameColor: '#c9a44c', depth: 0.12, glow: 0.18 });
  portrait.position.set(ep.x, ep.y, ep.z); portrait.rotation.y = ep.rotY; group.add(portrait);
  const portraitSpot = new THREE.SpotLight('#ffe7c4', 16, 14, 0.38, 0.55, 1.2);
  portraitSpot.position.set(ep.x * 0.45, H - 0.5, ep.z * 0.45); portraitSpot.target = portrait; group.add(portraitSpot);

  // 1913 procession: women still marching while she already holds the office
  const pp = onWall(Math.PI - 0.72, 2.85, 0.1);
  const procession = framedImage('suffrage_procession_1913.jpg', 2.2, { frameColor: '#c9a44c', depth: 0.1 });
  procession.position.set(pp.x, pp.y, pp.z); procession.rotation.y = pp.rotY; group.add(procession);

  // Resolute-style desk, empty chair: she governed from here, unofficially
  place(group, assets.model('WoodenTable_01'), { height: 0.95, position: [0, 0, -3.5] });
  place(group, assets.model('GreenChair_01'), { height: 1.35, position: [0, 0, -4.45], rotation: [0, 0, 0] });
  place(group, assets.model('WoodenChair_01'), { height: 1.05, position: [-1.35, 0, -2.0], rotation: [0, 0.4, 0] });
  place(group, assets.model('WoodenChair_01'), { height: 1.05, position: [1.35, 0, -2.0], rotation: [0, -0.4, 0] });
  place(group, assets.model('brass_candleholders'), { height: 0.4, position: [-0.55, 0.96, -3.35] });
  place(group, assets.model('book_encyclopedia_set_01'), { height: 0.22, position: [0.55, 0.96, -3.45], rotation: [0, -0.2, 0] });
  const blotter = framedImage('suffrage_program_1913.jpg', 0.65, { frameColor: '#5a3a22', depth: 0.02 });
  blotter.rotation.x = -Math.PI / 2; blotter.position.set(-0.1, 0.97, -3.25); group.add(blotter);
  const quill = makeQuill(); quill.position.set(0.32, 0.97, -3.15); quill.rotation.set(0.2, 0.4, -0.6); group.add(quill);
  place(group, assets.scan('declaration_desk.glb'), { height: 0.22, position: [0.05, 0.97, -3.65], rotation: [0, 0.1, 0] });

  const chandLight = new THREE.PointLight('#ffd9a0', 40, 20, 1.8); chandLight.position.set(0, H - 1.5, -1.4); group.add(chandLight);
  place(group, assets.model('Chandelier_03'), { height: 1.6, position: [0, H - 1.8, -1.4] });
  group.add(new THREE.HemisphereLight('#f3ead8', '#3a3224', 0.85));
  const key = new THREE.DirectionalLight('#ffe6c4', 1.6); key.position.set(3, 8, 7); key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024); Object.assign(key.shadow.camera, { left: -8, right: 8, top: 6, bottom: -4, far: 30 }); key.shadow.bias = -0.0004;
  group.add(key);
  const motes = particles(420, [10, 4, 12], '#ffe7c4', 0.04, 1920, ctx.glowTex); motes.material.opacity = 0.14; motes.position.set(0, 2.4, -2); group.add(motes);

  let sweep = 0, sweepTarget = 0, edith = 0;
  const bgDyn = new THREE.Color('#1a1712');
  const api = {
    name: 'August 18, 1920', theme: 'dark', bg: '#1a1712', bgDyn, fog: ['#1a1712', 28, 60], group, transitionIn: 'fade',
    env: { id: 'church_meeting_room', background: false, intensity: 0.8 },
    grade: { saturation: 0.96, contrast: 1.06, warmth: 0.16, bloom: 0.5, vignette: 1.15 },
    camera(local, cam, target) {
      const t = smooth(local);
      cam.position.set(lerp(-0.7, 0.2, t), lerp(1.55, 1.62, t), lerp(4.8, 0.6, t));
      target.set(0, lerp(1.5, 2.35, t), lerp(-3.4, -7.4, t));
      cam.fov = lerp(44, 36, t);
    },
    update(local, time, dt) {
      sweepTarget = Math.max(sweepTarget, remap(local, 0.55, 0.85));
      sweep = lerp(sweep, sweepTarget, dt * 1.2);
      edith = lerp(edith, 0, dt * 0.7);
      portraitSpot.intensity = 22 + edith * 80 + sweep * 20;
      chandLight.intensity = 40 + Math.sin(time * 9) * 2 + sweep * 14;
      key.intensity = 1.6 + sweep * 1.2;
      windows.forEach((w) => {
        w.material.emissiveIntensity = 1.1 + sweep * 1.8;
        w.userData.shaft.intensity = 22 + sweep * 36;
      });
      motes.material.opacity = 0.12 + sweep * 0.5;
      motes.rotation.y = time * 0.03;
      bgDyn.set('#1a1712').lerp(new THREE.Color('#4a3820'), sweep * 0.7);
      api.grade.warmth = 0.14 + sweep * 0.24;
      api.theme = sweep > 0.65 ? 'light' : 'dark';
    },
    woman() {
      return { x: -1.65, y: 0, z: -2.8, scale: 1, facing: 0.55, walk: 0, beckon: 0.3, point: 0, opacity: 0.16, solid: 0, flow: 1.1 };
    },
    triggers: { sweep: () => { sweepTarget = 1; }, edith: () => { edith = 1; } },
  };
  return api;
}
