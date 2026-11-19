import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=async n=>JSON.parse(await fs.readFile(new URL('results/'+n+'.json',import.meta.url),'utf8'));
const b=await read('build'),q=await read('browser'),d=await read('data'),r=await read('timing');
const shipping=await read('shipping');assert.ok(shipping.complete);assert.deepEqual(shipping.tests.map(t=>t.level),[0,1,2]);assert.ok(shipping.tests.every(t=>!t.errors.length&&t.audio.state==='running'));
assert.ok(q.complete&&q.tests.every(t=>t.dataAndResourcesPassed&&!t.errors.length));
assert.ok(r.complete&&r.protocol);
const base=b.variants.baseline,now=b.variants.jelly;
const product=await fs.readFile(new URL('../../index.html',import.meta.url));
assert.equal(createHash('sha256').update(product).digest('hex'),now.sha256);
const out={baseline:base,jelly:now,productByteIdentical:true,htmlDelta:now.bytes-base.bytes,gzipDelta:now.gzipBytes-base.gzipBytes,qa:{cases:q.tests.length,images:q.tests.reduce((s,t)=>s+t.views.length,0)},geometry:d,resources:[],timing:{protocol:r.protocol,groups:[]},limits:['Actual process/peak RAM not measured.','Serial render timing is not gameplay FPS.','One Mac/Chrome; three measured pages per group.']};
out.shipping={passed:true,cases:shipping.tests.length,date:shipping.date};
out.timing.recovery=r.recovery;
for(const level of [0,1,2]){
  const old=q.tests.find(t=>t.name==='baseline'&&t.level===level),t=q.tests.find(t=>t.name==='jelly'&&t.level===level);
  const delta=t.allocations.buffers.reduce((s,v)=>s+v.size,0)-old.allocations.buffers.reduce((s,v)=>s+v.size,0);
  const removedBytes=old.hashes['Wd.solids.data'].bytes-t.hashes['Wd.solids.data'].bytes;
  assert.equal(delta,d.gpuMeshBytes+t.hashes['Wd.jelly'].bytes-removedBytes);
  assert.equal(t.allocations.buffers.length,old.allocations.buffers.length+1);assert.deepEqual(t.allocations.textures,old.allocations.textures);
  const removedTriangles=old.solidRanges.slice(0,4).reduce((s,[start,count],i)=>s+(count-t.solidRanges[i][1])*old.hashes['meshes.'+i+'.ib'].bytes/12,0);
  const addedTriangles=t.jellyData.length/8*d.triangles;
  let maxCPUCenterError=0;
  for(const frame of t.gpuCenters.frames)for(let i=0;i<t.jellyData.length;i+=8){
    const [x,y,z,sc,seed,bob,speed,phase]=t.jellyData.slice(i,i+8),time=frame.time;
    const cpu=[x+.15*Math.sin(time*.17+phase),y+bob*Math.sin(time*.3+phase),z+.12*Math.cos(time*.13+phase)];
    for(let k=0;k<3;k++)maxCPUCenterError=Math.max(maxCPUCenterError,Math.abs(cpu[k]-frame.values[i+k]));
  }
  assert.ok(maxCPUCenterError<.0001);
  out.resources.push({level,floatingStonesBefore:old.floatingStones,floatingStonesAfter:t.floatingStones,jellyfish:t.jellyData.length/8,gpuBufferDelta:delta,removedSolidBufferBytes:removedBytes,addedJellyInstanceBytes:t.hashes['Wd.jelly'].bytes,newBuffers:1,newTextures:0,newPipelines:1,extraDrawCalls:1,removedTrianglesPerFrame:removedTriangles,jellyTrianglesPerFrame:addedTriangles,netTriangleDelta:addedTriangles-removedTriangles,unchangedHashes:Object.keys(old.hashes).length-1,paths:t.paths,maxCPUCenterError});
}
const median=a=>{a=[...a].sort((a,b)=>a-b);return a.length%2?a[a.length>>1]:(a[a.length/2-1]+a[a.length/2])/2;};
const stats=a=>({median:median(a),min:Math.min(...a),max:Math.max(...a)});
for(const level of [0,1,2])for(const name of ['baseline','jelly']){
  const a=r.tests.filter(t=>t.name===name&&t.level===level&&!t.warmup);assert.equal(a.length,3);
  out.timing.groups.push({name,level,readyMs:stats(a.map(t=>t.readyMs)),worldMs:stats(a.map(t=>t.worldMs)),views:[0,1].map(i=>({pose:a[0].benchmarks[i].pose,gpuMs:stats(a.map(t=>{assert.ok(t.benchmarks[i].gpu.length>=58);return median(t.benchmarks[i].gpu)})),cpuMeanMs:stats(a.map(t=>t.benchmarks[i].cpu.reduce((s,v)=>s+v,0)/t.benchmarks[i].cpu.length))}))});
}
await fs.writeFile(new URL('results/summary.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({htmlDelta:out.htmlDelta,resources:out.resources,qa:out.qa,timing:out.timing.groups},null,2));
