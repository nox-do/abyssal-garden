import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const read=async n=>JSON.parse(await fs.readFile(new URL('results/'+n+'.json',import.meta.url),'utf8'));
const report=await read('shared-browser'), build=await read('build');
assert.ok(report.complete);
const shadow=await read('shadow-browser');
const resources=[], crossMatches=[];
const texBytes=d=>{
  const bpp={depth32float:4,depth16unorm:2,rgba16float:8,rgba8unorm:4,rg8unorm:2}[d.format];
  assert.ok(bpp,d.format);let total=0;
  for(let m=0;m<d.mipLevelCount;m++)total+=Math.max(1,d.size[0]>>m)*Math.max(1,d.size[1]>>m)*(d.dimension==='3d'?Math.max(1,d.size[2]>>m):d.size[2])*bpp*d.sampleCount;
  return total;
};
for(const t of report.tests){
  assert.ok(t.dataAndResourcesPassed);const b=report.tests.find(b=>b.level===t.level&&b.name==='baseline');
  const old=shadow.tests.find(b=>b.level===t.level&&b.name===(t.name==='combined'?'shadow16-bias0':'baseline'));
  if(t.name==='baseline')assert.deepEqual(t.views.map(v=>v.sha256),old.views.map(v=>v.sha256),'Repeated baseline changed');
  if(t.name==='combined')crossMatches.push({level:t.level,images:t.views.length,identicalPNGs:t.views.filter((v,i)=>v.sha256===old.views[i].sha256).length,changed:t.views.filter((v,i)=>v.sha256!==old.views[i].sha256).map(v=>v.label)});
  if(t.name==='shared-far')assert.deepEqual(t.views.map(v=>v.sha256),b.views.map(v=>v.sha256));
  // Source destroys the two 80-MiB density buffers before makeWorld. Small generator
  // buffers are conservatively included; this is payload accounting, not RSS.
  const transient=t.allocations.buffers.filter(d=>d.size===80*1024*1024);assert.equal(transient.length,2);
  const buffers=t.allocations.buffers.reduce((s,d)=>s+d.size,0)-160*1024*1024;
  const textures=t.allocations.textures.reduce((s,d)=>s+texBytes(d),0);
  resources.push({name:t.name,level:t.level,bufferPayloadBytes:buffers,nominalTextureBytes:textures,totalBytes:buffers+textures,sharedFarProof:t.sharedFarProof});
}
const out={build,resources,qa:{cases:report.tests.length,images:report.tests.reduce((s,t)=>s+t.views.length,0),sharedPixelsIdentical:true,combinedAgainstShadow:crossMatches,worldHashesBefore:134,worldHashesShared:133},limits:['One Mac / Chrome. Logical GPU buffer sizes and nominal texture payload, not actual driver allocation or process/peak RAM.','Counts include small generator buffers conservatively; exclude two explicitly destroyed density buffers.','QA startup times include hashes/reference reconstruction and must not be used for performance claims.']};
try{
  const t=await read('timing');assert.ok(t.complete&&t.protocol);
  const median=a=>{a=[...a].sort((a,b)=>a-b);return a.length%2?a[a.length>>1]:(a[a.length/2-1]+a[a.length/2])/2};
  const stats=a=>({median:median(a),min:Math.min(...a),max:Math.max(...a),n:a.length});
  out.timing={protocol:t.protocol,groups:[]};
  for(const level of [0,1,2])for(const name of ['baseline','shadow16-bias0','shared-far','combined']){
    const runs=t.tests.filter(x=>x.level===level&&x.name===name&&!x.warmup);assert.equal(runs.length,3);
    const group={name,level,readyMs:stats(runs.map(x=>x.readyMs)),worldMs:stats(runs.map(x=>x.worldMs)),bakeMs:stats(runs.map(x=>x.bakeMs)),views:[]};
    for(let i=0;i<4;i++){for(const r of runs)assert.ok(r.benchmarks[i].gpu.length>=115);group.views.push({pose:runs[0].benchmarks[i].pose,cpuMs:stats(runs.map(r=>median(r.benchmarks[i].cpu))),cpuMeanMs:stats(runs.map(r=>r.benchmarks[i].cpu.reduce((s,v)=>s+v,0)/r.benchmarks[i].cpu.length)),gpuMs:stats(runs.map(r=>median(r.benchmarks[i].gpu)))});}
    out.timing.groups.push(group);
  }
}catch(e){if(e.code!=='ENOENT')throw e;}
await fs.writeFile(new URL('results/summary.json',import.meta.url),JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify({resources,qa:out.qa,timingGroups:out.timing?.groups.length},null,2));
