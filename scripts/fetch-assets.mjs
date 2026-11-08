#!/usr/bin/env node
/**
 * Downloads every external asset the experience uses into public/assets/.
 * All sources are CC0 / public domain / "no known restrictions":
 *   - Poly Haven (polyhaven.com)            HDRIs, PBR textures, glTF models  (CC0)
 *   - Smithsonian Open Access (3d.si.edu)   3D scans                          (CC0)
 *   - Wikimedia Commons                     public-domain paintings, photos, maps
 *
 * Usage:  node scripts/fetch-assets.mjs            (skips files that already exist)
 *         node scripts/fetch-assets.mjs --force
 */
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'assets-src'); // raw downloads; scripts/optimize-assets.mjs builds public/assets from these
const FORCE = process.argv.includes('--force');
const UA = 'ArchitectsOfDemocracy/1.0 (student multimodal essay; asset fetcher)';

/* ------------------------------------------------------------------ manifest */
export const HDRIS = [
  // id, resolution, used for
  ['kloofendal_48d_partly_cloudy_puresky', '2k', 'Scene 1 — Pnyx Hill sky'],
  ['kloppenheim_06_puresky', '2k', 'Scenes 2–3 — ruins at golden hour'],
  ['kloppenheim_02_puresky', '1k', 'Scenes 4, 8, 15 — night sky'],
  ['fireplace', '1k', 'Scene 5 — candle-lit map room lighting'],
  ['church_meeting_room', '1k', 'Scene 6 — Assembly Room lighting'],
  ['old_room', '1k', 'Scene 7 — study lighting'],
  ['museum_of_ethnography', '1k', 'Scene 9 — gallery lighting'],
  ['kloppenheim_03_puresky', '2k', 'Scene 10 — Wellington sky'],
  ['shanghai_bund', '2k', 'Scene 11 — 1920s skyline night'],
  ['potsdamer_platz', '2k', 'Scene 12 — modern city'],
  ['studio_small_09', '1k', 'Scenes 13–14 — studio lighting'],
  ['kiara_1_dawn', '2k', 'Scene 16 — dawn'],
];

export const TEXTURES = [
  // id, maps
  ['marble_01', ['diff', 'nor_gl', 'arm']],
  ['floor_tiles_06', ['diff', 'nor_gl', 'arm']],
  ['grass_ground', ['diff', 'nor_gl', 'arm']],
  ['rocky_terrain_02', ['diff', 'nor_gl', 'arm']],
  ['old_wooden_floor_02', ['diff', 'nor_gl', 'arm']],
  ['plastered_wall_02', ['diff', 'nor_gl', 'arm']],
  ['cobblestone_floor_08', ['diff', 'nor_gl', 'arm']],
  ['concrete_pavement_02', ['diff', 'nor_gl', 'arm']],
  ['red_plaster_weathered', ['diff', 'nor_gl', 'arm']],
  ['brick_wall_09', ['diff', 'nor_gl', 'arm']],
  ['large_sandstone_blocks_01', ['diff', 'nor_gl', 'arm']],
  ['oak_wood_planks', ['diff', 'nor_gl', 'arm']],
];

// (Poly Haven's scanned trees/ships are 20–100 MB each, so foliage stays procedural.)
export const MODELS = [
  'marble_bust_01', 'gothic_statue', 'Chandelier_03', 'WoodenChair_01', 'GreenChair_01', 'WoodenTable_01',
  'round_wooden_table_02', 'ClassicConsole_01', 'brass_candleholders', 'Lantern_01', 'vintage_oil_lamp',
  'fancy_picture_frame_01', 'fancy_picture_frame_02', 'hanging_picture_frame_03', 'book_encyclopedia_set_01',
  'dutch_ship_large_02', 'boulder_01', 'seadogs_compass',
];

