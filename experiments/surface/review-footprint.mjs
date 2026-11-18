import fs from 'node:fs';
import vm from 'node:vm';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
import {gzipSync,gunzipSync} from 'node:zlib';
import {transformSync} from '../../source/node_modules/esbuild/lib/main.js';
const root=fileURLToPath(new URL('../../',import.meta.url));
const files=['quality','math','shaders','world','main','audio'];
const sources=Object.fromEntries(files.map(n=>[n,fs.readFileSync(root+'source/src/'+n+'.js','utf8')]));
assert.ok(!sources.main.includes('allI = new Uint16Array(nI)'), 'Historical review predates integration. Use build.mjs --memory and memory-analyze.py for the current reproducible comparison.');
const tpl=fs.readFileSync(root+'source/template.html','utf8');
const compile=parts=>{
 let js=files.map(f=>parts[f]).join('\n').replace(/\/\*wgsl\*\/`([^`]*)`/g,(_,w)=>'`'+w.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|!%@]) ?/g,'$1').trim()+'`');
 const wrap=`(async()=>{${js}\n})().catch(e=>{console.error(e);document.body.className='l e';document.getElementById('s').textContent=(e.cause?'':'Failed to start: ')+e.message});`;
 const code=transformSync(wrap,{minify:true,target:'es2022',legalComments:'none'}).code.trim();
 return tpl.replace(/<style>([^]*?)(?=<\/style>)/,(_,s)=>'<style>'+transformSync(s,{loader:'css',minify:true}).code.trim()).replace(/>\s+</g,'><').replace('/*SCRIPT*/',()=>code).replace(/<script>\s+/,'<script>').replace(/\s+<\/script>/,'</script>');
};
const stats=html=>({bytes:Buffer.byteLength(html),gzip:gzipSync(html,{level:9}).length});
const base=compile(sources);assert.equal(base,fs.readFileSync(root+'index.html','utf8'));
const cleanup=main=>main.replace('allI.set(m.ib, m.i0);','allI.set(m.ib, m.i0); m.ni=m.ib.length; m.vb=m.ib=0;')
 .replace(/(meshes\[[^\]]+\]|indexed|MANTA|FISH)\.ib\.length/g,'$1.ni')
 .replace('Wd.glints = Wd.volD', 'Wd.solids.data = Wd.bubbles = Wd.fish = Wd.mantas = Wd.snow = Wd.glints = Wd.volD');
const indices=main=>main.replace('allI = new Uint32Array(nI)','allI = new Uint16Array(nI)').replaceAll("setIndexBuffer(ibMesh, 'uint32')","setIndexBuffer(ibMesh, 'uint16')");
const nearworld=sources.world.replace('hypot(x - p[0], z - p[2]) < r && y < p[1] + 3 && y > p[1] - 13','y < p[1] + 3 && y > p[1] - 13 && abs(x-p[0]) < r && abs(z-p[2]) < r && hypot(x - p[0], z - p[2]) < r');
const noRays={...sources,main:sources.main.replace('  // light shafts\n','  if(cy<0){\n  // light shafts\n').replace('  // bloom\n','  }\n  // bloom\n'),shaders:sources.shaders.replace('  // depth-aware upsample of the half-res shafts','  var c = textureLoad(tS, px, 0).rgb;\n  if(g.cam.y<0.){\n  // depth-aware upsample of the half-res shafts').replace('  var c = textureLoad(tS, px, 0).rgb + acc / ws;','  c += acc / ws;\n  }')};
const variants={base,cleanup:compile({...sources,main:cleanup(sources.main)}),indices:compile({...sources,main:indices(sources.main)}),nearFlyBox:compile({...sources,world:nearworld}),aboveWaterZeroRays:compile(noRays),cleanupAndIndices:compile({...sources,main:indices(cleanup(sources.main))})};
const js=base.match(/<script>([\s\S]*?)<\/script>/)[1];const gz=gzipSync(js,{level:9});assert.equal(gunzipSync(gz).toString(),js);
const loader=`(async()=>{const b=Uint8Array.from(atob(${JSON.stringify(gz.toString('base64'))}),c=>c.charCodeAt(0)),s=document.createElement('script');s.textContent=await new Response(new Blob([b]).stream().pipeThrough(new DecompressionStream('gzip'))).text();document.body.appendChild(s);s.remove()})().catch(e=>{console.error(e);document.body.className='l e';document.getElementById('s').textContent='Failed to start: '+e.message});`;
let restored;await vm.runInNewContext(loader,{Uint8Array,atob,Response,Blob,DecompressionStream,console,document:{createElement:()=>({remove(){}}),body:{appendChild:s=>{restored=s.textContent}}}});assert.equal(restored,js);
variants.packed=base.replace(/<script>[\s\S]*?<\/script>/,()=>'<script>'+loader+'</script>');
const report={note:'Static build and loader round-trip only; no browser, heap or GPU measurements',variants:Object.fromEntries(Object.entries(variants).map(([k,v])=>[k,{...stats(v),deltaBytes:stats(v).bytes-stats(base).bytes,deltaGzip:stats(v).gzip-stats(base).gzip}]))};
fs.writeFileSync(new URL('results/footprint-review.json',import.meta.url),JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));
