// Reproducible variants from the accepted product commit; never touch upstream.
import fs from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import assert from 'node:assert/strict';
import { transformSync } from '../../source/node_modules/esbuild/lib/main.js';
import { replaceOnce, shadow16 } from './transforms.mjs';
import { sharedFar } from './shared-transform.mjs';
import { sharedFarQA } from './shared-data.mjs';
export const BASE = '3178034';
const here = new URL('./', import.meta.url), repo = new URL('../../', here);
const names = ['quality.js', 'math.js', 'shaders.js', 'world.js', 'main.js', 'audio.js'];
const readBase = p => execFileSync('git', ['show', BASE + ':' + p], { cwd: repo, encoding: 'utf8' });
const parts = Object.fromEntries(names.map(n => [n, readBase('source/src/' + n)]));
const template = readBase('source/template.html');
const sha = b => createHash('sha256').update(b).digest('hex');
export function compile(js) {
  js = js.replace(/\/\*wgsl\*\/`([^`]*)`/g, (_, w) => '`' + w.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|!%@]) ?/g, '$1').trim() + '`');
  const wrapped = `(async()=>{${js}\n})().catch(e=>{console.error(e);document.body.className='l e';document.getElementById('s').textContent=(e.cause?'':'Failed to start: ')+e.message});`;
  const code = transformSync(wrapped, { minify: true, target: 'es2022', legalComments: 'none' }).code.trim();
  return template.replace(/<style>([^]*?)(?=<\/style>)/, (_, s) => '<style>' + transformSync(s, { loader: 'css', minify: true }).code.trim()).replace(/>\s+</g, '><').replace('/*SCRIPT*/', () => code).replace(/<script>\s+/, '<script>').replace(/\s+<\/script>/, '</script>');
}
const joined = names.map(n => parts[n]).join('\n');
assert.equal(compile(joined), readBase('index.html'));
const variants = { baseline: joined, 'shadow16-bias2': shadow16(joined, 2), 'shadow16-bias0': shadow16(joined, 0), 'shared-far': sharedFar(joined), combined: shadow16(sharedFar(joined), 0) };
const oldHarness = await fs.readFile(new URL('../visual-quality/build.mjs', here), 'utf8');
const api = oldHarness.split('const api = `')[1].split('\n`;')[0] + `
globalThis.__visual.reset=function(){F[VX]=F[VY]=F[VZ]=F[LAST]=0;kf=kb=kl=kr=ku=kd=ks=0;};
globalThis.__visual.swim=async function(pose,keys,n){lookAt(...pose);this.reset();F[TIME]=8;dynT=-Infinity;for(const code of keys)key({code},1);let clear=1;for(let i=0;i<n;i++){frame(F[LAST]+1000/60,true);clear=min(clear,-max(rockAt(F[CX],F[CY],F[CZ]),rockAt(F[CX],F[CY]-.9*sstep(-1.2,.28,F[CY]),F[CZ])));}kf=kb=kl=kr=ku=kd=ks=0;return {end:this.state(),clearance:clear};};
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
  if (name === 'shared-far' || name === 'combined') js = sharedFarQA(js);
  js = replaceOnce(js, 'D = Wd.gy = T.smp = null;', 'await globalThis.__hashWorld({D,T,Wd,CI,CG});D = Wd.gy = T.smp = null;');
  js = replaceOnce(js, 'let nV = 0, nI = 0;', 'await globalThis.__hashWorld({meshes});let nV = 0, nI = 0;');
  await fs.writeFile(new URL('variants/' + name + '-qa.html', here), compile(js + api));
}
await fs.writeFile(new URL('results/build.json', here), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report.variants, null, 2));
