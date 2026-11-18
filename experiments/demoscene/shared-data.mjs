// Node-only proofs and optional QA instrumentation; never part of shipping HTML.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { sharedFar } from './shared-transform.mjs';
import { replaceOnce } from './transforms.mjs';

const repo = new URL('../../', import.meta.url), base = '3178034';
const names = ['quality.js', 'math.js', 'shaders.js', 'world.js', 'main.js', 'audio.js'];
const readBase = p => execFileSync('git', ['show', base + ':' + p], { cwd: repo, encoding: 'utf8' });
const packCode = s => s.slice(s.indexOf('  const pack = (L, step'), s.indexOf('\n  // --- half-res volume'));
const originalPack = packCode(readBase('source/src/world.js'));

// Independent reference is the exact baseline pack(), including Float32 rounding.
function proveRecords(near, far, ref) {
  const same = (a, b) => a.length === b.length && a.every((v, i) => Object.is(v, b[i]));
  if ('buf' in far || far.n !== ref.n || !['start', 'lo', 'hi'].every(k => same(far[k], ref[k]))) throw Error('Far metadata changed');
  const src = new Uint32Array(near.buf), dst = new Uint32Array(ref.buf), nf = new Float32Array(near.buf);
  const width = new Float32Array(1), bits = new Uint32Array(width.buffer);
  let checked = 0, oddCells = 0, byteChecks = 0;
  for (let c = 0; c < far.start.length - 1; c++) {
    const first = near.start[c], count = near.start[c + 1] - first, selected = far.start[c + 1] - far.start[c];
    if (selected !== Math.ceil(count / 2)) throw Error('Selection count changed');
    if (selected && (selected - 1) * 72 + 36 > count * 36) throw Error('Vertex range exceeds cell');
    if (count % 2) oddCells++;
    for (let j = 0; j < selected; j++) {
      const a = (first + j * 2) * 9, b = (far.start[c] + j) * 9;
      width[0] = nf[a + 6] * 1.5;
      for (let k = 0; k < 9; k++) {
        if ((k === 6 ? bits[0] : src[a + k]) !== dst[b + k]) throw Error('Far record mismatch at ' + (b + k));
        byteChecks += 4;
      }
      checked++;
    }
  }
  return { checkedRecords: checked, checkedBytes: byteChecks, oddCells, savedGPUBytes: ref.buf.byteLength, sameMetadata: true, byteIdenticalCPUReconstruction: true };
}

// Apply only to shared-far QA source. Builds the original Far buffer temporarily.
// Fetch globalThis.__sharedFarProof after makeWorld; never use this in timings.
export function sharedFarQA(source) {
  return replaceOnce(source, '    // Shared far leaves: keep original cell metadata, without another leaf array.',
    `    if (!buf) {
      const __oldPack = (() => { ${originalPack}\n return pack; })();
      globalThis.__sharedFarProof = (${proveRecords.toString()})(pack(L), { n, start, lo, hi }, __oldPack(L, 2, 1.5));
    }
    // Shared far leaves: keep original cell metadata, without another leaf array.`);
}

