import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
import os from 'node:os';

const root=new URL('./results/',import.meta.url);
const read=async name=>JSON.parse(await fs.readFile(new URL(name,root),'utf8'));
const [data,high,lower,timing]=await Promise.all(['near-fly-data.json','near-fly-browser.json','near-fly-browser-lower.json','near-fly-timing.json'].map(read));
const median=a=>[...a].sort((a,b)=>a-b)[a.length>>1];
const visual=[...high.tests,...lower.tests];
for(const level of [0,1,2]){
  const baseline=visual.find(t=>t.level===level&&t.name==='nf-original');
  assert.ok(baseline,'Missing baseline quality '+level);
  for(const t of visual.filter(t=>t.level===level)){
    assert.ok(!t.error,t.error);
    assert.equal(t.nearFly.worldSha256,baseline.nearFly.worldSha256);
    assert.equal(t.nearFly.worldDataBytes,baseline.nearFly.worldDataBytes);
    assert.equal(t.nearFly.queryCount,baseline.nearFly.queryCount);
    assert.equal(t.screenshotSha256,baseline.screenshotSha256);
    assert.deepEqual(t.views.map(v=>v.sha256),baseline.views.map(v=>v.sha256));
    assert.equal(t.movementSha256,baseline.movementSha256);
    assert.equal(t.audio.state,'running');
    assert.equal(t.errors.length,0);
  }
}
assert.equal(visual.length,18);
assert.equal(timing.tests.length,36);
const measured=timing.tests.slice(6); // Discard the entire first warmup round.
const variants={};
for(const name of ['original','height','box','grid8','grid16','grid32']){
  const runs=measured.filter(t=>t.nearFly.name===name);
  assert.equal(runs.length,5);
  const world=runs.map(t=>t.nearFly.worldMs),ready=runs.map(t=>t.nearFly.readyMs);
  assert.ok([...world,...ready].every(Number.isFinite));
  const realQueries=high.tests[0].nearFly.replay.find(v=>v.name===name);
  variants[name]={htmlBytes:data.variants[name].bytes,htmlDeltaBytes:data.variants[name].bytes-data.variants.original.bytes,httpGzipDeltaBytes:data.variants[name].gzipBytes-data.variants.original.gzipBytes,
    additionalTypedArrayPayloadBytes:data.gridPayloadBytes[name]||0,
    highQualityRealQueryReplayMedianMs:realQueries.medianMs,
    worldMedianMs:median(world),worldRangeMs:[Math.min(...world),Math.max(...world)],
    readyMedianMs:median(ready),readyRangeMs:[Math.min(...ready),Math.max(...ready)]};
}
for(const v of Object.values(variants)){
  v.worldSavedMs=variants.original.worldMedianMs-v.worldMedianMs;
  v.worldSavedPercent=100*v.worldSavedMs/variants.original.worldMedianMs;
  v.readySavedMs=variants.original.readyMedianMs-v.readyMedianMs;
}
const report={date:new Date().toISOString(),node:data.node,browser:high.browser,
  host:{platform:os.platform(),release:os.release(),architecture:os.arch(),cpu:os.cpus()[0]?.model},
  syntheticQueries:data.syntheticQueries,boundaryQueries:data.boundaryQueries,
  qualityLevels:[0,1,2],visualCases:visual.length,comparedAlternatives:15,
  allGeneratedWorldDataAndEightViewsEqual:true,
  realQueryCounts:Object.fromEntries([0,1,2].map(level=>[level,visual.find(t=>t.level===level).nearFly.queryCount])),
  rejected:{squared:data.checks.squared},warmupCases:6,measuredRounds:5,variants,
  limitations:[
    'Single Mac, Chrome, WebGPU backend; not a general browser or hardware guarantee.',
    'Visual cases collect queries and hash output; their startup timings are unsuitable for performance comparisons.',
    'Timing cases use only timestamps around makeWorld (including index setup) and after the initial GPU frame/menu reveal; no query recording, replay or hashing.',
    'Timing uses fresh pages in one warmed Chrome process; it is not a cold application or operating-system startup measurement.',
    'Typed array payload excludes object headers, temporary setup arrays and engine overhead. No total or peak memory saving has been measured.',
    'Every candidate retains all path points; none reduces the HTML or world output memory versus the original.',
    'Squared distances differ at strict radius boundaries and are excluded from browser candidates.'
  ]};
await fs.writeFile(new URL('near-fly-summary.json',root),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify(report,null,2));
