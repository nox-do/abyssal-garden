import fs from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { gzipSync } from 'node:zlib';
import { execFileSync } from 'node:child_process';
import { transformSync } from '../../source/node_modules/esbuild/lib/main.js';
import { variants, replaceOnce } from './variants.mjs';
const root=new URL('../../',import.meta.url), here=new URL('./',import.meta.url);
const files=['quality.js','math.js','shaders.js','world.js','main.js','audio.js'];
// Explicit product checkpoint so experiments remain reproducible after adoption.
const revision='461db8a';
const read=f=>execFileSync('git',['show',revision+':source/'+f],{cwd:root,encoding:'utf8'});
const source=Object.fromEntries(files.map(f=>[f,read('src/'+f)]));
const template=read('template.html');
const sha=b=>createHash('sha256').update(b).digest('hex');
const compile=js=>{
  js=js.replace(/\/\*wgsl\*\/`([^`]*)`/g,(_,w)=>'`'+w.replace(/\/\/[^\n]*/g,'').replace(/\s+/g,' ').replace(/ ?([{}()\[\];,:=+\-*\/<>&|!%@]) ?/g,'$1').trim()+'`');
  const wrapped=`(async()=>{${js}\n})().catch(e=>{console.error(e);document.body.className='l e';document.getElementById('s').textContent=(e.cause?'':'Failed to start: ')+e.message});`;
  const code=transformSync(wrapped,{minify:true,target:'es2022',legalComments:'none'}).code.trim();
  return template.replace(/<style>([^]*?)(?=<\/style>)/,(_,s)=>'<style>'+transformSync(s,{loader:'css',minify:true}).code.trim()).replace(/>\s+</g,'><').replace('/*SCRIPT*/',()=>code).replace(/<script>\s+/,'<script>').replace(/\s+<\/script>/,'</script>');
};
// Same API as the material study; no test hooks in uninstrumented files.
const previous=await fs.readFile(new URL('../visual-quality/build.mjs',here),'utf8');
const api=previous.split('const api = `')[1].split('\n`;')[0];
if(!api.includes('globalThis.__visual'))throw Error('QA API not found');
await fs.mkdir(new URL('variants/',here),{recursive:true});
await fs.mkdir(new URL('results/',here),{recursive:true});
const report={revision,node:process.version,sources:Object.fromEntries(files.map(f=>[f,sha(source[f])])),variants:{}};
for(const [name,transform] of Object.entries(variants)) {
  let js=transform(files.map(f=>source[f]).join('\n'));
  const html=compile(js);
  await fs.writeFile(new URL('variants/'+name+'.html',here),html);
  report.variants[name]={bytes:Buffer.byteLength(html),gzipBytes:gzipSync(html,{level:9}).length,sha256:sha(html)};
  js=replaceOnce(js,'const Wd = makeWorld(D, T, flyPts, POSES);','const __worldStart=performance.now(); const Wd = makeWorld(D, T, flyPts, POSES); globalThis.__worldMs=performance.now()-__worldStart;');
  js=replaceOnce(js,'F[GPU] = ms;','F[GPU] = ms; if(globalThis.__visualGpu) globalThis.__visualGpu.push(ms);');
  await fs.writeFile(new URL('variants/'+name+'-timing.html',here),compile(js+api));
  js=replaceOnce(js,'D = Wd.gy = T.smp = null;','await globalThis.__hashWorld({D,T,Wd,CI,CG}); D = Wd.gy = T.smp = null;');
  js=replaceOnce(js,'let nV = 0, nI = 0;','await globalThis.__hashWorld({meshes}); let nV = 0, nI = 0;');
  // QA-only specimen view: identical leaf shader, two known instances, fixed
  // camera. Suppress proximity fade so the silhouette can be inspected closely.
  js=replaceOnce(js,'  let farK = select(', '  let farK0 = select(');
  js=replaceOnce(js,'  let ruf = sin(', '  let farK = select(farK0, 1., g.mis.w > .5);\n  let ruf = sin(');
  const begin=js.indexOf('  r.setPipeline(pTerrain); r.setVertexBuffer(0, vbTerrain);');
  const end=js.indexOf('\n  r.end();\n  // light shafts',begin);
  if(begin<0||end<0)throw Error('Specimen render hooks missing');
  const verts=name==='geometry'?[26,14,10]:[18,10,6];
  js=js.slice(0,begin)+'  if(!globalThis.__leafLab) {\n'+js.slice(begin,end)+`
  } else {
    const mode=globalThis.__leafLab-1;
    r.setPipeline([pLeaf,pLeaf5,pLeafF][mode]);r.setVertexBuffer(0,__labBuffer);r.draw([${verts}][mode],2);
    r.setPipeline(pBack);r.draw(4);
  }`+js.slice(end);
  const lab=`
const __labBytes=new ArrayBuffer(72), __labF=new Float32Array(__labBytes), __labU=new Uint8Array(__labBytes);
for(let k=0;k<2;k++) { __labF.set([k?1.1:-1.1,-22,-7,2.5,Math.PI/2,0.3,1.2,0],k*9);__labU.set([k?3:0,90,158,128],k*36+32); }
const __labBuffer=buf(new Uint8Array(__labBytes),BU.VERTEX);
globalThis.__visual.lab=async function(mode=1,time=8,side=0){
  globalThis.__leafLab=mode;UB[59]=1;lookAt(side,-20.6,-3,0,-20.6,-7);F[TIME]=time;dynT=-Infinity;render();await Q.onSubmittedWorkDone();
  const result=this.state();globalThis.__leafLab=0;UB[59]=0;return result;
};
`;
  await fs.writeFile(new URL('variants/'+name+'-qa.html',here),compile(js+api+lab));
}
await fs.writeFile(new URL('results/build.json',here),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report.variants,null,2));
