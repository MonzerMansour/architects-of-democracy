#!/usr/bin/env node
/**
 * Builds the web-ready asset set in public/assets/ from the raw downloads in assets-src/
 * (written by fetch-assets.mjs). Everything that ships is small enough for a static host:
 *   images, textures  → WebP (cwebp), capped in size
 *   models            → single .glb, Draco geometry + 1k WebP textures (gltf-transform)
 *   HDRIs             → 512px .hdr for lighting only; visible skies → 4k WebP panoramas
 *
 * Usage: node scripts/optimize-assets.mjs        (skips outputs that already exist)
 *        node scripts/optimize-assets.mjs --force
 * Needs: cwebp (brew install webp), sips (macOS), network for the Poly Haven sky panoramas.
 */
import { mkdir, readdir, stat, copyFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { dirname, join, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'assets-src');
const OUT = join(ROOT, 'public', 'assets');
const FORCE = process.argv.includes('--force');
const UA = 'ArchitectsOfDemocracy/1.0 (student multimodal essay; asset optimizer)';

/** HDRIs whose sky is shown as the scene background (the rest only light the scene). */
export const SKIES = ['kloofendal_48d_partly_cloudy_puresky', 'kloppenheim_06_puresky', 'kloppenheim_03_puresky', 'kiara_1_dawn', 'shanghai_bund'];
const HDRIS = [
  'kloofendal_48d_partly_cloudy_puresky', 'kloppenheim_06_puresky', 'fireplace', 'church_meeting_room', 'old_room',
  'museum_of_ethnography', 'kloppenheim_03_puresky', 'shanghai_bund', 'potsdamer_platz', 'studio_small_09', 'kiara_1_dawn',
];

const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };
const kb = async (p) => `${((await stat(p)).size / 1024).toFixed(0)} KB`;
function run(cmd, args) {
  const r = spawnSync(cmd, args, { encoding: 'utf8' });
  if (r.status !== 0) throw new Error(`${cmd} ${args.join(' ')}\n${r.stderr || r.stdout}`);
  return r.stdout;
}
function dims(file) {
  const out = run('sips', ['-g', 'pixelWidth', '-g', 'pixelHeight', file]);
  return [Number(/pixelWidth: (\d+)/.exec(out)[1]), Number(/pixelHeight: (\d+)/.exec(out)[1])];
}
async function walk(dir) {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) out.push(...(await walk(p))); else out.push(p);
  }
  return out;
}

/** WebP encode, downscaling so the longest side is at most `max`. */
async function webp(src, dest, { max = 2048, q = 82 } = {}) {
  if (!FORCE && (await exists(dest))) return 'skip';
  await mkdir(dirname(dest), { recursive: true });
  const [w, h] = dims(src);
  const args = ['-quiet', '-q', String(q), '-m', '6', '-mt'];
  if (Math.max(w, h) > max) { if (w >= h) args.push('-resize', String(max), '0'); else args.push('-resize', '0', String(max)); }
  run('cwebp', [...args, src, '-o', dest]);
  return kb(dest);
}

async function images() {
  for (const f of await walk(join(SRC, 'images'))) {
    if (!/\.(jpe?g|png)$/i.test(f)) continue;
    const name = basename(f, extname(f));
    const max = /pnyx|map_|cole_|klenze|church_|lemonnier|coste|bierstadt|china|wellington|backdrop/.test(name) ? 3072 : 1600;
    console.log('image', name, await webp(f, join(OUT, 'images', `${name}.webp`), { max, q: max > 2000 ? 80 : 82 }));
  }
}

async function textures() {
  for (const f of await walk(join(SRC, 'textures'))) {
    if (!f.endsWith('.jpg')) continue;
    const rel = f.slice(join(SRC, 'textures').length + 1).replace(/\.jpg$/, '.webp');
    const q = f.includes('_nor_') ? 90 : 84;
    console.log('texture', rel, await webp(f, join(OUT, 'textures', rel), { max: 1024, q }));
  }
}

async function models() {
  const cli = join(ROOT, 'node_modules', '.bin', 'gltf-transform');
  const jobs = [];
  for (const id of await readdir(join(SRC, 'models'))) {
    if (id === 'smithsonian') {
      for (const f of await readdir(join(SRC, 'models', id))) if (f.endsWith('.glb')) jobs.push([join(SRC, 'models', id, f), join(OUT, 'models', id, f)]);
    } else if (await exists(join(SRC, 'models', id, `${id}.gltf`))) {
      jobs.push([join(SRC, 'models', id, `${id}.gltf`), join(OUT, 'models', `${id}.glb`)]);
    }
  }
  for (const [src, dest] of jobs) {
    if (!FORCE && (await exists(dest))) { console.log('model', basename(dest), 'skip'); continue; }
    await mkdir(dirname(dest), { recursive: true });
    run(cli, ['optimize', src, dest, '--compress', 'draco', '--texture-compress', 'webp', '--texture-size', '1024', '--simplify', 'false']);
    console.log('model', basename(dest), await kb(dest));
  }
}

