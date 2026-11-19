import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const repo=new URL('../../',import.meta.url);
const math=await fs.readFile(new URL('source/src/math.js',repo),'utf8');
const world=await fs.readFile(new URL('source/src/world.js',repo),'utf8');
const m=vm.runInNewContext(math+'\n'+world.slice(world.indexOf('function meshJelly()'))+'\nconst m=meshJelly();({p:m.p,i:m.i,...m.build()});');
const n=new Int8Array(m.vb);let minArea=Infinity,minOutward=Infinity;
for(let k=0;k<m.nv;k++){
  const p=m.p.slice(k*3,k*3+3),normal=Array.from(n.slice(k*16+12,k*16+15),v=>v/127);
  assert.ok([...p,...normal].every(Number.isFinite));assert.ok(Math.abs(Math.hypot(...normal)-1)<.01);
  if(k<193){const dot=p.reduce((s,v,i)=>s+v*normal[i],0);assert.ok(dot>0);minOutward=Math.min(minOutward,dot);}
}
for(let k=0;k<m.i.length;k+=3){
  const [a,b,c]=m.i.slice(k,k+3).map(i=>{assert.ok(i>=0&&i<m.nv&&i<65536);return m.p.slice(i*3,i*3+3);});
  const u=b.map((x,i)=>x-a[i]),v=c.map((x,i)=>x-a[i]);
  const area=Math.hypot(u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0])/2;
  assert.ok(area>1e-9);minArea=Math.min(minArea,area);
}
const report={vertices:m.nv,triangles:m.i.length/3,vertexBytes:m.vb.byteLength,indexBytes:m.ib.byteLength/2,gpuMeshBytes:m.vb.byteLength+m.ib.byteLength/2,temporaryMeshTypedBytes:m.vb.byteLength+m.ib.byteLength,minTriangleArea:minArea,minOutwardDot:minOutward};
await fs.writeFile(new URL('results/data.json',import.meta.url),JSON.stringify(report,null,2)+'\n');console.log(report);
