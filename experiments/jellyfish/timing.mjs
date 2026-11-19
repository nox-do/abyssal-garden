import {spawnSync} from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const cases=[];
for(let round=0;round<4;round++)for(let j=0;j<3;j++)for(const name of round%2?['jelly','baseline']:['baseline','jelly'])cases.push(`${name}:${(j+round)%3}`);
const path=new URL('results/timing.json',import.meta.url),resume=process.argv.includes('--resume');
let prefix=[],retryWarmup=0,run=cases;
if(resume){
  const interrupted=JSON.parse(await fs.readFile(path,'utf8'));assert.ok(!interrupted.complete);
  await fs.writeFile(new URL('results/timing-interrupted.json',import.meta.url),JSON.stringify(interrupted,null,2)+'\n');
  for(const t of interrupted.tests){if(t.benchmarks?.length!==2||t.benchmarks.some(b=>b.cpu.length!==60||b.gpu.length<58)||t.errors.length)break;prefix.push(t);}
  assert.deepEqual(prefix.map(t=>`${t.name}:${t.level}`),cases.slice(0,prefix.length));
  const q=cases[prefix.length].split(':')[1];retryWarmup=2;run=[`baseline:${q}`,`jelly:${q}`,...cases.slice(prefix.length)];
}
const output=resume?'timing-retry.json':'timing.json';
const result=spawnSync(process.execPath,[new URL('browser.mjs',import.meta.url).pathname,'--timing',...run],{stdio:'inherit',env:{...process.env,JELLY_REPORT:output}});
assert.equal(result.status,0);
const r=JSON.parse(await fs.readFile(new URL('results/'+output,import.meta.url),'utf8'));assert.ok(r.complete);
if(resume){r.tests=[...prefix,...r.tests.slice(retryWarmup)];r.recovery={completedPrefix:prefix.length,retryWarmupPages:retryWarmup,reason:'Runtime.evaluate timeout; Chrome logged CVDisplayLink/Invalid mailbox errors. Retry remaining cases in a fresh browser.'};}
assert.equal(r.tests.length,24);
r.tests.forEach((t,i)=>{t.round=Math.floor(i/6);t.warmup=t.round===0;});
r.protocol={warmupRounds:1,measuredRounds:3,views:2,warmupFrames:20,measuredFrames:60,serialGPU:true,limits:['Repeated local pages, not cold starts.','GPU timestamps of serial render passes, not gameplay FPS.','One Mac/Chrome; no process/peak RAM measurement.']};
await fs.writeFile(path,JSON.stringify(r,null,2)+'\n');
