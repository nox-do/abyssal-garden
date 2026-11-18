import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const read=async n=>JSON.parse(await fs.readFile(new URL('results/'+n+'.json',import.meta.url),'utf8'));
const b=await read('build'),q=await read('browser'),d=await read('data'),r=await read('timing');
const shipping=await read('shipping');assert.ok(shipping.complete);assert.deepEqual(shipping.tests.map(t=>t.level),[0,1,2]);assert.ok(shipping.tests.every(t=>!t.errors.length&&t.audio.state==='running'));
assert.ok(q.complete&&q.tests.every(t=>t.dataAndResourcesPassed&&!t.errors.length));
assert.ok(r.complete&&r.protocol);
const base=b.variants.baseline,now=b.variants.rounded;
const product=await fs.readFile(new URL('../../index.html',import.meta.url));
assert.equal(createHash('sha256').update(product).digest('hex'),now.sha256);
const out={baseline:base,rounded:now,productByteIdentical:true,htmlDelta:now.bytes-base.bytes,gzipDelta:now.gzipBytes-base.gzipBytes,qa:{cases:q.tests.length,images:q.tests.reduce((s,t)=>s+t.views.length,0)},geometry:d,resources:[],timing:{protocol:r.protocol,groups:[]},limits:['Actual process/peak RAM not measured.','Serial render timing is not gameplay FPS.','One Mac/Chrome; three measured pages per group.']};
out.shipping={passed:true,cases:shipping.tests.length,date:shipping.date};
for(const level of [0,1,2]){
  const old=q.tests.find(t=>t.name==='baseline'&&t.level===level),t=q.tests.find(t=>t.name==='rounded'&&t.level===level);
  const delta=t.allocations.buffers.reduce((s,v)=>s+v.size,0)-old.allocations.buffers.reduce((s,v)=>s+v.size,0);
  assert.equal(delta,d.gpuBytes);assert.equal(t.allocations.buffers.length,old.allocations.buffers.length);
  assert.deepEqual(t.allocations.textures,old.allocations.textures);assert.deepEqual(t.allocations.pipelines,old.allocations.pipelines);
  out.resources.push({level,extraGPUBufferBytes:delta,newBuffers:0,newTextures:0,newPipelines:0,extraDrawCalls:t.fishDraws.length-old.fishDraws.length,fishBefore:old.fishData.length/8,fishAfter:t.fishData.length/8,unchangedHashes:Object.keys(old.hashes).length,addedHashes:2});
}
const median=a=>{a=[...a].sort((a,b)=>a-b);return a.length%2?a[a.length>>1]:(a[a.length/2-1]+a[a.length/2])/2;};
const stats=a=>({median:median(a),min:Math.min(...a),max:Math.max(...a)});
for(const level of [0,1,2])for(const name of ['baseline','rounded']){
  const a=r.tests.filter(t=>t.name===name&&t.level===level&&!t.warmup);assert.equal(a.length,3);
  out.timing.groups.push({name,level,readyMs:stats(a.map(t=>t.readyMs)),worldMs:stats(a.map(t=>t.worldMs)),views:[0,1].map(i=>({pose:a[0].benchmarks[i].pose,gpuMs:stats(a.map(t=>{assert.ok(t.benchmarks[i].gpu.length>=58);return median(t.benchmarks[i].gpu)})),cpuMeanMs:stats(a.map(t=>t.benchmarks[i].cpu.reduce((s,v)=>s+v,0)/t.benchmarks[i].cpu.length))}))});
}
await fs.writeFile(new URL('results/summary.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({htmlDelta:out.htmlDelta,gpuBytes:d.gpuBytes,qa:out.qa,timing:out.timing.groups},null,2));
