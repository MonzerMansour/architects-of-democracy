import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { rng, textures, canvasTexture, particles } from './utils.js';
import { assets } from './assets.js';

/** A box with softened edges: catches light on its edges the way real masonry and joinery do. */
export function rbox(w, h, d, mat, radius = 0.04) {
  const r = Math.min(radius, Math.min(w, h, d) * 0.45);
  const m = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 3, r), mat);
  m.castShadow = m.receiveShadow = true;
  return m;
}

/** Drifting atmospheric haze: big soft sprites, barely there, that give air between planes. */
export function makeHaze(ctx, { count = 36, spread = [120, 8, 120], y = 3, color = '#e8dcc8', size = 22, opacity = 0.07, seed = 9, additive = false } = {}) {
  const p = particles(count, spread, color, size, seed, ctx.glowTex);
  p.material.opacity = opacity; p.material.depthWrite = false;
  p.material.blending = additive ? THREE.AdditiveBlending : THREE.NormalBlending;
  p.position.y = y; p.renderOrder = 5;
  p.userData.update = (time) => { p.position.x = Math.sin(time * 0.02) * 2; p.rotation.y = time * 0.004; };
  return p;
}

/** A soft cone of light (a window shaft, a lamp pool): additive gradient, fades toward its mouth. */
let _coneTex;
export function makeLightCone({ length = 8, radius = 2.5, color = '#ffe2b0', opacity = 0.16 } = {}) {
  _coneTex ||= canvasTexture(64, 256, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g; c.fillRect(0, 0, w, h);
  });
  const geo = new THREE.ConeGeometry(radius, length, 32, 1, true);
  geo.translate(0, -length / 2, 0); // apex at the origin, opening downward (-y); rotate to aim
  const mat = new THREE.MeshBasicMaterial({ map: _coneTex, color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
  const m = new THREE.Mesh(geo, mat); m.renderOrder = 6;
  return m;
}

let _marble;
/** Real scanned marble (Poly Haven marble_01) — shared by every column. */
// marble_01 is a sheet of cut slabs; sample inside one slab so columns don't show joints
export const marbleMat = () => (_marble ||= (() => {
  const m = assets.pbr('marble_01', { repeat: [0.36, 0.2], roughness: 1, metalness: 1, color: '#f1ebe0' });
  for (const t of [m.map, m.normalMap, m.aoMap]) t.offset.set(0.08, 0.57);
  return m;
})());

/**
 * Greek Doric column built from stacked drums (so it can fracture), with a proper
 * entasis taper, 20 flutes, echinus + abacus capital, and PBR marble.
 */
export function makeColumn({ height = 6, radius = 0.42, drums = 6, broken = 0, seed = 1, mat } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const m = mat || marbleMat();
  const keep = broken ? Math.max(1, Math.round(drums * (1 - broken * (0.3 + r() * 0.6)))) : drums;
  const drumH = height / drums;
  const list = [];
  const base = new THREE.Mesh(new THREE.BoxGeometry(radius * 2.8, drumH * 0.35, radius * 2.8), m);
  base.position.y = drumH * 0.175; base.castShadow = base.receiveShadow = true; g.add(base); list.push(base);
  for (let i = 0; i < keep; i++) {
    const t0 = i / drums, t1 = (i + 1) / drums;
    const ent = (t) => 1 - 0.16 * t * t - 0.02 * t; // entasis
    const geo = new THREE.CylinderGeometry(radius * ent(t1), radius * ent(t0), drumH, 60, 1);
    const pos = geo.attributes.position;
    for (let v = 0; v < pos.count; v++) {
      const x = pos.getX(v), z = pos.getZ(v), rad = Math.hypot(x, z);
      if (rad < 0.01) continue;
      const a = Math.atan2(z, x);
      const f = Math.pow(Math.abs(Math.sin(a * 10)), 0.8); // 20 flutes
      const nr = rad * (1 - 0.06 * (1 - f));
      pos.setX(v, (x / rad) * nr); pos.setZ(v, (z / rad) * nr);
    }
    geo.computeVertexNormals();
    const d = new THREE.Mesh(geo, m);
    d.position.y = drumH * 0.35 + drumH * (i + 0.5);
    d.castShadow = d.receiveShadow = true;
    if (broken && i === keep - 1) { d.rotation.z = (r() - 0.5) * 0.1; d.scale.y = 0.6 + r() * 0.4; }
    g.add(d); list.push(d);
  }
  if (keep === drums) {
    const topR = radius * 0.82;
    const pts = [new THREE.Vector2(topR, 0), new THREE.Vector2(topR * 1.05, drumH * 0.08), new THREE.Vector2(topR * 1.25, drumH * 0.2), new THREE.Vector2(topR * 1.45, drumH * 0.3), new THREE.Vector2(topR * 1.5, drumH * 0.32)];
    const ech = new THREE.Mesh(new THREE.LatheGeometry(pts, 48), m); ech.position.y = drumH * 0.35 + height; ech.castShadow = true; g.add(ech); list.push(ech);
    const ab = new THREE.Mesh(new THREE.BoxGeometry(radius * 3.1, drumH * 0.25, radius * 3.1), m);
    ab.position.y = drumH * 0.35 + height + drumH * 0.445; ab.castShadow = true; g.add(ab); list.push(ab);
  }
  g.userData.drums = list;
  g.userData.height = drumH * 0.35 + height + drumH * 0.57;
  for (const d of list) { d.userData.rest = d.position.clone(); d.userData.restRot = d.rotation.clone(); d.userData.dir = new THREE.Vector3(r() - 0.5, r() * 0.6, r() - 0.5).normalize(); d.userData.spin = (r() - 0.5) * 2; }
  return g;
}

export function makeBeam(length, y, mat) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(length, 0.7, 1.3), mat || marbleMat());
  m.position.y = y + 0.35; m.castShadow = m.receiveShadow = true;
  // triglyph detail strip
  const strip = new THREE.Mesh(new THREE.BoxGeometry(length, 0.22, 1.36), mat || marbleMat()); strip.position.y = 0.12; m.add(strip);
  return m;
}

