/**
 * Per-scene cursor effects, drawn on one 2D canvas above the page.
 * Patterns after tholman/cursor-effects (fairy dust, character, ghost, trailing,
 * text flag, springy chain), re-cut to each scene's subject.
 *
 * Effect interface: { emit(p), step(dt, p, t), draw(c, p, t), alive(), cursor? }
 * emit() only runs for the current effect; a retired effect keeps stepping and
 * fades out so particles never pop.
 */

const TAU = Math.PI * 2;
const rnd = (a, b) => a + Math.random() * (b - a);
const pick = (a) => a[(Math.random() * a.length) | 0];
const lerp = (a, b, t) => a + (b - a) * t;
const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
const smooth = (a, b, v) => { const t = clamp((v - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const SERIF = '"Cormorant Garamond", Georgia, serif';

/** Fade in fast, hold, fade out over the last 40% of life. */
const fade = (q) => Math.min(1, q.age * 10) * (1 - smooth(0.6, 1, q.age / q.life));

function glowSprite(size, rgb, core = 0.9) {
  const cv = document.createElement('canvas');
  cv.width = cv.height = size;
  const g = cv.getContext('2d');
  const grd = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  grd.addColorStop(0, `rgba(${rgb},${core})`);
  grd.addColorStop(0.35, `rgba(${rgb},${core * 0.35})`);
  grd.addColorStop(1, `rgba(${rgb},0)`);
  g.fillStyle = grd;
  g.fillRect(0, 0, size, size);
  return cv;
}

function move(q, dt) {
  const d = Math.exp(-(q.drag || 0) * dt);
  q.vx *= d; q.vy *= d;
  q.vy += (q.g || 0) * dt;
  q.x += q.vx * dt; q.y += q.vy * dt;
  q.rot = (q.rot || 0) + (q.spin || 0) * dt;
}

/** Distance-based emitter: one spawn every `spacing` px of pointer travel. */
function emitter(spacing, spawn, max = 260) {
  const list = [];
  let acc = 0;
  return {
    list,
    emit(p) {
      acc += p.dist;
      if (acc < spacing) return;
      const n = Math.min(6, Math.floor(acc / spacing));
      for (let i = 0; i < n; i++) {
        const f = (i + 1) / n;
        list.push(spawn(lerp(p.px, p.x, f), lerp(p.py, p.y, f), p));
      }
      acc = acc > spacing * 6 ? 0 : acc - n * spacing;
      if (list.length > max) list.splice(0, list.length - max);
    },
    step(dt) {
      for (let i = list.length - 1; i >= 0; i--) {
        const q = list[i];
        q.age += dt;
        if (q.age >= q.life) { list.splice(i, 1); continue; }
        if (q.sway) q.vx += Math.sin(q.age * q.sway + q.ph) * 34 * dt;
        move(q, dt);
      }
    },
    alive: () => list.length > 0,
  };
}

/** Pointer history for ribbon-style effects; shrinks from the tail when idle. */
function trail(minStep, maxPts) {
  const pts = [];
  let drain = 0;
  return {
    pts,
    emit(p) {
      const last = pts[0];
      if (!last || Math.hypot(p.x - last.x, p.y - last.y) >= minStep) pts.unshift({ x: p.x, y: p.y, age: 0, v: p.speed });
      if (pts.length > maxPts) pts.length = maxPts;
    },
    step(dt, p, idleAfter = 0.08, rate = 70) {
      for (const q of pts) q.age += dt;
      if (!p.active || p.idle > idleAfter) {
        drain += dt * rate;
        while (drain >= 1 && pts.length) { pts.pop(); drain -= 1; }
      } else drain = 0;
    },
    alive: () => pts.length > 1,
  };
}

/* ================================================================== effects */

/** 1 · Pnyx Hill: silvery olive leaves shaken loose, flipping as they fall. */
function oliveLeaves() {
  const e = emitter(30, (x, y, p) => ({
    x, y, vx: p.vx * 0.06 + rnd(-20, 20), vy: p.vy * 0.06 + rnd(-14, 6), g: 34, drag: 1.5, sway: 2.4,
    age: 0, life: rnd(2.2, 3.2), rot: Math.atan2(p.vy, p.vx) + rnd(-0.7, 0.7), spin: rnd(-1.4, 1.4),
    len: rnd(8, 13), col: pick(['#66744c', '#7f8d63', '#9ea684']), ph: rnd(0, TAU),
  }));
  return {
    ...e,
    draw(c) {
      for (const q of e.list) {
        c.save();
        c.globalAlpha = fade(q) * 0.9;
        c.translate(q.x, q.y);
        c.rotate(q.rot);
        c.scale(1, 0.35 + 0.65 * Math.abs(Math.cos(q.age * 2.2 + q.ph)));
        c.fillStyle = q.col;
        c.beginPath();
        c.ellipse(0, 0, q.len, q.len * 0.26, 0, 0, TAU);
        c.fill();
        c.strokeStyle = 'rgba(225,228,205,0.55)';
        c.lineWidth = 0.6;
        c.beginPath(); c.moveTo(-q.len * 0.85, 0); c.lineTo(q.len * 0.85, 0); c.stroke();
        c.restore();
      }
    },
  };
}

/** 2 · The word: the letters of δημοκρατία shed from the cursor like carved type. */
function greekLetters() {
  const word = 'ΔΗΜΟΚΡΑΤΙΑ';
  let k = 0;
  const e = emitter(26, (x, y, p) => ({
    x, y, ch: word[k++ % word.length], vx: p.vx * 0.05 + rnd(-12, 12), vy: rnd(-26, -8), g: 46, drag: 1.2,
    age: 0, life: rnd(1.4, 2), rot: rnd(-0.3, 0.3), spin: rnd(-0.8, 0.8), s: rnd(18, 26),
  }));
  return {
    ...e,
    draw(c) {
      c.textAlign = 'center'; c.textBaseline = 'middle';
      for (const q of e.list) {
        const u = q.age / q.life;
        c.save();
        c.globalAlpha = fade(q) * 0.85;
        c.translate(q.x, q.y); c.rotate(q.rot);
        c.font = `500 ${(q.s * (1 - u * 0.35)).toFixed(1)}px ${SERIF}`;
        c.fillStyle = 'rgba(255,248,232,0.7)';
        c.fillText(q.ch, 0.8, 0.8);
        c.fillStyle = '#4e3b27';
        c.fillText(q.ch, 0, 0);
        c.restore();
      }
    },
  };
}

/** 3 · The fracture: hairline cracks race out from the cursor, a red seam inside. */
function cracks() {
  const list = [];
  let acc = 0;
  function crack(x, y, dir, steps) {
    const pts = [[x, y]];
    let a = dir;
    for (let i = 0; i < steps; i++) {
      a += rnd(-0.7, 0.7);
      const l = rnd(8, 20) * (1 - i / (steps + 2));
      x += Math.cos(a) * l; y += Math.sin(a) * l;
      pts.push([x, y]);
    }
    return pts;
  }
  return {
    emit(p) {
      acc += p.dist;
      if (acc < 20) return;
      acc = 0;
      const side = Math.random() < 0.5 ? 1 : -1;
      const dir = Math.atan2(p.vy, p.vx) + side * Math.PI / 2 + rnd(-0.6, 0.6);
      const main = crack(p.x, p.y, dir, (rnd(3, 7)) | 0);
      const branch = Math.random() < 0.5 ? crack(main[2][0], main[2][1], dir + side * rnd(0.5, 1.1), 3) : null;
      list.push({ main, branch, age: 0, life: 1.8 });
      if (list.length > 60) list.shift();
    },
    step(dt) {
      for (let i = list.length - 1; i >= 0; i--) if ((list[i].age += dt) > list[i].life) list.splice(i, 1);
    },
    draw(c) {
      c.lineCap = 'round'; c.lineJoin = 'round';
      const path = (pts, grow) => {
        const n = Math.max(2, Math.ceil(pts.length * grow));
        c.beginPath(); c.moveTo(pts[0][0], pts[0][1]);
        for (let i = 1; i < n; i++) c.lineTo(pts[i][0], pts[i][1]);
        c.stroke();
      };
      for (const q of list) {
        const a = fade(q), grow = Math.min(1, q.age / 0.2);
        c.strokeStyle = `rgba(52,30,20,${a * 0.9})`; c.lineWidth = 2.2;
        path(q.main, grow); if (q.branch && grow >= 1) path(q.branch, Math.min(1, (q.age - 0.2) / 0.15));
        c.strokeStyle = `rgba(190,46,30,${a})`; c.lineWidth = 0.9;
        path(q.main, grow);
      }
    },
    alive: () => list.length > 0,
  };
}

/** 4 · Across time and space: gold rings echo behind the cursor, each a step later in time. */
function echoes() {
  const n = 14;
  const rings = Array.from({ length: n }, () => ({ x: -100, y: -100 }));
  let vis = 0, primed = false;
  return {
    blend: 'screen',
    emit() {},
    step(dt, p) {
      if (!primed && p.seen) { for (const r of rings) { r.x = p.x; r.y = p.y; } primed = true; }
      const k = 1 - Math.exp(-dt * 16);
      rings[0].x = lerp(rings[0].x, p.x, 1 - Math.exp(-dt * 40));
      rings[0].y = lerp(rings[0].y, p.y, 1 - Math.exp(-dt * 40));
      for (let i = 1; i < n; i++) { rings[i].x = lerp(rings[i].x, rings[i - 1].x, k); rings[i].y = lerp(rings[i].y, rings[i - 1].y, k); }
      vis = lerp(vis, p.active ? 1 - smooth(2, 4, p.idle) * 0.6 : 0, 1 - Math.exp(-dt * 5));
    },
    draw(c, p, t) {
      for (let i = n - 1; i >= 0; i--) {
        const r = rings[i];
        c.strokeStyle = `rgba(232,196,120,${vis * 0.85 * (1 - i / n)})`;
        c.lineWidth = i === 0 ? 2 : 1.4;
        c.beginPath(); c.arc(r.x, r.y, 6 + i * 2.4 + Math.sin(t * 2 - i * 0.5) * 0.8, 0, TAU); c.stroke();
      }
    },
    alive: () => vis > 0.01,
  };
}

/** 5 · The Americas: embers lift off the burning map and drift on the heat. */
function embers() {
  const glow = glowSprite(32, '255,140,60');
  const e = emitter(6, (x, y, p) => ({
    x: x + rnd(-5, 5), y, vx: p.vx * 0.04 + rnd(-14, 14), vy: rnd(-80, -30), g: -22, drag: 0.9, sway: 6,
    age: 0, life: rnd(1, 2.1), r: rnd(1.4, 3), ph: rnd(0, TAU), ash: Math.random() < 0.18,
  }));
  return {
    ...e,
    blend: 'screen',
    draw(c, p, t) {
      for (const q of e.list) {
        const u = q.age / q.life, a = fade(q) * (0.7 + 0.3 * Math.sin(t * 28 + q.ph));
        if (q.ash) {
          c.globalAlpha = a * 0.5; c.fillStyle = '#6e6660';
          c.fillRect(q.x, q.y, q.r * 1.6, q.r);
          continue;
        }
        c.globalCompositeOperation = 'lighter';
        c.globalAlpha = a * 0.55 * (1 - u);
        c.drawImage(glow, q.x - q.r * 6, q.y - q.r * 6, q.r * 12, q.r * 12);
        c.globalAlpha = a;
        c.fillStyle = u < 0.3 ? '#ffe3a6' : u < 0.65 ? '#ff9a48' : '#b8401c';
        c.beginPath(); c.arc(q.x, q.y, q.r * (1 - u * 0.5), 0, TAU); c.fill();
        c.globalCompositeOperation = 'source-over';
      }
      c.globalAlpha = 1;
    },
  };
}

/** 6 · Independence Hall: an iron-gall quill line, thin when fast, a blot where it stops. */
function quill() {
  const tr = trail(2, 120);
  const blots = [];
  let run = 0;
  return {
    emit(p) { tr.emit(p); run += p.dist; },
    step(dt, p) {
      tr.step(dt, p, 0.9, 50);
      for (let i = tr.pts.length - 1; i >= 0; i--) if (tr.pts[i].age > 1.6) tr.pts.splice(i, 1);
      if (p.idle > 0.12 && run > 140) {
        blots.push({ x: p.x, y: p.y, age: 0, life: 2.4, r: rnd(2.6, 4), drops: Array.from({ length: 3 }, () => [rnd(-9, 9), rnd(-9, 9), rnd(0.6, 1.4)]) });
        run = 0;
      }
      if (p.idle > 0.12) run = 0;
      for (let i = blots.length - 1; i >= 0; i--) if ((blots[i].age += dt) > blots[i].life) blots.splice(i, 1);
    },
    draw(c) {
      const pts = tr.pts;
      c.lineCap = 'round';
      for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const w = clamp(5 - (a.v + b.v) * 0.001, 1.4, 5);
        c.strokeStyle = `rgba(34,22,12,${0.9 * (1 - smooth(0.9, 1.6, b.age))})`;
        c.lineWidth = w;
        c.beginPath(); c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke();
      }
      for (const q of blots) {
        c.fillStyle = `rgba(32,22,14,${fade(q) * 0.85})`;
        const grow = Math.min(1, q.age / 0.12);
        c.beginPath(); c.arc(q.x, q.y, q.r * grow, 0, TAU); c.fill();
        for (const [dx, dy, r] of q.drops) { c.beginPath(); c.arc(q.x + dx * grow, q.y + dy * grow, r, 0, TAU); c.fill(); }
      }
    },
    alive: () => tr.alive() || blots.length > 0,
  };
}

/** 7 · The Enlightenment: you carry the candle; a warm pool of light that flickers, motes rising. */
function candle() {
  const halo = glowSprite(256, '255,176,96', 0.5);
  const mote = glowSprite(16, '255,214,150');
  const g = { x: -999, y: -999 };
  let vis = 0, idleSpawn = 0;
  const e = emitter(36, (x, y) => ({ x: x + rnd(-10, 10), y: y + rnd(-4, 4), vx: rnd(-6, 6), vy: rnd(-30, -14), drag: 0.4, sway: 3, age: 0, life: rnd(1.4, 2.4), ph: rnd(0, TAU), r: rnd(1.5, 3) }));
  return {
    ...e,
    blend: 'screen',
    step(dt, p) {
      if (g.x < -900 && p.seen) { g.x = p.x; g.y = p.y; }
      g.x = lerp(g.x, p.x, 1 - Math.exp(-dt * 9));
      g.y = lerp(g.y, p.y, 1 - Math.exp(-dt * 9));
      vis = lerp(vis, p.active ? 1 : 0, 1 - Math.exp(-dt * 3));
      if (p.active && (idleSpawn += dt) > 0.35) { idleSpawn = 0; e.list.push({ x: g.x + rnd(-8, 8), y: g.y - 6, vx: rnd(-4, 4), vy: rnd(-26, -12), drag: 0.4, sway: 3, age: 0, life: rnd(1.4, 2.2), ph: rnd(0, TAU), r: rnd(1.5, 2.5) }); }
      e.step(dt);
    },
    draw(c, p, t) {
      const f = 1 + Math.sin(t * 11) * 0.05 + Math.sin(t * 23 + 1.3) * 0.035 + Math.sin(t * 5.7) * 0.03;
      const R = 150 * f;
      c.globalCompositeOperation = 'lighter';
      c.globalAlpha = vis;
      c.drawImage(halo, g.x - R, g.y - R * 1.08, R * 2, R * 2);
      c.globalAlpha = vis * 0.85;
      c.drawImage(mote, g.x - 6 * f, g.y - 9 * f, 12 * f, 16 * f);
      for (const q of e.list) {
        c.globalAlpha = fade(q) * 0.8 * vis;
        c.drawImage(mote, q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
      }
      c.globalCompositeOperation = 'source-over';
      c.globalAlpha = 1;
    },
    alive: () => vis > 0.01,
  };
}

/** 8 · Of the men: a double helix unwinds behind the cursor, two strands, rungs between. */
function helix() {
  const tr = trail(5, 70);
  return {
    blend: 'screen',
    emit: (p) => tr.emit(p),
    step: (dt, p) => tr.step(dt, p, 0.15, 40),
    draw(c, p, t) {
      const pts = tr.pts, n = pts.length;
      for (let i = 1; i < n; i++) {
        const a = pts[i - 1], b = pts[i];
        const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
        const nx = -dy / l, ny = dx / l;
        const ph = t * 3.2 - i * 0.32, off = Math.sin(ph) * 15 * smooth(0, 6, i), depth = Math.cos(ph);
        const fadeI = 1 - i / n;
        const ax = b.x + nx * off, ay = b.y + ny * off, bx = b.x - nx * off, by = b.y - ny * off;
        if (i % 2 === 0) {
          c.strokeStyle = `rgba(220,220,235,${0.35 * fadeI})`; c.lineWidth = 1;
          c.beginPath(); c.moveTo(ax, ay); c.lineTo(bx, by); c.stroke();
        }
        c.fillStyle = `rgba(160,196,240,${(0.65 + 0.35 * depth) * fadeI})`;
        c.beginPath(); c.arc(ax, ay, 2.4 + depth * 1, 0, TAU); c.fill();
        c.fillStyle = `rgba(240,184,204,${(0.65 - 0.35 * depth) * fadeI})`;
        c.beginPath(); c.arc(bx, by, 2.4 - depth * 1, 0, TAU); c.fill();
      }
    },
    alive: () => tr.alive(),
  };
}

/** 9 · The thinkers' gallery: a loaded oil brush — ochre bristle lines that dry out along the stroke. */
function oilBrush() {
  const tr = trail(3, 70);
  const bristles = Array.from({ length: 9 }, (_, i) => ({
    off: (i - 4) * 2.7 + rnd(-0.7, 0.7), w: rnd(1.6, 3.4), dry: rnd(0.3, 1),
    col: pick(['184,134,59', '138,90,43', '214,168,90', '110,69,36', '196,150,78']),
  }));
  return {
    emit: (p) => tr.emit(p),
    step(dt, p) {
      tr.step(dt, p, 0.6, 45);
      for (let i = tr.pts.length - 1; i >= 0; i--) if (tr.pts[i].age > 1.8) tr.pts.splice(i, 1);
    },
    draw(c) {
      const pts = tr.pts, n = pts.length;
      if (n < 3) return;
      const norms = pts.map((q, i) => {
        const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n - 1, i + 1)];
        const dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
        return [-dy / l, dx / l];
      });
      c.lineCap = 'round';
      for (const br of bristles) {
        c.lineWidth = br.w;
        for (let i = 1; i < n; i++) {
          const u = i / n;
          const load = 1 - smooth(0.25, 1, u * br.dry + u * 0.4);
          const a = load * (1 - smooth(1.1, 1.8, pts[i].age)) * 0.8;
          if (a < 0.02) continue;
          const taper = smooth(0, 4, i) * (1 - u * 0.35);
          const o0 = br.off * taper, o1 = br.off * smooth(0, 4, i - 1) * (1 - (i - 1) / n * 0.35);
          c.strokeStyle = `rgba(${br.col},${a})`;
          c.beginPath();
          c.moveTo(pts[i - 1].x + norms[i - 1][0] * o1, pts[i - 1].y + norms[i - 1][1] * o1);
          c.lineTo(pts[i].x + norms[i][0] * o0, pts[i].y + norms[i][1] * o0);
          c.stroke();
        }
      }
    },
    alive: () => tr.alive(),
  };
}

/** 10 · Lambton Quay: white camellias, the suffragists' flower — petals tumbling from the cursor. */
function camellias() {
  const e = emitter(34, (x, y, p) => ({
    x, y, vx: p.vx * 0.05 + rnd(-24, 24), vy: rnd(-16, 10), g: 28, drag: 1.4, sway: 2,
    age: 0, life: rnd(2.6, 3.6), rot: rnd(0, TAU), spin: rnd(-1.8, 1.8), s: rnd(8, 13), ph: rnd(0, TAU),
  }));
  return {
    ...e,
    draw(c) {
      for (const q of e.list) {
        const s = q.s;
        c.save();
        c.globalAlpha = fade(q);
        c.translate(q.x, q.y); c.rotate(q.rot);
        c.scale(1, 0.3 + 0.7 * Math.abs(Math.cos(q.age * 2.6 + q.ph)));
        c.beginPath();
        c.moveTo(0, -s);
        c.bezierCurveTo(s * 1.05, -s * 0.7, s * 0.85, s * 0.8, 0, s);
        c.bezierCurveTo(-s * 0.85, s * 0.8, -s * 1.05, -s * 0.7, 0, -s);
        c.fillStyle = '#fcf8f0'; c.fill();
        c.strokeStyle = 'rgba(140,100,90,0.45)'; c.lineWidth = 0.7; c.stroke();
        c.fillStyle = 'rgba(232,170,170,0.5)';
        c.beginPath(); c.ellipse(0, s * 0.55, s * 0.3, s * 0.25, 0, 0, TAU); c.fill();
        c.restore();
      }
    },
  };
}

/** 11 · 18 August 1920: ticker tape in suffrage purple, white and gold, fluttering down. */
function tickerTape() {
  const e = emitter(13, (x, y, p) => ({
    x, y, vx: p.vx * 0.08 + rnd(-40, 40), vy: rnd(-70, -15), g: 70, drag: 2, sway: 5,
    age: 0, life: rnd(1.8, 2.6), rot: rnd(0, TAU), spin: rnd(-4, 4), w: rnd(4, 6), h: rnd(14, 22), ph: rnd(0, TAU),
    col: pick(['#7a4aa0', '#f2ede2', '#e3b84c', '#7a4aa0', '#f2ede2']),
  }));
  return {
    ...e,
    draw(c) {
      for (const q of e.list) {
        c.save();
        c.globalAlpha = fade(q) * 0.95;
        c.translate(q.x, q.y); c.rotate(q.rot);
        c.scale(Math.cos(q.age * 9 + q.ph), 1);
        c.fillStyle = q.col;
        c.fillRect(-q.w / 2, -q.h / 2, q.w, q.h);
        c.restore();
      }
    },
  };
}

/** 12 · The specters: the cursor leaves cold smoke that swells and thins as it rises. */
function specters() {
  const puff = glowSprite(96, '196,202,214', 0.55);
  const e = emitter(7, (x, y, p) => ({
    x: x + rnd(-3, 3), y: y + rnd(-3, 3), vx: p.vx * 0.03 + rnd(-8, 8), vy: rnd(-24, -8), drag: 0.6, sway: 1.6,
    age: 0, life: rnd(1.3, 2.1), r0: rnd(7, 12), r1: rnd(32, 52), ph: rnd(0, TAU),
  }), 220);
  return {
    ...e,
    draw(c) {
      for (const q of e.list) {
        const u = q.age / q.life, r = lerp(q.r0, q.r1, Math.sqrt(u));
        c.globalAlpha = 0.28 * (1 - u) * Math.min(1, q.age * 6);
        c.drawImage(puff, q.x - r, q.y - r, r * 2, r * 2);
      }
      c.globalAlpha = 1;
    },
  };
}

/** 13 · So we shall rewrite: the verbs of the rewrite ride the cursor's path as a ribbon of type. */
function typeRibbon() {
  const text = 'we shall rewrite · revise · reclaim · rebuild · ';
  const tr = trail(3, 140);
  let widths = null;
  return {
    emit: (p) => tr.emit(p),
    step: (dt, p) => tr.step(dt, p, 0.25, 90),
    draw(c) {
      const pts = tr.pts;
      if (pts.length < 2) return;
      c.font = `italic 600 27px ${SERIF}`;
      if (!widths) widths = [...text].map((ch) => c.measureText(ch).width);
      c.textBaseline = 'middle'; c.textAlign = 'left';
      let seg = 0, segPos = 0, d = 4;
      for (let k = text.length - 1; k >= 0; k--) {
        const w = widths[k];
        d += w;
        while (seg < pts.length - 1) {
          const sl = Math.hypot(pts[seg + 1].x - pts[seg].x, pts[seg + 1].y - pts[seg].y);
          if (segPos + sl >= d) break;
          segPos += sl; seg++;
        }
        if (seg >= pts.length - 1) break;
        const a = pts[seg], b = pts[seg + 1];
        const sl = Math.hypot(b.x - a.x, b.y - a.y) || 1, f = (d - segPos) / sl;
        const x = lerp(a.x, b.x, f), y = lerp(a.y, b.y, f);
        let ang = Math.atan2(a.y - b.y, a.x - b.x);
        c.save();
        c.translate(x, y); c.rotate(ang);
        c.globalAlpha = 1 - smooth(0.7, 1, (text.length - k) / text.length);
        c.fillStyle = '#f4e3b8';
        c.fillText(text[k], 0, 0);
        c.restore();
      }
    },
    alive: () => tr.alive(),
  };
}

/** 14 · Replacements: an iron chain hangs from the cursor — swing hard enough and it snaps. */
function chain() {
  const n = 13, L = 13;
  let links = null, born = 0, broken = [], respawn = 0;
  const reset = (p) => { links = Array.from({ length: n }, (_, i) => ({ x: p.x, y: p.y + i * L, px: p.x, py: p.y + i * L })); born = 0; };
  return {
    emit() {},
    step(dt, p) {
      if (!p.seen) return;
      if (!links && (respawn -= dt) <= 0) reset(p);
      if (links) {
        born += dt;
        links[0].x = links[0].px = p.x; links[0].y = links[0].py = p.y;
        for (let i = 1; i < n; i++) {
          const q = links[i], vx = (q.x - q.px) * 0.985, vy = (q.y - q.py) * 0.985;
          q.px = q.x; q.py = q.y;
          q.x += vx; q.y += vy + 1100 * dt * dt;
        }
        for (let it = 0; it < 4; it++) for (let i = 1; i < n; i++) {
          const a = links[i - 1], b = links[i], dx = b.x - a.x, dy = b.y - a.y, l = Math.hypot(dx, dy) || 1;
          const diff = (l - L) / l;
          if (i === 1) { b.x -= dx * diff; b.y -= dy * diff; }
          else { a.x += dx * diff * 0.5; a.y += dy * diff * 0.5; b.x -= dx * diff * 0.5; b.y -= dy * diff * 0.5; }
        }
        if (Math.hypot(p.vx, p.vy) > 3000 && born > 0.8) {
          broken = links.slice(1).map((q, i) => ({
            x: q.x, y: q.y, vx: (q.x - q.px) / dt * 0.6 + rnd(-60, 60), vy: (q.y - q.py) / dt * 0.6 + rnd(-80, 0),
            g: 900, drag: 0.4, rot: rnd(0, TAU), spin: rnd(-8, 8), age: 0, life: rnd(0.9, 1.4), face: i % 2,
          }));
          links = null; respawn = 0.9;
        }
      }
      for (let i = broken.length - 1; i >= 0; i--) { const q = broken[i]; q.age += dt; if (q.age > q.life) { broken.splice(i, 1); continue; } move(q, dt); }
    },
    draw(c) {
      const link = (x, y, ang, face, a) => {
        c.save(); c.translate(x, y); c.rotate(ang);
        c.strokeStyle = `rgba(176,170,160,${a})`; c.lineWidth = 2.8;
        c.beginPath(); c.ellipse(0, 0, L * 0.72, face ? 4.6 : 1.4, 0, 0, TAU); c.stroke();
        c.strokeStyle = `rgba(240,234,222,${a * 0.8})`; c.lineWidth = 0.9;
        c.beginPath(); c.ellipse(0, -0.8, L * 0.6, face ? 3.4 : 0.7, 0, Math.PI, TAU); c.stroke();
        c.restore();
      };
      if (links) {
        const a = Math.min(1, born * 4) * 0.9;
        for (let i = 1; i < n; i++) {
          const p0 = links[i - 1], p1 = links[i];
          link((p0.x + p1.x) / 2, (p0.y + p1.y) / 2, Math.atan2(p1.y - p0.y, p1.x - p0.x), i % 2, a);
        }
      }
      for (const q of broken) link(q.x, q.y, q.rot, q.face, fade(q) * 0.9);
    },
    alive: () => !!links || broken.length > 0,
  };
}

/** 15 · The architects: drafting crosshair, coordinates, and a measured survey line. */
function blueprint() {
  const nodes = [];
  let acc = 0, vis = 0;
  return {
    cursor: 'crosshair',
    emit(p) {
      acc += p.dist;
      if (acc < 70 && nodes.length) return;
      acc = 0;
      nodes.push({ x: p.x, y: p.y, age: 0, life: 2.2 });
      if (nodes.length > 24) nodes.shift();
    },
    step(dt, p) {
      vis = lerp(vis, p.active ? 1 : 0, 1 - Math.exp(-dt * 6));
      for (let i = nodes.length - 1; i >= 0; i--) if ((nodes[i].age += dt) > nodes[i].life) nodes.splice(i, 1);
    },
    draw(c, p) {
      const W = window.innerWidth, H = window.innerHeight;
      c.lineWidth = 1;
      c.strokeStyle = `rgba(170,222,255,${0.16 * vis})`;
      c.setLineDash([3, 7]);
      c.beginPath(); c.moveTo(0, p.y + 0.5); c.lineTo(W, p.y + 0.5); c.moveTo(p.x + 0.5, 0); c.lineTo(p.x + 0.5, H); c.stroke();
      c.setLineDash([]);
      c.strokeStyle = `rgba(205,240,255,${0.8 * vis})`;
      c.beginPath(); c.arc(p.x, p.y, 9, 0, TAU); c.stroke();
      c.font = '10px "Inter", system-ui, sans-serif';
      c.fillStyle = `rgba(205,240,255,${0.7 * vis})`;
      c.textAlign = 'left'; c.textBaseline = 'top';
      c.fillText(`x ${String(Math.round(p.x)).padStart(4, '0')}   y ${String(Math.round(p.y)).padStart(4, '0')}`, p.x + 14, p.y + 12);
      c.textAlign = 'center'; c.textBaseline = 'bottom';
      for (let i = 0; i < nodes.length; i++) {
        const q = nodes[i], a = fade(q);
        c.strokeStyle = `rgba(205,240,255,${0.75 * a})`;
        c.strokeRect(q.x - 2.5, q.y - 2.5, 5, 5);
        const nx = nodes[i + 1] || null;
        if (!nx) continue;
        const l = Math.hypot(nx.x - q.x, nx.y - q.y);
        c.strokeStyle = `rgba(170,222,255,${0.45 * a})`;
        c.beginPath(); c.moveTo(q.x, q.y); c.lineTo(nx.x, nx.y); c.stroke();
        c.fillStyle = `rgba(205,240,255,${0.55 * a})`;
        c.fillText(`${(l / 24).toFixed(1)} m`, (q.x + nx.x) / 2, (q.y + nx.y) / 2 - 4);
      }
    },
    alive: () => vis > 0.01 || nodes.length > 0,
  };
}

/** 16 · Feminism is democracy: warm sunlit motes rise wherever the cursor goes. */
function sunMotes() {
  const sp = glowSprite(32, '200,128,30', 1);
  const e = emitter(8, (x, y, p) => ({
    x: x + rnd(-8, 8), y: y + rnd(-8, 8), vx: p.vx * 0.03 + rnd(-10, 10), vy: rnd(-34, -10), drag: 0.6, sway: 2.2,
    age: 0, life: rnd(1.6, 2.8), r: rnd(5, 12), ph: rnd(0, TAU),
  }));
  return {
    ...e,
    draw(c, p, t) {
      for (const q of e.list) {
        c.globalAlpha = fade(q) * (0.75 + 0.25 * Math.sin(t * 5 + q.ph));
        c.drawImage(sp, q.x - q.r, q.y - q.r, q.r * 2, q.r * 2);
      }
      c.globalAlpha = 1;
    },
  };
}

const EFFECTS = [
  oliveLeaves, greekLetters, cracks, echoes, embers, quill, candle, helix,
  oilBrush, camellias, tickerTape, specters, typeRibbon, chain, blueprint, sunMotes,
];

/* ================================================================== layer */

export class CursorFX {
  constructor() {
    this.enabled = !window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.current = null;
    this.index = -1;
    this.retired = [];
    this.p = { x: -999, y: -999, px: -999, py: -999, vx: 0, vy: 0, speed: 0, dist: 0, idle: 99, seen: false, active: false };
    if (!this.enabled) return;

    this.canvas = document.createElement('canvas');
    this.canvas.id = 'cursor-fx';
    document.body.appendChild(this.canvas);
    this.c = this.canvas.getContext('2d');
    this.resize();
    window.addEventListener('resize', () => this.resize());

    const p = this.p;
    window.addEventListener('pointermove', (e) => {
      if (e.pointerType === 'touch') return;
      if (!p.seen) { p.px = e.clientX; p.py = e.clientY; }
      p.x = e.clientX; p.y = e.clientY;
      p.seen = true; p.active = true; p.idle = 0;
    }, { passive: true });
    document.documentElement.addEventListener('pointerleave', () => { p.active = false; });
  }

  resize() {
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(window.innerWidth * this.dpr);
    this.canvas.height = Math.round(window.innerHeight * this.dpr);
  }

  set(i) {
    if (!this.enabled || i === this.index) return;
    if (this.current) this.retired.push({ fx: this.current, a: 1 });
    this.index = i;
    this.current = EFFECTS[i] ? EFFECTS[i]() : null;
    document.body.style.cursor = this.current?.cursor || '';
    this.canvas.style.mixBlendMode = this.current?.blend || '';
  }

  tick(dt, t) {
    if (!this.enabled) return;
    const p = this.p, c = this.c;
    p.dist = Math.hypot(p.x - p.px, p.y - p.py);
    const ivx = (p.x - p.px) / Math.max(dt, 1e-3), ivy = (p.y - p.py) / Math.max(dt, 1e-3);
    const k = 1 - Math.exp(-dt * 20);
    p.vx = lerp(p.vx, ivx, k); p.vy = lerp(p.vy, ivy, k);
    p.speed = Math.hypot(ivx, ivy);
    if (p.dist < 0.5) p.idle += dt;

    c.setTransform(1, 0, 0, 1, 0, 0);
    c.clearRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

    for (let i = this.retired.length - 1; i >= 0; i--) {
      const r = this.retired[i];
      r.a -= dt / 0.7;
      if (r.a <= 0 || !r.fx.alive()) { this.retired.splice(i, 1); continue; }
      r.fx.step(dt, p, t);
      // effects set their own globalAlpha, so a retiring one is drawn offscreen and composited faded
      const b = this.buffer();
      b.setTransform(1, 0, 0, 1, 0, 0);
      b.clearRect(0, 0, b.canvas.width, b.canvas.height);
      b.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      b.save(); r.fx.draw(b, p, t); b.restore();
      c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = r.a; c.drawImage(b.canvas, 0, 0); c.restore();
    }
    const fx = this.current;
    if (fx) {
      if (p.active && p.seen && p.dist > 0.5) fx.emit(p);
      fx.step(dt, p, t);
      c.save(); fx.draw(c, p, t); c.restore();
    }
    p.px = p.x; p.py = p.y;
  }

  buffer() {
    if (!this.buf) this.buf = document.createElement('canvas').getContext('2d');
    if (this.buf.canvas.width !== this.canvas.width || this.buf.canvas.height !== this.canvas.height) {
      this.buf.canvas.width = this.canvas.width;
      this.buf.canvas.height = this.canvas.height;
    }
    return this.buf;
  }
}