export const SMITHSONIAN = [
  // file name, url, title, credit
  ['washington_bust.glb', 'https://3d-api.si.edu/content/document/3d_package:ff28cb3a-ad00-43b3-a928-fa61ab0a288f/resources/NPG_78_1-GeorgeWashington-100k-2048_std_draco.glb', 'George Washington (bust after Jean-Antoine Houdon)', 'National Portrait Gallery, Smithsonian Institution — CC0'],
  ['declaration_desk.glb', 'https://3d-api.si.edu/content/document/3d_package:9a096c5a-4062-4c5d-87af-32eb717c6c3a/resources/multi-mesh-100k-2048_std_draco.glb', 'Thomas Jefferson’s Declaration of Independence writing desk', 'National Museum of American History, Smithsonian Institution — CC0'],
  ['greek_slave.glb', 'https://3d-api.si.edu/content/document/3d_package:8edffe56-c358-4c3a-a61f-019f615ccef0/resources/greek-slave-plaster-cast-150k-2048-medium-100k-2048_std_draco.glb', 'Hiram Powers, Model of the Greek Slave (plaster)', 'Smithsonian American Art Museum — CC0'],
  ['waterston_bust.glb', 'https://3d-api.si.edu/content/document/3d_package:d825c526-69dd-472a-8d47-7da7fbe88fb7/resources/saam_1983_95_181-waterson-polish-2026-100k-2048_std_draco.glb', 'Helen Ruthven Waterston (bust)', 'Smithsonian American Art Museum — CC0'],
];

export const IMAGES = [
  // out file, Commons title, width, credit
  ['pizan.jpg', 'Christine de Pisan writing.png', 1200, 'Christine de Pizan writing, illumination c.1407 (public domain)'],
  ['adams.jpg', 'Abigail Adams by Gilbert Stuart.jpg', 1200, 'Gilbert Stuart, Abigail Adams, c.1800–1815 (public domain)'],
  ['wollstonecraft.jpg', 'Mary Wollstonecraft by John Opie (c. 1797).jpg', 1200, 'John Opie, Mary Wollstonecraft, c.1797 (public domain)'],
  ['gouges.jpg', 'Olympe de Gouges - portrait.jpg', 1200, 'Alexander Kucharsky, Olympe de Gouges, 18th c. (public domain)'],
  ['sheppard.jpg', 'Kate Sheppard.jpg', 1000, 'Kate Sheppard, photograph c.1905 (public domain)'],
  ['anthony.jpg', 'Susan B. Anthony by Frances Benjamin Johnston.jpg', 1200, 'Frances Benjamin Johnston, Susan B. Anthony (public domain)'],
  ['edith_wilson.jpg', 'Edith Bolling Galt Wilson Portrait (4435308813).jpg', 1200, 'Edith Bolling Galt Wilson, Harris & Ewing (Library of Congress, no known restrictions)'],
  ['jefferson.jpg', 'Thomas Jefferson by Rembrandt Peale, 1800.jpg', 1200, 'Rembrandt Peale, Thomas Jefferson, 1800 (public domain)'],
  ['voltaire.jpg', 'Nicolas de Largillière, François-Marie Arouet dit Voltaire (vers 1724-1725) -001.jpg', 1000, 'Nicolas de Largillière, Voltaire, c.1724 (public domain)'],
  ['rousseau.jpg', 'Jean-Jacques Rousseau (painted portrait).jpg', 1000, 'Maurice Quentin de La Tour, Jean-Jacques Rousseau, 1753 (public domain)'],
  ['locke.jpg', 'John Locke.jpg', 1000, 'Godfrey Kneller, John Locke, 1697 (public domain)'],
  ['map_ortelius.jpg', 'Ortelius America Sive Novi Orbis 1570 UTA.jpg', 2400, 'Abraham Ortelius, Americae Sive Novi Orbis Nova Descriptio, 1570 (public domain)'],
  ['lambton_quay_1880.jpg', 'Lambton Quay about 1880.jpg', 1900, 'Lambton Quay, Wellington, c.1880 (public domain)'],
  ['pnyx_view.jpg', 'View of the Acropolis of Athens and Mount Lycabettus from the Orator’s Bema on the Pnyx on 23 September 2018.jpg', 2400, 'View from the Orator’s Bema on the Pnyx, 2018 (CC0)'],
  ['declaration_independence.jpg', 'United States Declaration of Independence.jpg', 1200, 'William J. Stone engraving of the Declaration of Independence, 1823 (public domain)'],
  ['wampum.jpg', 'Hiawatha Wampum Belt (1909) (14779431751).jpg', 1600, 'Hiawatha Wampum Belt, 1909 photograph (no known restrictions)'],
  ['suffrage_procession_1913.jpg', 'Woman Suffrage Procession 1913 opening.jpg', 2000, 'Woman Suffrage Procession, Washington D.C., 1913 (public domain)'],
  ['suffrage_program_1913.jpg', 'Official Program Woman Suffrage Procession - March 3, 1913.jpg', 1400, 'Official Program, Woman Suffrage Procession, 1913 (public domain)'],
  ['assembly_room.jpg', 'Assembly Room in Independence Hall (4e4d7280-1dd8-b71b-0ba3-d7bec43b2b9c).jpg', 2000, 'Assembly Room, Independence Hall — National Park Service (public domain)'],
  // painted backdrops
  ['cole_consummation.jpg', 'Cole Thomas The Consummation The Course of the Empire 1836.jpg', 3200, 'Thomas Cole, The Course of Empire: The Consummation of Empire, 1836 (public domain)'],
  ['cole_desolation.jpg', 'Cole Thomas The Course of Empire Desolation 1836.jpg', 3200, 'Thomas Cole, The Course of Empire: Desolation, 1836 (public domain)'],
  ['cole_arcadian.jpg', 'Cole Thomas The Course of Empire The Arcadian or Pastoral State 1836.jpg', 3200, 'Thomas Cole, The Course of Empire: The Arcadian or Pastoral State, 1834 (public domain)'],
  ['klenze_athens.jpg', 'Klenze, Leo von - Ideale Ansicht der Akropolis und des Areopag in Athen, 1846.jpg', 3200, 'Leo von Klenze, Ideal View of the Acropolis and the Areopagus in Athens, 1846 (public domain)'],
  ['church_parthenon.jpg', 'Parthenon (1871) Frederic Edwin Church.jpg', 3200, 'Frederic Edwin Church, The Parthenon, 1871 (public domain)'],
  ['lemonnier_salon.jpg', 'Anicet-Charles-Gabriel Lemonnier - In the Salon of Madame Geoffrin in 1755 - WGA12652.jpg', 3200, 'Anicet Charles Gabriel Lemonnier, In the Salon of Madame Geoffrin in 1755, 1812 (public domain)'],
  ['coste_isfahan.jpg', 'Naqsh-e Jahan Square by Pascal Coste 1 edited.jpg', 3200, 'Pascal Coste, Naqsh-e Jahan Square, Isfahan, c.1840 (public domain)'],
  ['allom_great_wall.jpg', 'Allom - The Great Wall of China.jpg', 3200, 'Thomas Allom, The Great Wall of China, 1843 (public domain)'],
  ['bierstadt_sierra.jpg', 'Albert Bierstadt - Among the Sierra Nevada, California - Google Art Project.jpg', 3200, 'Albert Bierstadt, Among the Sierra Nevada, California, 1868 (public domain)'],
];
// PDF page renders (Commons thumbnails of PDFs)
export const PDF_PAGES = [
  ['declaration_sentiments.png', "Roll of Honor, Women's Rights Convention.png", 1600, 'Roll of Honor: signatures to the Declaration of Sentiments, Seneca Falls 1848 (public domain)'],
];