/** Olive tree: twisted lathe trunk + clustered foliage with leaf alpha texture. */
let _leafTex;
function leafTexture() {
  return (_leafTex ||= canvasTexture(256, 256, (ctx, w, h) => {
    ctx.clearRect(0, 0, w, h);
    const r = rng(3);
    // olive foliage: small, narrow, silvery grey-green leaves
    for (let i = 0; i < 520; i++) {
      const x = r() * w, y = r() * h, a = r() * Math.PI, len = 6 + r() * 7;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = `hsl(${78 + r() * 22}, ${14 + r() * 14}%, ${30 + r() * 26}%)`;
      ctx.beginPath(); ctx.ellipse(0, 0, len, len * 0.2, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();
    }
  }));
}
export function makeOliveTree(seed = 1, scale = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const bark = assets.pbr('large_sandstone_blocks_01', { repeat: [1, 2], color: '#6b5a48' });
  const pts = [];
  for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(0.28 * (1 - t * 0.6) + (i % 2) * 0.03, t * 2.2)); }
  const trunk = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), bark);
  trunk.rotation.z = (r() - 0.5) * 0.3; trunk.castShadow = true; g.add(trunk);
  const leafMat = new THREE.MeshStandardMaterial({ map: leafTexture(), alphaTest: 0.5, side: THREE.DoubleSide, roughness: 1, color: '#8d957c' });
  for (let k = 0; k < 11; k++) {
    const blob = new THREE.Group();
    for (let p = 0; p < 6; p++) {
      const plane = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 1.2), leafMat);
      plane.rotation.set(r() * Math.PI, r() * Math.PI, r() * Math.PI); plane.castShadow = true; blob.add(plane);
    }
    blob.position.set((r() - 0.5) * 2.6, 2.0 + r() * 1.5, (r() - 0.5) * 2.6);
    g.add(blob);
  }
  // gnarled branches reaching into the canopy
  for (let b = 0; b < 4; b++) {
    const br = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.1, 1.4, 6), bark);
    const a = r() * Math.PI * 2; br.position.set(Math.cos(a) * 0.5, 2.5, Math.sin(a) * 0.5); br.rotation.set(Math.sin(a) * 0.8, 0, Math.cos(a) * 0.8); g.add(br);
  }
  g.scale.setScalar(scale);
  return g;
}

