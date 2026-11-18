// Geometry invariants independent of Chrome and its timing instrumentation.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {patchedParts} from '../fish/patch-source.mjs';
const repo=new URL('../../',import.meta.url);
const math=await fs.readFile(new URL('source/src/math.js',repo),'utf8');
const world=await fs.readFile(new URL('source/src/world.js',repo),'utf8');
const original=execFileSync('git',['show','cc3d14b:source/src/world.js'],{cwd:repo,encoding:'utf8'});
const names=['quality.js','math.js','shaders.js','world.js','main.js','audio.js'];
const parts=Object.fromEntries(names.map(n=>[n,execFileSync('git',['show','cc3d14b:source/src/'+n],{cwd:repo,encoding:'utf8'})]));
const angular=await patchedParts(parts,new URL('angular.patch',import.meta.url));
const replay=await patchedParts(angular,new URL('shape-only.patch',import.meta.url));
for(const name of names)assert.equal(replay[name],await fs.readFile(new URL('source/src/'+name,repo),'utf8'));
const evaluate=(text,reef)=>vm.runInNewContext(math+'\n'+text.slice(text.indexOf('function meshFish('))+`\nconst m=meshFish(${reef});({p:m.p,i:m.i,...m.build()});`);
const old=evaluate(original,false),same=evaluate(world,false),rounded=evaluate(world,true);
for(const key of ['vb','ib'])assert.deepEqual(Buffer.from(same[key].buffer||same[key]),Buffer.from(old[key].buffer||old[key]));
assert.equal(rounded.p.length/3,110);assert.equal(rounded.i.length/3,210);
const n=new Int8Array(rounded.vb);let minNormal=Infinity,minArea=Infinity,maxRadius=0;
for(let k=0;k<rounded.p.length/3;k++){
  const [x,y,z]=rounded.p.slice(k*3,k*3+3),[nx,ny,nz]=Array.from(n.slice(k*16+12,k*16+15),v=>v/127);
  assert.ok([x,y,z,nx,ny,nz].every(Number.isFinite));
  const length=Math.hypot(nx,ny,nz);assert.ok(length>.99&&length<1.01);
  if(k<104){const radial=ny*y+nz*z;assert.ok(radial>0);minNormal=Math.min(minNormal,radial);}
  // Shader maximum size, inverse aspect, and worst possible lateral tail bend.
  const s=.46*1.25,xx=x*s,yy=y*s*1.65,zz=Math.abs(z*s*.85)+Math.abs(.22*(.25*.46-xx));
  maxRadius=Math.max(maxRadius,Math.hypot(xx,yy,zz));
}
assert.ok(n[104*16+12]>0&&n[105*16+12]<0,'Closed snout and tail cap face outward');
for(let k=0;k<rounded.i.length;k+=3){
  const [a,b,c]=rounded.i.slice(k,k+3).map(i=>{assert.ok(i>=0&&i<110);return rounded.p.slice(i*3,i*3+3)});
  const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
  const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
  assert.ok(area>1e-8);minArea=Math.min(minArea,area);
}
assert.ok(maxRadius<.4,'Existing GPU path probe reserve still bounds the deformed model');
const report={sourceMatchFromPatches:true,legacyMeshByteIdentical:true,vertices:110,triangles:210,vertexBytes:rounded.vb.byteLength,indexBytes:rounded.ib.byteLength/2,gpuBytes:rounded.vb.byteLength+rounded.ib.byteLength/2,temporaryMeshTypedArrayBytes:rounded.vb.byteLength+rounded.ib.byteLength,extraTrianglesPerFrame:56*(210-50),minOutwardRadialDot:minNormal,minTriangleArea:minArea,maxDeformedRadiusBound:maxRadius,limits:['Typed-array payload only; JS objects, driver overhead and peak process RAM not measured.','The radius is an analytical upper bound using maximum size and bend, not a sampled GPU position.']};
await fs.writeFile(new URL('results/data.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
