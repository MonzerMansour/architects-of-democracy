import * as THREE from 'three';
import { lerp, clamp, remap, rng, smooth, particles, canvasTexture } from '../utils.js';
import { photoPlate, makeHaze } from '../props.js';
import { assets, place } from '../assets.js';

/* ---------------------------------------------------------------- Scene 4: one road through three empires, split down the middle */
export function sceneEmpires(ctx) {
  const group = new THREE.Group();
  const sun = new THREE.DirectionalLight('#ffd09a', 2.6); sun.position.set(-30, 18, 20); sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048); Object.assign(sun.shadow.camera, { left: -40, right: 40, top: 20, bottom: -20, far: 120 }); sun.shadow.bias = -0.0004;
  group.add(sun, sun.target);
  group.add(new THREE.HemisphereLight('#f3dcb8', '#5a4632', 0.9));

  // A long road across the foreground, and the land it runs through, fading into the haze toward the paintings
  // the verge behind the road dissolves after a few metres, so the painted land takes over
  const landMat = assets.pbr('rocky_terrain_02', { repeat: [80, 3] });
  landMat.color.setRGB(2.1, 1.75, 1.25); landMat.transparent = true;
  landMat.alphaMap = canvasTexture(4, 64, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#000'); g.addColorStop(0.55, '#fff'); g.addColorStop(1, '#fff'); c.fillStyle = g; c.fillRect(0, 0, w, h); });
  const land = new THREE.Mesh(new THREE.PlaneGeometry(520, 26, 1, 1), landMat);
  land.rotation.x = -Math.PI / 2; land.position.z = 1; land.receiveShadow = true; group.add(land);
  const road = new THREE.Mesh(new THREE.PlaneGeometry(520, 5, 1, 1), assets.pbr('cobblestone_floor_08', { repeat: [104, 1], color: '#e6d3b0' }));
  road.rotation.x = -Math.PI / 2; road.position.set(0, 0.02, 2); road.receiveShadow = true; group.add(road);
  const r = rng(44);
  for (let i = 0; i < 40; i++) {
    const x = -200 + r() * 400, z = rnd(r, 6, 13);
    place(group, assets.model('boulder_01'), { height: 0.3 + r() * 1.4, position: [x, -0.1, z], rotation: [0, r() * 6.3, 0] });
  }
  // Roman milestones along the road: the one built thing that belongs to all three journeys
  const stone = assets.pbr('large_sandstone_blocks_01', { repeat: [1, 1], color: '#cbb894' });
  for (let x = -180; x <= 180; x += 30) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.38, 1.5, 20), stone); m.position.set(x + 7, 0.75, -0.9); m.castShadow = m.receiveShadow = true; group.add(m);
  }

  // The three empires the text names, as one painted panorama: Rome (Cole), Persia (Coste), China (Allom)
  const panels = [
    ['cole_consummation.jpg', -150, 1.0], ['coste_isfahan.jpg', 0, 1.0], ['allom_great_wall.jpg', 150, 1.15],
  ].map(([file, x, gain], i) => {
    const p = photoPlate(file, 190, { curve: 0.12, fadeX: 0.2, fadeTop: 0.08, fadeBottom: 0.0 });
    p.position.set(x, 0, -100 - i * 0.5);
    p.material.depthWrite = false; p.renderOrder = -10 + i; p.userData.gain = gain;
    const sit = () => { if (p.scale.y > 1) p.position.y = p.scale.y / 2 - 26; else requestAnimationFrame(sit); };
    sit();
    group.add(p);
    return p;
  });
  group.add(makeHaze(ctx, { count: 40, spread: [420, 10, 80], y: 5, color: '#f0dcb8', size: 40, opacity: 0.06, seed: 31 }));
  const dust = particles(900, [120, 14, 30], '#ffe8c0', 0.07, 5, ctx.glowTex); dust.material.opacity = 0.5; group.add(dust);

  const seam = document.querySelector('.scene[data-scene="4"] .seam');
  let split = 0, splitTarget = 0;
  const glow = [0, 0, 0];
  const api = {
    name: 'Across time and space', theme: 'light', bg: '#d7c2a0', fog: ['#e2d0b0', 30, 240], group, transitionIn: 'spin',
    env: { id: 'kloppenheim_06_puresky', background: true, intensity: 0.7, bgIntensity: 0.9, rotation: -0.6 },
    grade: { saturation: 1.02, contrast: 1.08, warmth: 0.16, vignette: 1.3, bloom: 0.45, split: 0 },
    camera(local, cam, target) {
      const t = smooth(local);
      const x = lerp(-175, 165, t);
      cam.position.set(x, 2.6 + Math.sin(local * 5) * 0.15, 16);
      target.set(x + 6, 13, -40);
      cam.fov = 50;
    },
    update(local, time, dt) {
      const grow = remap(local, 0.18, 0.4);
      const leave = remap(local, 0.8, 0.94);
      const want = grow * (1 - leave);
      splitTarget = local > 0.8 ? want : Math.max(splitTarget, want);
      if (local < 0.08) splitTarget = 0;
      split = lerp(split, splitTarget, dt * (local > 0.8 ? 5 : 2.2));
      api.grade.split = split;
      seam?.style.setProperty('--split', split.toFixed(3));
      panels.forEach((p, i) => { glow[i] = lerp(glow[i], 0, dt * 0.8); p.material.color.setScalar(p.userData.gain * (1 + glow[i] * 0.45)); });
      dust.position.x = ctx.camera.position.x; dust.rotation.y = time * 0.02;
      sun.position.x = ctx.camera.position.x - 30; sun.target.position.set(ctx.camera.position.x, 0, 0);
    },
    woman(local) {
      const x = lerp(-175, 165, smooth(local)) + 3;
      return { x, y: 0, z: 3.4, facing: Math.PI / 2, walk: 1, beckon: 0, point: 0, opacity: 0.16, solid: 0, flow: 1.4 };
    },
    triggers: {
      male: () => { splitTarget = 1; },
      female: () => { splitTarget = 1; },
      rome: () => { glow[0] = 1; },
      persia: () => { glow[1] = 1; },
      china: () => { glow[2] = 1; },
    },
  };
  return api;
}
const rnd = (r, a, b) => a + r() * (b - a);