/**
 * A big photo/painting backdrop: gently curved cyclorama so edges wrap away from the camera.
 * `shader: { uniforms, header, code }` splices extra GLSL in after the colour is sampled (it can edit diffuseColor).
 */
export function photoPlate(file, width, { curve = 0.35, height, fade = true, fadeX = 0.08, fadeTop = 0.1, fadeBottom = 0.05, tint = '#ffffff', shader } = {}) {
  const tex = assets.image(file);
  const segs = 48;
  const geo = new THREE.PlaneGeometry(width, 1, segs, 1);
  const pos = geo.attributes.position;
  for (let i = 0; i < pos.count; i++) { const x = pos.getX(i); pos.setZ(i, -Math.pow(x / (width / 2), 2) * width * curve * 0.5); }
  geo.computeVertexNormals();
  const mat = new THREE.MeshBasicMaterial({ map: tex, color: tint, transparent: fade, toneMapped: true });
  if (fade || shader) {
    mat.onBeforeCompile = (sh) => {
      Object.assign(sh.uniforms, shader?.uniforms || {});
      if (shader?.header) sh.fragmentShader = shader.header + '\n' + sh.fragmentShader;
      sh.fragmentShader = sh.fragmentShader.replace('#include <map_fragment>', `#include <map_fragment>
        ${fade ? `float fx = smoothstep(0.0, ${fadeX.toFixed(3)}, vMapUv.x) * smoothstep(1.0, ${(1 - fadeX).toFixed(3)}, vMapUv.x);
        float fy = smoothstep(0.0, ${fadeBottom.toFixed(3)}, vMapUv.y) * smoothstep(1.0, ${(1 - fadeTop).toFixed(3)}, vMapUv.y);
        diffuseColor.a *= fx * fy;` : ''}
        ${shader?.code || ''}`);
    };
  }
  const m = new THREE.Mesh(geo, mat);
  m.renderOrder = -10;
  const sizeTo = () => { const img = tex.image; if (!img?.width) return; m.scale.y = height || width * (img.height / img.width); };
  if (tex.image?.width) sizeTo(); else { const iv = setInterval(() => { if (tex.image?.width) { sizeTo(); clearInterval(iv); } }, 100); }
  return m;
}

/**
 * Textured ground that dissolves toward the horizon, so a painted backdrop's own land
 * carries on behind it. `light` multiplies the texture (Poly Haven diffuse maps are dark).
 */
let _farFade;
export function groundPatch(id, { width = 200, depth = 80, z = 0, repeat = [20, 8], light = [1.8, 1.55, 1.15], fade = 0.45, mat } = {}) {
  const m = mat || assets.pbr(id, { repeat });
  if (!mat) m.color.setRGB(...light);
  m.transparent = true;
  m.alphaMap = (_farFade ||= canvasTexture(4, 128, (c, w, h) => {
    const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#000'); g.addColorStop(1, '#fff'); c.fillStyle = g; c.fillRect(0, 0, w, h);
  })).clone();
  // remap the gradient so only the far `fade` fraction is transparent
  m.alphaMap.repeat.set(1, 1 / fade); m.alphaMap.offset.set(0, 1 - 1 / fade); m.alphaMap.needsUpdate = true;
  const g = new THREE.Mesh(new THREE.PlaneGeometry(width, depth, 1, 1), m);
  g.rotation.x = -Math.PI / 2; g.position.z = z; g.receiveShadow = true;
  return g;
}