/* ------------------------------------------------------------------ helpers */
const exists = async (p) => { try { await stat(p); return true; } catch { return false; } };
async function download(url, dest, { headers = {} } = {}) {
  if (!FORCE && (await exists(dest))) return 'skip';
  await mkdir(dirname(dest), { recursive: true });
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA, ...headers }, redirect: 'follow' });
    if (res.status === 429) { await new Promise((r) => setTimeout(r, 5000 * (attempt + 1))); continue; }
    if (!res.ok) throw new Error(`${res.status} ${res.statusText} for ${url}`);
    const buf = Buffer.from(await res.arrayBuffer());
    await writeFile(dest, buf);
    return `${(buf.length / 1024).toFixed(0)} KB`;
  }
  throw new Error(`rate limited: ${url}`);
}
const phApi = async (path) => (await fetch(`https://api.polyhaven.com/${path}`, { headers: { 'User-Agent': UA } })).json();
const credits = [];
const log = (ok, what, extra = '') => console.log(`${ok ? '✓' : '✗'} ${what} ${extra}`);

async function pool(items, n, fn) {
  const queue = [...items];
  await Promise.all(Array.from({ length: n }, async () => { while (queue.length) await fn(queue.shift()); }));
}

/* ------------------------------------------------------------------ fetchers */
async function fetchHdris() {
  await pool(HDRIS, 3, async ([id, res, use]) => {
    try {
      const files = await phApi(`files/${id}`);
      const url = files.hdri[res].hdr.url;
      const r = await download(url, join(OUT, 'hdri', `${id}_${res}.hdr`));
      credits.push(`- HDRI **${id}** (${res}) — Poly Haven, CC0 — ${use}`);
      log(true, `hdri/${id}_${res}.hdr`, r);
    } catch (e) { log(false, `hdri ${id}`, e.message); }
  });
}