async function download(url, dest) {
  if (!FORCE && (await exists(dest))) return 'skip';
  await mkdir(dirname(dest), { recursive: true });
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} for ${url}`);
  await writeFile(dest, Buffer.from(await res.arrayBuffer()));
  return kb(dest);
}

/* Radiance .hdr: decode (flat or new-style RLE scanlines) → half-res box filter → flat RGBE. */
function readHdr(buf) {
  let p = 0;
  const line = () => { const s = p; while (buf[p] !== 0x0a) p++; return buf.toString('latin1', s, p++); };
  while (line() !== '');
  const [, h, w] = /-Y (\d+) \+X (\d+)/.exec(line()).map(Number);
  const px = new Float32Array(w * h * 3);
  const scan = new Uint8Array(w * 4);
  for (let y = 0; y < h; y++) {
    if (buf[p] === 2 && buf[p + 1] === 2 && !(buf[p + 2] & 0x80)) {
      p += 4;
      for (let c = 0; c < 4; c++) {
        let x = 0;
        while (x < w) {
          let n = buf[p++];
          if (n > 128) { n -= 128; const v = buf[p++]; while (n--) scan[(x++) * 4 + c] = v; }
          else while (n--) scan[(x++) * 4 + c] = buf[p++];
        }
      }
    } else { for (let i = 0; i < w * 4; i++) scan[i] = buf[p++]; }
    for (let x = 0; x < w; x++) {
      const e = scan[x * 4 + 3], f = e ? Math.pow(2, e - 136) : 0, o = (y * w + x) * 3;
      px[o] = scan[x * 4] * f; px[o + 1] = scan[x * 4 + 1] * f; px[o + 2] = scan[x * 4 + 2] * f;
    }
  }
  return { w, h, px };
}
function writeHalfHdr({ w, h, px }) {
  const W = w >> 1, H = h >> 1;
  const head = Buffer.from(`#?RADIANCE\nFORMAT=32-bit_rle_rgbe\n\n-Y ${H} +X ${W}\n`, 'latin1');
  const body = Buffer.alloc(W * H * 4);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const c = [0, 0, 0];
    for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const o = ((y * 2 + dy) * w + x * 2 + dx) * 3; c[0] += px[o]; c[1] += px[o + 1]; c[2] += px[o + 2]; }
    const r = c[0] / 4, g = c[1] / 4, b = c[2] / 4, v = Math.max(r, g, b), o = (y * W + x) * 4;
    if (v < 1e-32) continue;
    const e = Math.ceil(Math.log2(v) + 1e-9), s = 256 / Math.pow(2, e);
    body[o] = Math.min(255, r * s); body[o + 1] = Math.min(255, g * s); body[o + 2] = Math.min(255, b * s); body[o + 3] = e + 128;
  }
  return Buffer.concat([head, body]);
}

async function hdris() {
  const { readFile } = await import('node:fs/promises');
  const ph = async (id) => (await fetch(`https://api.polyhaven.com/files/${id}`, { headers: { 'User-Agent': UA } })).json();
  for (const id of HDRIS) {
    const local = join(SRC, 'hdri', `${id}_1k.hdr`);
    const dest = join(OUT, 'hdri', `${id}.hdr`);
    if (!(await exists(local))) await download((await ph(id)).hdri['1k'].hdr.url, local);
    if (FORCE || !(await exists(dest))) {
      await mkdir(dirname(dest), { recursive: true });
      await writeFile(dest, writeHalfHdr(readHdr(await readFile(local))));
    }
    console.log('hdri', id, await kb(dest));
    if (SKIES.includes(id)) {
      const sky = join(OUT, 'sky', `${id}.webp`);
      if (!FORCE && (await exists(sky))) { console.log('sky', id, 'skip'); continue; }
      const jpg = join(tmpdir(), `${id}_tonemapped.jpg`);
      await download((await ph(id)).tonemapped.url, jpg);
      console.log('sky', id, await webp(jpg, sky, { max: 4096, q: 78 }));
    }
  }
}

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const steps = { images, textures, models, hdris };
for (const [name, fn] of Object.entries(steps)) if (!only.length || only.includes(name)) await fn();
if (await exists(join(SRC, 'CREDITS.md'))) await copyFile(join(SRC, 'CREDITS.md'), join(OUT, 'CREDITS.md'));
console.log('done');