/** Framed photo/painting plane (uses a real gilded frame look). */
export function framedImage(file, width = 1.6, { frameColor = '#b8923a', depth = 0.08, glow = 0 } = {}) {
  const g = new THREE.Group();
  const tex = assets.image(file);
  // BasicMaterial so the photograph reads even in a dark room; Standard + white emissive
  // painted a blank glowing canvas until the texture arrived.
  const canvas = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: tex, color: glow ? '#fff6e8' : '#ffffff', toneMapped: true }));
  canvas.position.z = depth * 0.2;
  canvas.scale.set(width, width * 1.25, 1);
  g.add(canvas);
  const gold = new THREE.MeshStandardMaterial({ color: frameColor, roughness: 0.3, metalness: 0.9 });
  const frame = new THREE.Group(); g.add(frame);
  const build = () => {
    const img = tex.image; if (!img?.width) return;
    const h = width * (img.height / img.width);
    canvas.scale.set(width, h, 1);
    g.userData.height = h;
    while (frame.children.length) frame.remove(frame.children[0]);
    const t = Math.max(0.05, width * 0.055);
    for (const [pw, ph, x, y] of [[width + 2 * t, t, 0, h / 2 + t / 2], [width + 2 * t, t, 0, -h / 2 - t / 2], [t, h, -width / 2 - t / 2, 0], [t, h, width / 2 + t / 2, 0]]) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(pw, ph, depth), gold); bar.position.set(x, y, depth * 0.3); bar.castShadow = true; frame.add(bar);
      const bead = new THREE.Mesh(new THREE.BoxGeometry(pw * 0.98, ph * 0.5, depth * 0.5), gold); bead.position.set(x, y, depth * 0.75); frame.add(bead);
    }
    const back = new THREE.Mesh(new THREE.BoxGeometry(width + 0.02, h + 0.02, 0.02), new THREE.MeshStandardMaterial({ color: '#2a1d0c' })); back.position.z = -0.012; frame.add(back);
  };
  if (tex.image?.width) build(); else { const iv = setInterval(() => { if (tex.image?.width) { build(); clearInterval(iv); } }, 80); }
  g.userData.canvas = canvas;
  return g;
}

/** Period street lamp: cast-iron post + the real Poly Haven Lantern_01 model on top. */
export function makeLamp({ height = 3.4, color = '#ffd27a' } = {}) {
  const g = new THREE.Group();
  const iron = new THREE.MeshStandardMaterial({ color: '#17161a', roughness: 0.55, metalness: 0.8 });
  const post = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.1, height, 12), iron); post.position.y = height / 2; post.castShadow = true; g.add(post);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.3, 0.4, 16), iron); base.position.y = 0.2; g.add(base);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.14, 0.02, 8, 24), iron); ring.position.y = height * 0.35; ring.rotation.x = Math.PI / 2; g.add(ring);
  const arm = new THREE.Mesh(new THREE.TorusGeometry(0.35, 0.025, 8, 24, Math.PI / 2), iron); arm.position.set(0.35, height - 0.35, 0); arm.rotation.z = Math.PI / 2; g.add(arm);
  const light = new THREE.PointLight(color, 0, 10, 2); light.position.set(0, height + 0.1, 0); g.add(light);
  const glow = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0 })); glow.position.y = height + 0.15; g.add(glow);
  assets.model('Lantern_01').then((lan) => {
    const box = new THREE.Box3().setFromObject(lan); const s = 0.55 / box.getSize(new THREE.Vector3()).y;
    lan.scale.setScalar(s); lan.position.y = height - 0.05; g.add(lan);
    lan.traverse((o) => { if (o.isMesh && o.material) { o.material = o.material.clone(); o.material.emissive = new THREE.Color(color); o.material.emissiveIntensity = 0; g.userData.lanternMats = (g.userData.lanternMats || []).concat(o.material); } });
  }).catch(() => {});
  g.userData.light = light; g.userData.glow = glow;
  g.userData.setOn = (v) => { light.intensity = v * 14; glow.material.opacity = v * 0.9; (g.userData.lanternMats || []).forEach((m) => (m.emissiveIntensity = v * 1.5)); };
  return g;
}

/** Simple building block with softened edges (used behind photo plates and for massing). */
export function makeBuilding(w, h, d, mat) {
  const m = rbox(w, h, d, mat, 0.06);
  m.position.y = h / 2;
  return m;
}

/**
 * A Victorian commercial facade (1890s colonial street): plinth, pilasters between the bays, a shopfront with
 * glazing and a signboard, sash windows with moulded heads and sills, a string course between floors, a
 * bracketed cornice with dentils and a parapet. `w` runs along the street (local x), the facade faces +z.
 */
