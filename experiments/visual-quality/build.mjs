// Product sources only. The frozen optimization reference is never read or edited.
import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { transformSync } from '../optimizations/node_modules/esbuild/lib/main.js';
const root = new URL('../../', import.meta.url);
const here = new URL('./', import.meta.url);
const files = ['quality.js', 'math.js', 'shaders.js', 'world.js', 'main.js', 'audio.js'];
const source = Object.fromEntries(await Promise.all(files.map(async f => [f, await fs.readFile(new URL('source/src/' + f, root), 'utf8')])));
const template = await fs.readFile(new URL('source/template.html', root), 'utf8');
const sha = b => createHash('sha256').update(b).digest('hex');
const original = 'sin(f32(vi >> 1u) / (ROWS - 1.) * 1.5708)';
const candidates = { baseline: original, uniform: 'f32(vi >> 1u) / (ROWS - 1.)', basal: '1. - cos(f32(vi >> 1u) / (ROWS - 1.) * 1.5708)' };
// Second isolated trial: retain all geometry and color choices; reduce rock-like
// microcontrast on living surfaces so their existing curved normals can read.
candidates.organic = original;
const organicEdits = [
  ['alb *= (.45 + .75 * B.h) * (.7 + .3 * C.h);', 'alb *= (.70 + .25 * B.h) * (.8 + .1 * C.h);'],
  ['gloss = .2; bump = 1.4; flu = .55;', 'gloss = .2; bump = .45; flu = .55;'],
  ['alb *= (.4 + .8 * B.h) * (.5 + .9 * i.ao * i.ao);', 'alb *= (.65 + .3 * B.h) * (.5 + .9 * i.ao * i.ao);'],
  ['gloss = .25; bump = 1.5;', 'gloss = .25; bump = .5;']
];
// Accept either the baseline or the adopted uniform sampling in the product.
const current = source['shaders.js'].includes('let v = ' + original + ';') ? original : candidates.uniform;
if (!source['shaders.js'].includes('let v = ' + current + ';')) throw Error('Leaf sampling source changed; review experiment transform');
const compile = js => {
  js = js.replace(/\/\*wgsl\*\/`([^`]*)`/g, (_, w) => '`' + w.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|!%@]) ?/g, '$1').trim() + '`');
  const wrapped = `(async()=>{${js}\n})().catch(e=>{console.error(e);document.body.className='l e';document.getElementById('s').textContent=(e.cause?'':'Failed to start: ')+e.message});`;
  const code = transformSync(wrapped, { minify: true, target: 'es2022', legalComments: 'none' }).code.trim();
  return template.replace(/<style>([^]*?)(?=<\/style>)/, (_, css) => '<style>' + transformSync(css, { loader: 'css', minify: true }).code.trim()).replace(/>\s+</g, '><').replace('/*SCRIPT*/', () => code).replace(/<script>\s+/, '<script>').replace(/\s+<\/script>/, '</script>');
};
const api = `
globalThis.__visual = {
  state: () => ({camera:Array.from(F.slice(0,5)),time:F[TIME],width:W,height:H,detail:det,level:LV,poses:POSES,gpu:hasTS}),
  async draw(pose,time=8) { if(Array.isArray(pose)) lookAt(...pose); else lookAt(...POSES[pose]); F[TIME]=time; dynT=-Infinity; render(); await Q.onSubmittedWorkDone(); return this.state(); },
  async move(frames=60) { dynT=-Infinity; kf=1; for(let i=0;i<frames;i++){frame(F[LAST]+1000/60);await Q.onSubmittedWorkDone();} kf=0; return this.state(); },
  async bench(pose,n=120) { await this.draw(pose,8); const cpu=[],gpu=[]; globalThis.__visualGpu=gpu; for(let i=0;i<n+20;i++){ F[TIME]=8+i/60;const t=performance.now();render();cpu.push(performance.now()-t);await Q.onSubmittedWorkDone();await new Promise(r=>setTimeout(r,0)); } globalThis.__visualGpu=null; return {cpu:cpu.slice(20),gpu:gpu.slice(20),state:this.state()}; }
};
`;
await fs.mkdir(new URL('variants/', here), { recursive: true });
await fs.mkdir(new URL('results/', here), { recursive: true });
const report = { node: process.version, sources: Object.fromEntries(files.map(f => [f, sha(source[f])])), variants: {} };
for (const [name, sample] of Object.entries(candidates)) {
  let js = files.map(f => source[f]).join('\n').replace('let v = ' + current + ';', 'let v = ' + sample + ';');
  // Reconstruct the old material after adoption without maintaining a second source tree.
  for(const [before,after] of organicEdits) {
    const found=js.includes(after)?after:before;
    if(js.split(found).length!==2)throw Error('Material transform no longer unique: '+found);
    js=js.replace(found,name==='organic'?after:before);
  }
  const html = compile(js);
  await fs.writeFile(new URL('variants/' + name + '.html', here), html);
  report.variants[name] = { bytes: Buffer.byteLength(html), gzipBytes: gzipSync(html, { level: 9 }).length, sha256: sha(html), sampling: sample };
  // Instrumentation is separate from the measured shipping HTML sizes.
  js = js.replace('const Wd = makeWorld(D, T, flyPts, POSES);', 'const __worldStart=performance.now(); const Wd = makeWorld(D, T, flyPts, POSES); globalThis.__worldMs=performance.now()-__worldStart;');
  js = js.replace('F[GPU] = ms;', 'F[GPU] = ms; if(globalThis.__visualGpu) globalThis.__visualGpu.push(ms);');
  await fs.writeFile(new URL('variants/' + name + '-timing.html', here), compile(js + api));
  js = js.replace('D = Wd.gy = T.smp = null;', 'await globalThis.__hashWorld({D,T,Wd,CI,CG}); D = Wd.gy = T.smp = null;');
  js = js.replace('let nV = 0, nI = 0;', 'await globalThis.__hashWorld({meshes}); let nV = 0, nI = 0;');
  await fs.writeFile(new URL('variants/' + name + '-qa.html', here), compile(js + api));
}
await fs.writeFile(new URL('results/build.json', here), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
