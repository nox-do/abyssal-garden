// Reproducible variants from the accepted product commit; never touch upstream.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { transformSync } from '../../source/node_modules/esbuild/lib/main.js';
import { replaceOnce } from '../demoscene/transforms.mjs';
export const BASE = '75920eb';
const here = new URL('./', import.meta.url), repo = new URL('../../', here);
const names = ['quality.js', 'math.js', 'shaders.js', 'world.js', 'main.js', 'audio.js'];
const readBase = p => execFileSync('git', ['show', BASE + ':' + p], { cwd: repo, encoding: 'utf8' });
let parts = Object.fromEntries(names.map(n => [n, readBase('source/src/' + n)]));
const template = readBase('source/template.html');
const sha = b => createHash('sha256').update(b).digest('hex');
export function compile(js) {
  js = js.replace(/\/\*wgsl\*\/`([^`]*)`/g, (_, w) => '`' + w.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|!%@]) ?/g, '$1').trim() + '`');
  const wrapped = `(async()=>{${js}\n})().catch(e=>{console.error(e);document.body.className='l e';document.getElementById('s').textContent=(e.cause?'':'Failed to start: ')+e.message});`;
  const code = transformSync(wrapped, { minify: true, target: 'es2022', legalComments: 'none' }).code.trim();
  return template.replace(/<style>([^]*?)(?=<\/style>)/, (_, s) => '<style>' + transformSync(s, { loader: 'css', minify: true }).code.trim()).replace(/>\s+</g, '><').replace('/*SCRIPT*/', () => code).replace(/<script>\s+/, '<script>').replace(/\s+<\/script>/, '</script>');
}
const joined = names.map(n => parts[n]).join('\n');
assert.equal(compile(joined),readBase('index.html'));
const variants = { baseline: joined, jelly: (await Promise.all(names.map(n => fs.readFile(new URL('source/src/' + n, repo), 'utf8')))).join('\n') };
const oldHarness = await fs.readFile(new URL('../visual-quality/build.mjs', here), 'utf8');
const api = oldHarness.split('const api = `')[1].split('\n`;')[0] + `
globalThis.__visual.reset=function(){F[VX]=F[VY]=F[VZ]=F[LAST]=0;kf=kb=kl=kr=ku=kd=ks=0;};
`;
await fs.mkdir(new URL('variants/', here), { recursive: true });
await fs.mkdir(new URL('results/', here), { recursive: true });
const report = { base: BASE, node: process.version, sourceHashes: Object.fromEntries(names.map(n => [n, sha(parts[n])])), variants: {} };
for (const [name, source] of Object.entries(variants)) {
  const html = compile(source);
  await fs.writeFile(new URL('variants/' + name + '.html', here), html);
  report.variants[name] = { bytes: Buffer.byteLength(html), gzipBytes: gzipSync(html, { level: 9 }).length, sha256: sha(html) };
  let js = replaceOnce(source, 'F[GPU] = ms;', 'F[GPU] = ms;if(globalThis.__visualGpu)globalThis.__visualGpu.push(ms);');
  js = replaceOnce(js, 'const Wd = makeWorld(D, T, flyPts, POSES);', 'const __worldStart=performance.now();const Wd = makeWorld(D, T, flyPts, POSES);globalThis.__worldMs=performance.now()-__worldStart;');
  js = replaceOnce(js, "// ---------------------------------------------------------------- one-time bakes: detail texture, shadow map", "const __bakeStart=performance.now();\n// ---------------------------------------------------------------- one-time bakes: detail texture, shadow map");
  js = replaceOnce(js, '// the GPU has its own copies now:', 'await Q.onSubmittedWorkDone();globalThis.__bakeMs=performance.now()-__bakeStart;\n// the GPU has its own copies now:');
  js = replaceOnce(js, 'function frame(now) {', 'function frame(now,probe=false) {');
  js = replaceOnce(js, '  render();\n  if (hud) {', '  if(!probe)render();\n  if (hud) {');
  await fs.writeFile(new URL('variants/' + name + '-timing.html', here), compile(js + api));
  js = replaceOnce(js, 'D = Wd.gy = T.smp = null;', 'globalThis.__jellyData=Array.from(Wd.jelly||[]);const __ground=[],__float=[];for(let k=0;k<Wd.solids.data.length;k+=12){const r=Array.from(Wd.solids.data.slice(k,k+12));if(r[11])__float.push(r);else __ground.push(...r);}globalThis.__floatCount=__float.length;globalThis.__otherBob=0;for(const a of [...Wd.props,...Wd.chunks])for(let k=11;k<a.data.length;k+=12)if(a.data[k])globalThis.__otherBob++;globalThis.__solidRanges=Wd.solids.ranges;await globalThis.__hashWorld({groundSolids:new Float32Array(__ground)});D = Wd.gy = T.smp = null;');
  js = replaceOnce(js, 'D = Wd.gy = T.smp = null;', 'await globalThis.__hashWorld({D,T,Wd,CI,CG});D = Wd.gy = T.smp = null;');
  js = replaceOnce(js, 'let nV = 0, nI = 0;', 'await globalThis.__hashWorld({meshes});globalThis.__jellyMesh=meshes[27]?Array.from(new Float32Array(meshes[27].vb)).filter((_,i)=>i%4<3):[];let nV = 0, nI = 0;');
  await fs.writeFile(new URL('variants/' + name + '-qa.html', here), compile(js + api + await fs.readFile(new URL('probe.js', here), 'utf8')));
}
await fs.writeFile(new URL('results/build.json', here), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.variants, null, 2));
