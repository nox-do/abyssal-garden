import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { minify } from 'terser';
import { transformSync } from 'esbuild';

const root = new URL('./', import.meta.url);
const read = path => fs.readFile(new URL(path, root), 'utf8');
const write = (path, text) => fs.writeFile(new URL(path, root), text);
const names = ['quality', 'math', 'shaders', 'world', 'main', 'audio'];
const parts = Object.fromEntries(await Promise.all(names.map(async name => [name, await read('upstream/source/src/' + name + '.js')])));
const template = await read('upstream/source/template.html');
const original = await read('upstream/index.html');
const hash = text => createHash('sha256').update(text).digest('hex');
const metrics = html => ({ bytes: Buffer.byteLength(html), gzipBytes: gzipSync(html, { level: 9 }).byteLength, sha256: hash(html) });
const patch = (source, before, after) => {
  assert.equal(source.split(before).length, 2, 'Expected one patch site: ' + before);
  return source.replace(before, () => after);
};
const wrap = body => `(async()=>{${body}\n})().catch(e=>{console.error(e);document.body.className='l e';document.getElementById('s').textContent=(e.cause?'':'Failed to start: ')+e.message});`;
const compactWgsl = s => s.replace(/\/\/[^\n]*/g, '').replace(/\s+/g, ' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|!%@]) ?/g, '$1').trim();
const build = async (sources, useTerser = false) => {
  let js = names.map(name => sources[name]).join('\n');
  js = js.replace(/\/\*wgsl\*\/`([^`]*)`/g, (_, w) => '`' + compactWgsl(w) + '`');
  const code = useTerser
    ? (await minify(wrap(js), { compress: { passes: 2 }, mangle: true, ecma: 2022, format: { comments: false, inline_script: true } })).code
    : transformSync(wrap(js), { minify: true, target: 'es2022', legalComments: 'none' }).code.trim();
  return template.replace(/<style>([^]*?)(?=<\/style>)/, (_, s) => '<style>' + transformSync(s, { loader: 'css', minify: true }).code.trim())
    .replace(/>\s+</g, '><').replace('/*SCRIPT*/', () => code).replace(/<script>\s+/, '<script>').replace(/\s+<\/script>/, '</script>');
};
const packed = async html => {
  const js = html.match(/<script>([\s\S]*?)<\/script>/)[1];
  const data = gzipSync(js, { level: 9 }).toString('base64');
  const loader = `(async()=>{const b=Uint8Array.from(atob(${JSON.stringify(data)}),c=>c.charCodeAt(0)),s=document.createElement('script');s.textContent=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();document.body.appendChild(s);s.remove()})().catch(e=>{console.error(e);document.body.className='l e';document.getElementById('s').textContent='Failed to start: '+e.message});`;
  let restored, failure;
  await vm.runInNewContext(loader, { Uint8Array, atob, Response, Blob, DecompressionStream,
    console: { error: e => { failure = e; } }, document: {
      createElement: () => ({ textContent: '', remove() {} }),
      body: { appendChild: s => { restored = s.textContent; } }, getElementById: () => ({})
    }
  });
  assert.equal(failure, undefined);
  assert.equal(restored, js);
  new vm.Script(restored);
  return { html: html.replace(/<script>[\s\S]*?<\/script>/, () => '<script>' + loader + '</script>'), restoredJsSha256: hash(restored) };
};

if (process.argv.includes('--near-fly')) {
  const { buildSuite } = await import('./near-fly-alternatives.mjs');
  await buildSuite({ parts, build, metrics });
  process.exit(0);
}

await fs.mkdir(new URL('variants/', root), { recursive: true });
await fs.mkdir(new URL('results/', root), { recursive: true });
assert.equal(await build(parts), original, 'Original build must reproduce the upstream HTML exactly');
const reordered = { ...parts, world: patch(parts.world,
  'hypot(x - p[0], z - p[2]) < r && y < p[1] + 3 && y > p[1] - 13',
  'y < p[1] + 3 && y > p[1] - 13 && hypot(x - p[0], z - p[2]) < r') };
let indexedMain = patch(reordered.main, 'allI = new Uint32Array(nI)', 'allI = new Uint16Array(nI)');
assert.equal(indexedMain.split("setIndexBuffer(ibMesh, 'uint32')").length, 3);
indexedMain = indexedMain.replaceAll("setIndexBuffer(ibMesh, 'uint32')", "setIndexBuffer(ibMesh, 'uint16')");
const optimized = { ...reordered, main: indexedMain };
let mappedMain = patch(optimized.main, 'let D;', 'let D, densityReadback;');
mappedMain = patch(mappedMain, 'D = new Float32Array(br.getMappedRange().slice(0));\n  br.unmap(); br.destroy(); bd.destroy();',
  'densityReadback = br;\n  D = new Float32Array(br.getMappedRange());\n  bd.destroy();');
mappedMain = patch(mappedMain, "D = Wd.gy = T.smp = null; // with gy goes the generator's working memory (about 200 MB)",
  "D = Wd.gy = T.smp = null;\ntry { densityReadback.unmap(); } finally { densityReadback.destroy(); densityReadback = null; }");
const variants = {
  original,
  'near-fly': await build(reordered),
  'near-fly-uint16': await build(optimized),
  'near-fly-uint16-mapped': await build({ ...optimized, main: mappedMain }),
  terser: await build(parts, true)
};
const report = { upstream: { repository: 'https://github.com/Noniv/abyssal-garden', commit: 'a596354eff400d458bc2aeb9bdf5e0a9734b2bcf', exactBuildReproduction: true }, node: process.version, variants: {} };
for (const [name, html] of Object.entries(variants)) {
  await write('variants/' + name + '.html', html);
  report.variants[name] = metrics(html);
}
for (const name of ['original', 'near-fly-uint16', 'terser']) {
  const result = await packed(variants[name]);
  await write('variants/' + name + '-packed.html', result.html);
  report.variants[name + '-packed'] = { ...metrics(result.html), exactSourceRoundtrip: true, restoredJsSha256: result.restoredJsSha256 };
}
await write('results/build.json', JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify(report, null, 2));