async function run() {
  const joined = names.map(n => readBase('source/src/' + n)).join('\n'), changed = sharedFar(joined);
  const before = new Function('nCells', originalPack + '\nreturn pack;')(256);
  const after = new Function('nCells', packCode(changed) + '\nreturn pack;')(256);
  let seed = 123456789;
  const rnd = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const lists = Array.from({ length: 256 }, (_, n) => {
    const a = [];
    for (let i = 0; i < n; i++) a.push(rnd() * 340 - 170, rnd() * 50 - 50, rnd() * 340 - 170, rnd() * 4, rnd() * 6.28, rnd() * 3.14, rnd() * .5, rnd() * 40, i % 8, rnd(), rnd(), rnd());
    return a;
  });
  const near = after(lists), far = after(lists, 2), ref = before(lists, 2, 1.5);
  assert.deepEqual(near, before(lists));
  const synthetic = proveRecords(near, far, ref);
  const probePack = new Function('nCells', packCode(sharedFarQA(changed)) + '\nreturn pack;')(256);
  probePack(lists, 2);
  assert.deepEqual(globalThis.__sharedFarProof, synthetic);
  const drawCode = s => s.slice(s.indexOf('function drawCells('), s.indexOf('\nfunction render()'));
  const photos = JSON.parse(await fs.readFile(new URL('../surface/results/beach-browser.json', import.meta.url), 'utf8'));
  const sourceFrames = photos.tests.filter(t => t.name === 'beach');
  const views = [];
  for (const test of sourceFrames) {
    const bounds = test.bounds[2]; // [Terrain, Big, BigF, Small, ...]
    // Recorded real bounds and cameras; artificial per-cell counts make IDs explicit.
    const cellLists = bounds.lo.map((l, c) => l <= bounds.hi[c] ? Array.from({ length: 12 * (c % 17 + 1) }, () => rnd()) : []);
    const nearMeta = before(cellLists), farMeta = before(cellLists, 2, 1.5);
    const oldIDs = [];
    for (let c = 0; c < 256; c++) for (let i = 0; i < farMeta.start[c + 1] - farMeta.start[c]; i++) oldIDs.push(nearMeta.start[c] + i * 2);
    const evaluate = (src, frame, detail, candidate, minD = 58, maxD = 150) => {
      const [cx, cy, cz, yaw, pitch] = frame;
      const cp = Math.cos(pitch), fy = Math.sin(pitch), rx = Math.cos(yaw), rz = Math.sin(yaw), fx = cp * rz, fz = -cp * rx;
      const F = [cx, cy, cz, yaw, pitch, fx, fy, fz, rx, rz, -rz * fy, rz * fx - rx * fz, rx * fy];
      const cr = Math.max(0, Math.min(15, Math.floor((cz + 192) / 24))), rowOrd = [cr];
      for (let d = 1; d < 16; d++) { if (cr - d >= 0) rowOrd.push(cr - d); if (cr + d < 16) rowOrd.push(cr + d); }
      const params = { F, CX: 0, CY: 1, CZ: 2, FX: 5, FY: 6, FZ: 7, RX: 8, RZ: 9, UX: 10, UY: 11, UZ: 12, det: detail, TANH: .6, W: 1280, H: 720, CELLW: 24, CELLS: 16, OX: -192, OZ: -192, rowOrd, Wd: { big: nearMeta }, ibBig: {}, nSolid: 0, max: Math.max, abs: Math.abs };
      const fn = new Function(...Object.keys(params), drawCode(src) + ';return drawCells;')(...Object.values(params));
      const ids = []; let draws = 0, bindings = 0, offset = 0, size = 0;
      const r = {
        setVertexBuffer(slot, buffer, at, n) { assert.equal(slot, 0); assert.equal(buffer, params.ibBig); assert.equal(at % 4, 0); assert.ok(at + n <= nearMeta.buf.byteLength); offset = at; size = n; bindings++; },
        draw(vertices, count, first = 0, instance = 0) {
          assert.equal(vertices, 6); assert.equal(first, 0); draws++;
          if (candidate) { assert.equal(instance, 0); assert.ok((count - 1) * 72 + 36 <= size); }
          for (let j = 0; j < count; j++) ids.push(candidate ? offset / 36 + j * 2 : oldIDs[instance + j]);
        }
      };
      fn(r, farMeta.start, bounds.lo, bounds.hi, 5, false, 6, minD, maxD, candidate);
      return { ids, draws, bindings };
    };
    for (const view of test.views.filter(v => !v.label.startsWith('wave') && !v.label.startsWith('reachable'))) for (const detail of [1, .7, .4]) {
      const a = evaluate(joined, view.camera, detail, false), b = evaluate(changed, view.camera, detail, true);
      assert.deepEqual(b.ids, a.ids);
      views.push({ level: test.level, label: view.label, detail, baselineDraws: a.draws, sharedDraws: b.draws, sharedBindings: b.bindings, selectedIDs: a.ids.length });
    }
    const target = bounds.lo.findIndex((l, c) => l <= bounds.hi[c]);
    const centerX = -192 + (target % 16 + .5) * 24, centerZ = -192 + (Math.floor(target / 16) + .5) * 24;
    for (const distance of [23.99, 24, 24.01, 57.99, 58, 58.01, 149.99, 150, 150.01]) for (const range of [[0, 24], [24, 58], [58, 150]]) {
      // Measure to the nearest cell edge, exactly as drawCells does, not its center.
      const frame = [centerX, (bounds.lo[target] + bounds.hi[target]) / 2, centerZ - 12 - distance, Math.PI, 0];
      const a = evaluate(joined, frame, 1, false, ...range), b = evaluate(changed, frame, 1, true, ...range);
      assert.deepEqual(b.ids, a.ids);
      assert.equal(a.ids.includes(nearMeta.start[target]), distance >= range[0] && distance < range[1]);
      views.push({ level: test.level, label: 'boundary-camera-' + distance, range, targetCell: target, detail: 1, baselineDraws: a.draws, sharedDraws: b.draws, sharedBindings: b.bindings, selectedIDs: a.ids.length });
    }
  }
  const costs = sourceFrames.map(t => { const bytes = t.hashes['Wd.bigF.buf'].bytes; return { level: t.level, removedGPUBufferBytes: bytes, removedTemporaryCPUArrayBytes: bytes, unchangedFarMetadataBytes: 3076 }; });
  const semantics = {
    selection: 'Restart the 0,2,4,... near-record selection in each cell; preserve old Far start/lo/hi from original JS lists.',
    range: 'Explicit [nearStart*36, nearCellCount*36] vertex range, firstInstance=0; (ceil(N/2)-1)*72+36 <= N*36, including final odd cell.',
    width: 'Baseline writes width into Float32Array before *=1.5: f32(f32(originalWidth)*1.5). Candidate CPU reconstruction follows the same order exactly; GPU shader execution remains to be checked.',
    draws: 'One draw and one vertex-buffer binding per nonempty visible far cell. Counts below use recorded real bounds/cameras; actual counts do not affect number of calls when cell occupancy stays the same.',
    qaOnly: 'sharedFarQA recreates old Far and near arrays temporarily; exclude it from shipping and timing builds.'
  };
  const report = { base, node: process.version, synthetic, cameraCases: views.length, drawCases: views, costs, semantics, limits: ['No browser or shader execution.', 'Culling uses recorded real bounds and cameras with artificial per-cell counts.', 'Full actual-world record proof is exported as sharedFarQA; requires builder/browser execution.', 'API buffer payload reductions are not process RSS/peak measurements.'] };
  await fs.mkdir(new URL('results/', import.meta.url), { recursive: true });
  await fs.writeFile(new URL('results/shared-data.json', import.meta.url), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ synthetic, cameraCases: views.length, drawRanges: sourceFrames.map(t => { const v = views.filter(v => v.level === t.level); return { level: t.level, baseline: [Math.min(...v.map(v => v.baselineDraws)), Math.max(...v.map(v => v.baselineDraws))], shared: [Math.min(...v.map(v => v.sharedDraws)), Math.max(...v.map(v => v.sharedDraws))] }; }), costs }, null, 2));
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) await run();
