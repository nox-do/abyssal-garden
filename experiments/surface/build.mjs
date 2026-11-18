import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { transformSync } from '../../source/node_modules/esbuild/lib/main.js';
import { contour, replaceOnce } from '../leaves/variants.mjs';
import { beforeMemory } from './memory-variant.mjs';
const root=new URL('../../',import.meta.url),here=new URL('./',import.meta.url);
const files=['quality.js','math.js','shaders.js','world.js','main.js','audio.js'];
const old=f=>execFileSync('git',['show','461db8a:source/'+f],{cwd:root,encoding:'utf8'});
const template=await fs.readFile(new URL('source/template.html',root),'utf8');
const current=await Promise.all(files.map(f=>fs.readFile(new URL('source/src/'+f,root),'utf8')));
const boundary=process.argv.includes('--boundary');
const memory=process.argv.includes('--memory');
const beach=process.argv.includes('--beach');
const joined=current.join('\n');
let beachBefore;
if(beach||memory){
  const tmp=await fs.mkdtemp(path.join(os.tmpdir(),'abyssal-beach-build-'));
  try{
    await fs.mkdir(path.join(tmp,'source/src'),{recursive:true});
    for(let i=0;i<files.length;i++)await fs.writeFile(path.join(tmp,'source/src',files[i]),current[i]);
    execFileSync('git',['apply','--reverse',fileURLToPath(new URL('beach-only.patch',here))],{cwd:tmp});
    beachBefore=(await Promise.all(files.map(f=>fs.readFile(path.join(tmp,'source/src',f),'utf8')))).join('\n');
  }finally{await fs.rm(tmp,{recursive:true,force:true});}
}
// Reconstruct just the premature limit, keeping every other product change identical.
const beforeBoundary=js=>replaceOnce(replaceOnce(replaceOnce(js,
  'const CO = 8, CN = 124,','const CO = 52, CN = 102,'),
  '> 62) continue; // 186 m: includes the coast and a margin for collision samples','> 52) continue; // more than 156 m out: never reached'),
  'if (rad > 180) { x *= 180 / rad; z *= 180 / rad; }','if (rad > 150) { x *= 150 / rad; z *= 150 / rad; }');
