import { spawn } from 'node:child_process';
const cases=[];
for(let round=0;round<6;round++) for(const level of [0,1,2]) {
  const names=round%2?['organic','baseline']:['baseline','organic'];
  cases.push(...names.map(n=>n+':'+level));
}
// First pair per quality is warm-up; analysis excludes it. Fresh page each case.
const child=spawn(process.execPath,[new URL('browser.mjs',import.meta.url).pathname,'--timing',...cases],{stdio:'inherit',env:process.env});
child.on('error',e=>{console.error(e);process.exitCode=1});
child.on('exit',code=>process.exitCode=code??1);