export function makeFacade({ w = 7, h = 9, d = 8, wall, trim, seed = 1, sign = '#3a2a22', glass } = {}) {
  const r = rng(seed);
  const g = new THREE.Group();
  const trimM = trim || new THREE.MeshStandardMaterial({ color: '#ece6d8', roughness: 0.7 });
  const glassM = glass || new THREE.MeshPhysicalMaterial({ color: '#1c2430', roughness: 0.08, metalness: 0.5, reflectivity: 1, clearcoat: 1 });
  const dark = new THREE.MeshStandardMaterial({ color: '#2a2420', roughness: 0.8 });
  const body = rbox(w, h, d, wall, 0.06); body.position.set(0, h / 2, -d / 2); g.add(body);
  const face = 0.0; // facade plane z
  // plinth
  const plinth = rbox(w + 0.1, 0.5, 0.18, dark, 0.03); plinth.position.set(0, 0.25, face + 0.09); g.add(plinth);
  // shopfront: glazing between a stall riser and the fascia, with a recessed door bay
  const bays = Math.max(2, Math.round(w / 2.4));
  const bayW = w / bays;
  const doorBay = Math.floor(r() * bays);
  for (let b = 0; b < bays; b++) {
    const x = -w / 2 + (b + 0.5) * bayW;
    if (b === doorBay) {
      const door = rbox(bayW * 0.55, 2.4, 0.12, dark, 0.02); door.position.set(x, 1.2 + 0.4, face - 0.25); g.add(door);
      const fan = rbox(bayW * 0.55, 0.4, 0.06, glassM, 0.01); fan.position.set(x, 3.0, face - 0.2); g.add(fan);
      const jambL = rbox(0.12, 2.9, 0.4, trimM, 0.02); jambL.position.set(x - bayW * 0.3, 1.85, face - 0.1); g.add(jambL);
      const jambR = jambL.clone(); jambR.position.x = x + bayW * 0.3; g.add(jambR);
    } else {
      const riser = rbox(bayW - 0.3, 0.7, 0.14, trimM, 0.02); riser.position.set(x, 0.85, face + 0.05); g.add(riser);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(bayW - 0.34, 2.0), glassM); pane.position.set(x, 2.25, face + 0.02); g.add(pane);
      const mull = rbox(0.06, 2.0, 0.08, dark, 0.01); mull.position.set(x, 2.25, face + 0.06); g.add(mull);
    }
  }
  const fascia = rbox(w, 0.55, 0.22, new THREE.MeshStandardMaterial({ color: sign, roughness: 0.7 }), 0.03); fascia.position.set(0, 3.55, face + 0.1); g.add(fascia);
  const fasciaTrim = rbox(w + 0.06, 0.08, 0.26, trimM, 0.01); fasciaTrim.position.set(0, 3.86, face + 0.12); g.add(fasciaTrim);
  // upper floors: sash windows in each bay, with heads and sills
  const floors = Math.max(1, Math.floor((h - 4.4) / 3.0));
  const winCols = Math.max(2, Math.round(w / 2.2));
  for (let f = 0; f < floors; f++) {
    const y = 5.4 + f * 3.0;
    for (let c = 0; c < winCols; c++) {
      const x = -w / 2 + (c + 0.5) * (w / winCols);
      const pane = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 1.7), glassM); pane.position.set(x, y, face + 0.01); g.add(pane);
      const mullV = rbox(0.05, 1.7, 0.05, trimM, 0.01); mullV.position.set(x, y, face + 0.03); g.add(mullV);
      const mullH = rbox(0.9, 0.05, 0.05, trimM, 0.01); mullH.position.set(x, y + 0.1, face + 0.03); g.add(mullH);
      const sill = rbox(1.2, 0.1, 0.26, trimM, 0.02); sill.position.set(x, y - 0.92, face + 0.1); g.add(sill);
      const head = rbox(1.25, 0.28, 0.22, trimM, 0.03); head.position.set(x, y + 1.0, face + 0.08); g.add(head);
      if (r() < 0.5) { const ped = new THREE.Mesh(new THREE.CylinderGeometry(0, 0.75, 0.4, 3), trimM); ped.rotation.y = Math.PI / 6; ped.position.set(x, y + 1.33, face + 0.06); ped.scale.z = 0.3; g.add(ped); }
      const surL = rbox(0.12, 1.9, 0.14, trimM, 0.02); surL.position.set(x - 0.55, y, face + 0.05); g.add(surL);
      const surR = surL.clone(); surR.position.x = x + 0.55; g.add(surR);
    }
    // string course between floors
    const course = rbox(w + 0.08, 0.16, 0.2, trimM, 0.02); course.position.set(0, y - 1.5, face + 0.08); g.add(course);
  }
  // pilasters at the corners and between bays
  for (let b = 0; b <= bays; b++) {
    const x = -w / 2 + b * bayW;
    const pil = rbox(0.36, h - 0.6, 0.22, trimM, 0.03); pil.position.set(x, (h - 0.6) / 2 + 0.3, face + 0.06); g.add(pil);
    const cap = rbox(0.5, 0.22, 0.3, trimM, 0.02); cap.position.set(x, h - 0.5, face + 0.1); g.add(cap);
  }
  // cornice with dentils, then a parapet with a central pediment block
  const cornice = rbox(w + 0.5, 0.35, 0.6, trimM, 0.04); cornice.position.set(0, h - 0.15, face + 0.2); g.add(cornice);
  for (let x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.45) { const dent = rbox(0.18, 0.18, 0.2, trimM, 0.01); dent.position.set(x, h - 0.45, face + 0.3); g.add(dent); }
  const parapet = rbox(w + 0.2, 0.9, d + 0.2, wall, 0.04); parapet.position.set(0, h + 0.45, -d / 2); g.add(parapet);
  const coping = rbox(w + 0.3, 0.12, 0.5, trimM, 0.02); coping.position.set(0, h + 0.95, face + 0.1); g.add(coping);
  const pedBlock = rbox(Math.min(2.6, w * 0.4), 0.8, 0.3, trimM, 0.03); pedBlock.position.set(0, h + 1.35, face + 0.05); g.add(pedBlock);
  for (let x = -w / 2 + 0.6; x < w / 2 - 0.4; x += 1.1) { const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.1, 0.5, 10), trimM); bal.position.set(x, h + 1.15, face + 0.05); g.add(bal); }
  // timber verandah over the footpath on turned posts, with a fretwork valance
  const timber = new THREE.MeshStandardMaterial({ color: '#3b2d22', roughness: 0.8 });
  const roof = rbox(w, 0.1, 2.7, timber, 0.02); roof.position.set(0, 3.95, face + 1.4); g.add(roof);
  const valance = rbox(w, 0.42, 0.06, trimM, 0.01); valance.position.set(0, 3.7, face + 2.72); g.add(valance);
  for (let x = -w / 2 + 0.3; x < w / 2 - 0.2; x += 0.5) { const fret = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.3, 6), trimM); fret.position.set(x, 3.4, face + 2.72); g.add(fret); }
  for (const x of [-w / 2 + 0.35, w / 2 - 0.35, ...(w > 6 ? [0] : [])]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 3.7, 10), timber); post.position.set(x, 1.85, face + 2.6); post.castShadow = true; g.add(post);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(0.1, 10, 8), timber); knob.position.set(x, 1.0, face + 2.6); g.add(knob);
    const brace = new THREE.Mesh(new THREE.TorusGeometry(0.4, 0.03, 6, 16, Math.PI / 2), timber); brace.position.set(x, 3.3, face + 2.2); brace.rotation.y = Math.PI / 2; brace.rotation.z = Math.PI; g.add(brace);
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; } });
  g.userData.height = h + 1.75;
  return g;
}