async function fetchTextures() {
  await pool(TEXTURES, 3, async ([id, maps]) => {
    try {
      const files = await phApi(`files/${id}`);
      const key = { diff: 'Diffuse', nor_gl: 'nor_gl', arm: 'arm', rough: 'Rough', ao: 'AO', disp: 'Displacement' };
      for (const m of maps) {
        const entry = files[key[m]]?.['1k']?.jpg;
        if (!entry) { log(false, `${id} ${m}`, 'missing'); continue; }
        const r = await download(entry.url, join(OUT, 'textures', id, `${id}_${m}_1k.jpg`));
        log(true, `textures/${id}/${m}`, r);
      }
      credits.push(`- Texture **${id}** — Poly Haven, CC0`);
    } catch (e) { log(false, `texture ${id}`, e.message); }
  });
}

async function fetchModels() {
  await pool(MODELS, 3, async (id) => {
    try {
      const files = await phApi(`files/${id}`);
      const g = files.gltf['1k'].gltf;
      const dir = join(OUT, 'models', id);
      const r = await download(g.url, join(dir, `${id}.gltf`));
      for (const [rel, inc] of Object.entries(g.include || {})) await download(inc.url, join(dir, rel));
      credits.push(`- Model **${id}** — Poly Haven, CC0`);
      log(true, `models/${id}`, r);
    } catch (e) { log(false, `model ${id}`, e.message); }
  });
}

async function fetchSmithsonian() {
  await pool(SMITHSONIAN, 2, async ([file, url, title, credit]) => {
    try {
      const r = await download(url, join(OUT, 'models', 'smithsonian', file));
      credits.push(`- 3D scan **${title}** — ${credit}`);
      log(true, `models/smithsonian/${file}`, r);
    } catch (e) { log(false, file, e.message); }
  });
}

async function fetchImages() {
  // Commons is strict about rate limits: go sequentially with a pause.
  for (const [file, title, width, credit] of IMAGES) {
    try {
      const url = `https://commons.wikimedia.org/w/index.php?title=Special:Redirect/file/${encodeURIComponent(title)}&width=${width}`;
      const r = await download(url, join(OUT, 'images', file));
      credits.push(`- Image **${file}** — ${credit} — via Wikimedia Commons: "${title}"`);
      log(true, `images/${file}`, r);
      if (r !== 'skip') await new Promise((res) => setTimeout(res, 1500));
    } catch (e) { log(false, file, e.message); }
  }
  for (const [file, title, width, credit] of PDF_PAGES) {
    try {
      const url = `https://commons.wikimedia.org/w/thumb.php?f=${encodeURIComponent(title.replace(/ /g, '_'))}&w=${width}&page=1`;
      const r = await download(url, join(OUT, 'images', file));
      credits.push(`- Image **${file}** — ${credit} — via Wikimedia Commons: "${title}"`);
      log(true, `images/${file}`, r);
    } catch (e) { log(false, file, e.message); }
  }
}

/* ------------------------------------------------------------------ run */
await mkdir(OUT, { recursive: true });
await Promise.all([fetchHdris(), fetchTextures(), fetchModels(), fetchSmithsonian()]);
await fetchImages();
credits.sort();
await writeFile(join(OUT, 'CREDITS.md'), `# Asset credits\n\nEvery asset below is CC0, public domain, or marked "no known restrictions" by its holding institution.\n\n${credits.join('\n')}\n`);
console.log(`\nWrote ${credits.length} credits → assets-src/CREDITS.md`);
