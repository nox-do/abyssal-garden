// Recovery for the recorded two interrupted runs; never pick the fastest retry.
// Keep every complete planned case, retry only the missing suffix in fresh browsers.
import fs from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import assert from 'node:assert/strict';
const here=new URL('./',import.meta.url),read=async n=>JSON.parse(await fs.readFile(new URL('results/'+n+'.json',here),'utf8'));
const complete=t=>t.benchmarks?.length===2&&t.benchmarks.every(b=>b.cpu.length===60&&b.gpu.length>=58)&&!t.errors.length;
const prefix=r=>{const a=[];for(const t of r.tests){if(!complete(t))break;a.push(t);}return a;};
const initial=await read('timing-interrupted'),retry=await read('timing-retry');
assert.ok(!initial.complete&&!retry.complete);
const tests=[...prefix(initial),...prefix(retry).slice(2)],before=tests.length,cases=[];
for(let round=0;round<4;round++)for(let j=0;j<3;j++)for(const name of round%2?['jelly','baseline']:['baseline','jelly'])cases.push(`${name}:${(j+round)%3}`);
assert.deepEqual(tests.map(t=>`${t.name}:${t.level}`),cases.slice(0,before));
for(let i=before;i<cases.length;i++){
  const output=`timing-single-${i}.json`;
  const p=spawnSync(process.execPath,[new URL('browser.mjs',here).pathname,'--timing',cases[i],cases[i]],{stdio:'inherit',env:{...process.env,JELLY_REPORT:output}});
  assert.equal(p.status,0);const r=await read(output.slice(0,-5));assert.ok(r.complete&&complete(r.tests[1]));tests.push(r.tests[1]);
}
assert.equal(tests.length,24);tests.forEach((t,i)=>{t.round=Math.floor(i/6);t.warmup=t.round===0;});
const r={...initial,complete:true,tests,recovery:{interruptions:2,completedInitial:prefix(initial).length,completedFirstRetry:prefix(retry).length-2,firstRetryWarmupPages:2,freshBrowserCases:24-before,warmupPerFreshBrowser:1,reason:'Runtime.evaluate timeouts in both candidate and baseline; Chrome logged CVDisplayLink/Invalid mailbox errors. All completed cases retained.'},protocol:{warmupRounds:1,measuredRounds:3,views:2,warmupFrames:20,measuredFrames:60,serialGPU:true,limits:['Repeated local pages, not cold starts.','GPU timestamps of serial render passes, not gameplay FPS.','Two interrupted runs; remaining cases completed in fresh browsers with warmup.','One Mac/Chrome; no process/peak RAM measurement.']}};
await fs.writeFile(new URL('results/timing.json',here),JSON.stringify(r,null,2)+'\n');console.log({complete:true,cases:tests.length,recovery:r.recovery});