/* ---------------------------------------------------------------- Scene 5: the burning map (Ortelius, 1570) */
export function sceneMap(ctx) {
  const group = new THREE.Group();
  const candle = new THREE.PointLight('#ffb067', 90, 40, 2); candle.position.set(3, 4, 6); candle.castShadow = true; candle.shadow.mapSize.set(1024, 1024); candle.shadow.bias = -0.002; group.add(candle);
  const fill = new THREE.PointLight('#7a4a2a', 30, 30, 2); fill.position.set(-6, 3, 4); group.add(fill);
  const over = new THREE.SpotLight('#ffe2b0', 120, 30, 0.7, 0.8, 1.2); over.position.set(0, 10, 2); over.target.position.set(0, 0, 0); group.add(over, over.target);

  const mapTex = assets.image('map_ortelius.jpg');
  const uniforms = { map: { value: mapTex }, uBurn: { value: 0 }, uTime: { value: 0 } };
  const mat = new THREE.ShaderMaterial({
    uniforms, transparent: true, side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main(){ vUv = uv; vec3 p = position; p.z += sin(uv.x*6.0 + uv.y*4.0)*0.06; gl_Position = projectionMatrix*modelViewMatrix*vec4(p,1.0); }`,
    fragmentShader: `
      uniform sampler2D map; uniform float uBurn; uniform float uTime; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float noise(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f);
        return mix(mix(hash(i),hash(i+vec2(1,0)),f.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0,a=0.5; for(int i=0;i<5;i++){ s+=noise(p)*a; p*=2.1; a*=0.5;} return s; }
      void main(){
        vec4 col = texture2D(map, vUv);
        float edge = min(min(vUv.x, 1.0-vUv.x), min(vUv.y, 1.0-vUv.y));
        float n = fbm(vUv*6.0) * 0.35 + fbm(vUv*20.0)*0.08;
        float d = edge + n;
        float front = uBurn * 0.62;
        if (d < front) discard;
        float band = smoothstep(front, front + 0.06, d);
        float ember = 1.0 - band;
        vec3 charred = mix(col.rgb, vec3(0.03,0.02,0.02), smoothstep(front+0.14, front+0.02, d));
        vec3 glow = vec3(1.0, 0.45, 0.1) * pow(ember, 1.5) * (0.8 + 0.4*sin(uTime*9.0 + vUv.x*40.0));
        // candle-lit vignette so the parchment reads as lit from the upper right
        float lit = 1.15 + 0.5 * smoothstep(0.0, 1.0, vUv.x*0.6 + vUv.y*0.5);
        gl_FragColor = vec4(charred*lit + glow*1.1, col.a);
      }`,
  });
  const map = new THREE.Mesh(new THREE.PlaneGeometry(16, 11.6, 24, 16), mat);
  map.rotation.x = -Math.PI / 2 + 0.18; map.position.set(0, 0.06, 0);
  group.add(map);
  const table = new THREE.Mesh(new THREE.BoxGeometry(30, 0.5, 20), assets.pbr('oak_wood_planks', { repeat: [4, 3], color: '#6b4a2c' }));
  table.position.set(0, -0.25, 0); table.receiveShadow = true; group.add(table);
  // Real props on the chart table: brass candleholders, a navigator's compass, an oil lamp, a Dutch ship model
  place(group, assets.model('brass_candleholders'), { height: 1.4, position: [6.5, 0, 4.5], rotation: [0, -0.4, 0] });
  place(group, assets.model('seadogs_compass'), { height: 0.4, position: [-6.2, 0.1, 3.8], rotation: [0, 0.5, 0] });
  place(group, assets.model('vintage_oil_lamp'), { height: 1.3, position: [-7.5, 0, -4.5] });
  let ship = null;
  place(group, assets.model('dutch_ship_large_02'), { height: 2.2, position: [-2.5, 0.4, 1.2], rotation: [0, 0.9, 0], onReady: (h) => { ship = h; } });
  const embers = particles(600, [18, 12, 10], '#ff8a3a', 0.1, 12, ctx.glowTex); group.add(embers);
  const smoke = particles(300, [20, 14, 12], '#3a3032', 0.7, 13, ctx.glowTex); smoke.material.blending = THREE.NormalBlending; smoke.material.opacity = 0; group.add(smoke);

  let burn = 0, burnTarget = 0, triggerBurn = 0;
  const mouse = ctx.mouse;
  return {
    name: 'The Americas', theme: 'dark', bg: '#07050a', fog: ['#07050a', 18, 60], group, transitionIn: 'fade',
    env: { id: 'fireplace', background: false, intensity: 0.5 },
    grade: { saturation: 0.95, contrast: 1.12, warmth: 0.2, vignette: 1.3 },
    camera(local, cam, target) {
      const t = smooth(local);
      cam.position.set(lerp(-6, 2.5, t) + mouse.x * 0.6, lerp(9, 4.2, t) + mouse.y * 0.4, lerp(14, 7.5, t));
      target.set(lerp(-1, 1.2, t), 0, lerp(-1, -0.5, t));
      cam.fov = lerp(44, 36, t);
    },
    update(local, time, dt) {
      if (local < 0.3) triggerBurn = 0; // scrolling back heals the chart
      burnTarget = Math.max(remap(local, 0.5, 1.0) * 0.85, triggerBurn);
      burn = lerp(burn, burnTarget, dt * 0.8);
      uniforms.uBurn.value = burn; uniforms.uTime.value = time;
      candle.intensity = 90 + Math.sin(time * 7) * 8 + Math.sin(time * 13.3) * 4 + burn * 80;
      candle.color.set('#ffb067').lerp(new THREE.Color('#ff5a1a'), burn);
      embers.material.opacity = burn; embers.position.y = (time * 0.4) % 2;
      embers.rotation.y = time * 0.03;
      smoke.material.opacity = burn * 0.25; smoke.position.y = (time * 0.2) % 3 + 1;
      if (ship) { ship.position.y = 0.4 + Math.sin(time * 0.8) * 0.05; ship.rotation.z = Math.sin(time * 0.6) * 0.03; }
    },
    woman(local) {
      // tiny figure walking across the surface of the map itself
      return { x: -3.4 + local * 3, y: 0.4, z: 2.2, scale: 0.38, facing: Math.PI / 2, walk: 0.6, beckon: 0, point: 0, opacity: 0.18, solid: 0, flow: 1 };
    },
    triggers: {
      burn: () => { triggerBurn = 0.6; },
      haudenosaunee: () => { candle.color.set('#8ad7ff'); candle.intensity = 120; },
    },
  };
}
