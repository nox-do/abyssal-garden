import { spawn } from 'node:child_process';
const cases=[];
for(let round=0;round<4;round++)for(const q of [0,1,2]){
  const names=round%2?['beach','beach-before']:['beach-before','beach'];
  cases.push(...names.map(name=>name+':'+q));
}
const child=spawn(process.execPath,[new URL('browser.mjs',import.meta.url).pathname,'--beach','--timing',...cases],{
  stdio:'inherit',env:{...process.env,VISUAL_REPORT:'beach-timing.json'}
});
child.on('error',e=>{console.error(e);process.exitCode=1});
child.on('exit',code=>process.exitCode=code??1);