let _windowTex;
function windowTexture(seed = 1, lit = 0.55) {
  const r = rng(seed);
  return canvasTexture(256, 512, (ctx, w, h) => {
    ctx.fillStyle = '#1a1820'; ctx.fillRect(0, 0, w, h);
    for (let y = 0; y < 16; y++) for (let x = 0; x < 6; x++) {
      const on = r() < lit;
      ctx.fillStyle = on ? `rgba(255,${200 + r() * 40},${140 + r() * 60},${0.6 + r() * 0.4})` : 'rgba(40,45,60,0.8)';
      ctx.fillRect(x * 42 + 10, y * 32 + 8, 22, 18);
    }
  }, { repeat: [1, 1] });
}
/** Stepped Art-Deco tower with lit windows and a gilded crown. */
export function makeDecoTower(baseW, height, tiers = 4, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  const stone = assets.pbr('plastered_wall_02', { repeat: [2, 6], color: '#8c8a90' });
  const win = new THREE.MeshStandardMaterial({ map: windowTexture(seed, 0.4 + r() * 0.4), emissive: '#ffd9a0', emissiveMap: windowTexture(seed, 0.4 + r() * 0.4), emissiveIntensity: 1.2, roughness: 0.6 });
  let y = 0, w = baseW;
  for (let i = 0; i < tiers; i++) {
    const h = (height / tiers) * (1 + (r() - 0.5) * 0.4);
    const geo = new THREE.BoxGeometry(w, h, w);
    const m = new THREE.Mesh(geo, [win, win, stone, stone, win, win]);
    m.position.y = y + h / 2; m.castShadow = m.receiveShadow = true; g.add(m);
    // vertical deco ribs on every face, a setback ledge at the top of each tier
    for (const s of [-1, 1]) for (const k of [-0.5, -0.17, 0.17, 0.5]) {
      const rib = rbox(0.16, h, 0.2, stone, 0.03); rib.position.set(k * w, y + h / 2, s * w * 0.5); g.add(rib);
      const rib2 = rbox(0.2, h, 0.16, stone, 0.03); rib2.position.set(s * w * 0.5, y + h / 2, k * w); g.add(rib2);
    }
    const ledge = rbox(w + 0.5, 0.35, w + 0.5, stone, 0.05); ledge.position.y = y + h; g.add(ledge);
    y += h; w *= 0.72;
  }
  const gold = new THREE.MeshStandardMaterial({ color: '#d9c48a', metalness: 0.9, roughness: 0.25, emissive: '#5a4418', emissiveIntensity: 0.5 });
  // stepped crown: three shrinking octagonal drums then a spire
  let cw = w * 0.9;
  for (let k = 0; k < 3; k++) { const drum = new THREE.Mesh(new THREE.CylinderGeometry(cw * 0.5, cw * 0.55, height * 0.04, 8), gold); drum.position.y = y + height * 0.02; drum.castShadow = true; g.add(drum); y += height * 0.04; cw *= 0.72; }
  const crown = new THREE.Mesh(new THREE.ConeGeometry(cw * 0.5, height * 0.14, 8), gold);
  crown.position.y = y + height * 0.07; crown.castShadow = true; g.add(crown);
  const spire = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.06, height * 0.08, 6), gold); spire.position.y = y + height * 0.18; g.add(spire);
  g.userData.height = y + height * 0.22;
  return g;
}

