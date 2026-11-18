import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const root = new URL('./upstream/source/src/', import.meta.url);
const math = await fs.readFile(new URL('math.js', root), 'utf8');
const world = await fs.readFile(new URL('world.js', root), 'utf8');
const main = await fs.readFile(new URL('main.js', root), 'utf8');
const geometry = main.slice(main.indexOf('const meshes = ['), main.indexOf('let nV = 0, nI = 0;'));
const geometryReports = [];
for (const level of [0, 1, 2]) {
  const context = vm.createContext({});
  vm.runInContext(`const LV=${level},THIN=1<<LV;\n` + math + '\n' + world + '\n' + geometry + '\nglobalThis.meshes=meshes;', context, { timeout: 60000 });
  let indexCount = 0, vertexCount = 0, maximumIndex = 0;
  let baseVertex = 0;
  for (const mesh of context.meshes) {
    const compact = new Uint16Array(mesh.ib);
    for (let i = 0; i < compact.length; i++) {
      assert.equal(compact[i] + baseVertex, mesh.ib[i] + baseVertex, 'Every addressed vertex must remain identical');
      maximumIndex = Math.max(maximumIndex, mesh.ib[i]);
    }
    baseVertex += mesh.nv;
    indexCount += mesh.ib.length;
    vertexCount += mesh.nv;
  }
  geometryReports.push({ level, vertexCount, maximumIndex, indices: indexCount, originalBytes: indexCount * 4, compactBytes: indexCount * 2, allAddressedVerticesIdentical: true });
}

const pathSource = main.slice(main.indexOf('const POSES = ['), main.indexOf("await say('Growing kelp"));
const context = vm.createContext({});
vm.runInContext(math + '\n' + pathSource + '\nglobalThis.points=flyPts;', context);
const points = JSON.parse(JSON.stringify(context.points));
const original = (x, y, z, r) => {
  for (const p of points) if (Math.hypot(x-p[0], z-p[2]) < r && y < p[1]+3 && y > p[1]-13) return true;
  return false;
};
const reordered = (x, y, z, r) => {
  for (const p of points) if (y < p[1]+3 && y > p[1]-13 && Math.hypot(x-p[0], z-p[2]) < r) return true;
  return false;
};
let seed = 20261117;
const random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
const queries = Array.from({ length: 20000 }, () => [random()*384-192, random()*59-56, random()*384-192, random()*4.7+1.3]);
for (const q of queries) assert.equal(original(...q), reordered(...q));
const run = fn => { let matched = 0; const start = performance.now(); for (const q of queries) matched += fn(...q); return { ms: performance.now()-start, matched }; };
run(original); run(reordered);
const trials = [];
for (let i = 0; i < 5; i++) {
  const a = i % 2 ? run(reordered) : run(original);
  const b = i % 2 ? run(original) : run(reordered);
  trials.push(i % 2 ? { original: b, reordered: a } : { original: a, reordered: b });
}
const median = values => values.sort((a,b)=>a-b)[Math.floor(values.length/2)];
const nearFly = { points: points.length, syntheticQueries: queries.length, exactResults: true, originalMedianMs: median(trials.map(t=>t.original.ms)), reorderedMedianMs: median(trials.map(t=>t.reordered.ms)), trials };
const report = { geometryReports, nearFly, densityArrayCopyBytes: 512*80*512*4 };
await fs.writeFile(new URL('./results/data.json', import.meta.url), JSON.stringify(report, null, 2)+'\n');
console.log(JSON.stringify(report, null, 2));
