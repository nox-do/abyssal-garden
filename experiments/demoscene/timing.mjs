// One browser, serial GPU work. Round 0 warms all variants/levels and is excluded.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const names=['baseline','shadow16-bias0','shared-far','combined'];
const cases=[];
for(let round=0;round<4;round++)for(let j=0;j<3;j++){
  const q=(j+round)%3, order=round%2?[...names].reverse():names;
  for(const name of order)cases.push(`${name}:${q}`);
}
const result=spawnSync(process.execPath,[new URL('browser.mjs',import.meta.url).pathname,'--timing',...cases],{stdio:'inherit',env:{...process.env,DEMO_REPORT:'timing.json'}});
assert.equal(result.status,0);
const file=new URL('results/timing.json',import.meta.url);
const report=JSON.parse(await fs.readFile(file,'utf8'));
assert.equal(report.tests.length,48);assert.ok(report.complete);
report.protocol={warmupRounds:1,measuredRounds:3,framesPerView:120,warmupFrames:20,serialGPU:true,roundOrder:'quality rotated; variant order reversed every round',limits:['Repeated local file pages in one Chrome process; not cold browser/system starts.','GPU timestamp pass durations; serialized renders, not gameplay FPS.','Bake includes detail texture and static shadows.']};
report.tests.forEach((t,i)=>{t.round=Math.floor(i/12);t.warmup=t.round===0;});
await fs.writeFile(file,JSON.stringify(report,null,2)+'\n');