/** Glass office tower. */
export function makeOfficeTower(w, h, d) {
  const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), new THREE.MeshPhysicalMaterial({ color: '#0b0e14', roughness: 0.08, metalness: 0.9, reflectivity: 1, clearcoat: 1 }));
  m.position.y = h / 2; m.castShadow = m.receiveShadow = true;
  const lines = new THREE.LineSegments(new THREE.EdgesGeometry(m.geometry), new THREE.LineBasicMaterial({ color: '#4a5566', transparent: true, opacity: 0.7 }));
  m.add(lines);
  // floor bands
  const bandMat = new THREE.MeshBasicMaterial({ color: '#1e2633' });
  for (let y = 3; y < h; y += 3.5) { const band = new THREE.Mesh(new THREE.BoxGeometry(w + 0.04, 0.12, d + 0.04), bandMat); band.position.y = y - h / 2; m.add(band); }
  return m;
}

/** Green-baize draped table (Assembly Room): a cloth that actually hangs in folds, over turned legs. */
let _baize;
export function makeBaizeTable(w = 1.6, d = 0.9, h = 0.78, seed = 1) {
  const r = rng(seed);
  const g = new THREE.Group();
  _baize ||= new THREE.MeshStandardMaterial({ color: '#163a22', roughness: 1, metalness: 0, side: THREE.DoubleSide });
  const top = rbox(w, 0.04, d, _baize, 0.02); top.position.y = h; g.add(top);
  // skirt: a rounded-rectangle loop of cloth, displaced into vertical folds that swing out toward the hem
  const perim = [];
  const steps = 18, cr = 0.08;
  const corner = (cx, cz, a0) => { for (let i = 0; i <= 4; i++) { const a = a0 + (i / 4) * Math.PI / 2; perim.push([cx + Math.cos(a) * cr, cz + Math.sin(a) * cr]); } };
  const hw = w / 2 - cr, hd = d / 2 - cr;
  corner(hw, hd, 0); corner(-hw, hd, Math.PI / 2); corner(-hw, -hd, Math.PI); corner(hw, -hd, Math.PI * 1.5);
  const skirtH = h * 0.6, rows = 10, cols = perim.length;
  const pos = [], uv = [], idx = [];
  const phase = r() * 6;
  for (let j = 0; j <= rows; j++) {
    const t = j / rows; // 0 top, 1 hem
    for (let i = 0; i < cols; i++) {
      const [x, z] = perim[i];
      const len = Math.hypot(x, z) || 1;
      const fold = Math.sin(i * 1.9 + phase) * 0.028 * t + Math.sin(i * 4.3 + phase * 2) * 0.012 * t;
      const out = 1 + (0.015 + fold) / len * 2;
      pos.push(x * out, h - t * skirtH - (fold > 0 ? 0 : fold * 0.3), z * out);
      uv.push(i / cols, t);
    }
  }
  for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
    const a = j * cols + i, b = j * cols + (i + 1) % cols, c = (j + 1) * cols + i, dd = (j + 1) * cols + (i + 1) % cols;
    idx.push(a, c, b, b, c, dd);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx); geo.computeVertexNormals();
  const skirt = new THREE.Mesh(geo, _baize); skirt.castShadow = skirt.receiveShadow = true; g.add(skirt);
  const legMat = new THREE.MeshStandardMaterial({ color: '#2a1a0e', roughness: 0.6 });
  for (const [x, z] of [[-1, -1], [1, -1], [-1, 1], [1, 1]]) {
    const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new THREE.Vector2(0.025 + 0.02 * Math.sin(t * Math.PI * 3) * (1 - t) + 0.01 * (1 - t), t * h * 0.45)); }
    const leg = new THREE.Mesh(new THREE.LatheGeometry(pts, 10), legMat); leg.position.set(x * (w / 2 - 0.1), 0, z * (d / 2 - 0.1)); leg.castShadow = true; g.add(leg);
  }
  return g;
}