const sources=beach?{'beach-before':beachBefore,beach:joined}:memory?{'memory-before':beforeMemory(beachBefore),memory:beachBefore}:boundary?{'boundary-before':beforeBoundary(joined),boundary:joined}:{baseline:contour(files.map(f=>old('src/'+f)).join('\n')),surface:joined};
const sha=b=>createHash('sha256').update(b).digest('hex');
const compile=js=>{
  js=js.replace(/\/\*wgsl\*\/`([^`]*)`/g,(_,w)=>'`'+w.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|!%@]) ?/g,'$1').trim()+'`');
  const wrapped=`(async()=>{${js}\n})().catch(e=>{console.error(e);document.body.className='l e';document.getElementById('s').textContent=(e.cause?'':'Failed to start: ')+e.message});`;
  const code=transformSync(wrapped,{minify:true,target:'es2022',legalComments:'none'}).code.trim();
  return template.replace(/<style>([^]*?)(?=<\/style>)/,(_,s)=>'<style>'+transformSync(s,{loader:'css',minify:true}).code.trim()).replace(/>\s+</g,'><').replace('/*SCRIPT*/',()=>code).replace(/<script>\s+/,'<script>').replace(/\s+<\/script>/,'</script>');
};
const previous=await fs.readFile(new URL('../visual-quality/build.mjs',here),'utf8');
const api=previous.split('const api = `')[1].split('\n`;')[0];
const extra=`
globalThis.__visual.reset=function(){F[VX]=F[VY]=F[VZ]=F[LAST]=0;kf=kb=kl=kr=ku=kd=ks=0;};
globalThis.__visual.swim=async function(pose,keys,frames=120,fast=false){
  lookAt(...pose);F[VX]=F[VY]=F[VZ]=0;F[TIME]=8;dynT=-Infinity;
  kf=kb=kl=kr=ku=kd=ks=0;for(const code of keys)key({code},1);
  const states=[];let clearance=1;for(let i=0;i<frames;i++){frame(F[LAST]+1000/60,fast);if(!fast)await Q.onSubmittedWorkDone();states.push(Array.from(F.slice(0,3)));if(fast)clearance=min(clearance,-max(rockAt(F[CX],F[CY],F[CZ]),rockAt(F[CX],F[CY]-.9*sstep(-1.2,.28,F[CY]),F[CZ])));}
  kf=kb=kl=kr=ku=kd=ks=0;return {states,clearance,end:this.state(),collision:typeof rockAt==='function'?[rockAt(F[CX],F[CY],F[CZ]),rockAt(F[CX],F[CY]-.9*sstep(-1.2,.28,F[CY]),F[CZ])]:null};
};
`;
await fs.mkdir(new URL('variants/',here),{recursive:true});await fs.mkdir(new URL('results/',here),{recursive:true});
const report={baseline:beach?'Current product with beach-only.patch reversed':memory?'Current product with only CPU cleanup and Uint16 object indices reverted':boundary?'Current product with only collision extent and movement limit reverted':'461db8a + accepted contour transform',node:process.version,
  sources:Object.fromEntries(files.map((f,i)=>[f,sha(current[i])])),variants:{}};
for(const [name,source] of Object.entries(sources)){
  let js=source;const html=compile(js);
  await fs.writeFile(new URL('variants/'+name+'.html',here),html);
  report.variants[name]={bytes:Buffer.byteLength(html),gzipBytes:gzipSync(html,{level:9}).length,sha256:sha(html)};
  js=replaceOnce(js,'const Wd = makeWorld(D, T, flyPts, POSES);','const __worldStart=performance.now();const Wd = makeWorld(D, T, flyPts, POSES);globalThis.__worldMs=performance.now()-__worldStart;');
  js=replaceOnce(js,'F[GPU] = ms;','F[GPU] = ms;if(globalThis.__visualGpu)globalThis.__visualGpu.push(ms);');
  js=replaceOnce(js,'let CG = new Int8Array(64 * 65534);','const __collisionStart=performance.now();let CG = new Int8Array(64 * 65534);');
  js=replaceOnce(js,'CG = CG.slice(0, n * 64);','if(n>=65534)throw Error("Collision brick index overflow");CG = CG.slice(0, n * 64);globalThis.__collisionMs=performance.now()-__collisionStart;');
  await fs.writeFile(new URL('variants/'+name+'-timing.html',here),compile(js+api));
  js=replaceOnce(js,'D = Wd.gy = T.smp = null;','await globalThis.__hashWorld({D,T,Wd,CI,CG});D = Wd.gy = T.smp = null;');
  if(beach)js=replaceOnce(js,'D = Wd.gy = T.smp = null;',`globalThis.__bounds=[T,Wd.big,Wd.bigF,Wd.small,...Wd.chunks,...Wd.props].map(o=>({lo:Array.from(o.lo),hi:Array.from(o.hi)}));await globalThis.__hashWorld({groundOtherChannels:Wd.gm.filter((v,i)=>i%4!==1)});D = Wd.gy = T.smp = null;`);
  js=replaceOnce(js,'let nV = 0, nI = 0;','await globalThis.__hashWorld({meshes});let nV = 0, nI = 0;');
  js+=`globalThis.__collisionLayers=Array.from({length:NY/4},(_,y)=>({bottom:OY+y*4*VS,top:OY+(y*4+3)*VS,bricks:0}));for(let i=0;i<CI.length;i++)if(CI[i]>1)globalThis.__collisionLayers[Math.floor(i/CN)%(NY/4)].bricks++;`;
  if(memory){
    js=replaceOnce(js,'let nV = 0, nI = 0;',`for(const m of meshes)for(const index of m.ib)if(index>65535)throw Error('Mesh index exceeds Uint16');let nV = 0, nI = 0;`);
    js=replaceOnce(js,'const vbMesh = buf(allV, BU.VERTEX), ibMesh = buf(allI, BU.INDEX);',`await globalThis.__hashWorld({objectVertices:allV,objectIndices:new Uint32Array(allI)});const vbMesh = buf(allV, BU.VERTEX), ibMesh = buf(allI, BU.INDEX);`);
    js+=`globalThis.__retainedCPU=meshes.reduce((n,m)=>n+(m.vb?.byteLength||0)+(m.ib?.byteLength||0),0)+[Wd.solids.data,Wd.bubbles,Wd.fish,Wd.mantas,Wd.snow].reduce((n,a)=>n+(a?.byteLength||0),0);`;
  }
  js=replaceOnce(js,'function frame(now) {','function frame(now, probe=false) {');
  js=replaceOnce(js,'  render();\n  if (hud) {','  if(!probe)render();\n  if (hud) {');
  let probe=name!=='baseline'?`globalThis.__visual.rock=rockAt;`:'';
  await fs.writeFile(new URL('variants/'+name+'-qa.html',here),compile(js+api+extra+probe));
}
await fs.writeFile(new URL('results/'+(beach?'beach-':memory?'memory-':boundary?'boundary-':'')+'build.json',here),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.variants,null,2));