/** Quill pen (procedural). */
export function makeQuill() {
  const quill = new THREE.Group();
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.014, 0.9, 8), new THREE.MeshStandardMaterial({ color: '#c9bca2', roughness: 0.6 })); shaft.position.y = 0.45; quill.add(shaft);
  const vaneGeo = new THREE.PlaneGeometry(0.14, 0.62, 1, 8);
  const vp = vaneGeo.attributes.position; for (let i = 0; i < vp.count; i++) { const y = vp.getY(i); vp.setX(i, vp.getX(i) * (0.4 + 0.6 * (y + 0.31) / 0.62)); vp.setZ(i, Math.sin((y + 0.31) * 4) * 0.02); }
  vaneGeo.computeVertexNormals();
  const vane = new THREE.Mesh(vaneGeo, new THREE.MeshStandardMaterial({ color: '#b9ab92', side: THREE.DoubleSide, roughness: 0.95, transparent: true, opacity: 0.9 })); vane.position.set(0.05, 0.6, 0); quill.add(vane);
  return quill;
}

export function makeScroll(tex) {
  const g = new THREE.Group();
  const paper = new THREE.MeshBasicMaterial({ map: tex, side: THREE.DoubleSide, toneMapped: true });
  const geo = new THREE.PlaneGeometry(1.6, 2.1, 1, 24);
  const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const y = p.getY(i); p.setZ(i, Math.sin(y * 3) * 0.04); }
  geo.computeVertexNormals();
  const sheet = new THREE.Mesh(geo, paper); sheet.castShadow = true; g.add(sheet);
  const wood = new THREE.MeshStandardMaterial({ color: '#4a2d16', roughness: 0.6 });
  for (const y of [1.1, -1.1]) { const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.9, 16), wood); rod.rotation.z = Math.PI / 2; rod.position.y = y; rod.castShadow = true; g.add(rod); }
  return g;
}
