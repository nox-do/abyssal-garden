import { spawn } from 'node:child_process';

// A single Chrome process, fresh page per case. First round warms the browser;
// five further rounds rotate/reverse the order to reduce ordering bias.
const names=['original','height','box','grid8','grid16','grid32'];
const cases=[];
for(let round=0;round<6;round++){
  const order=names.map((_,i)=>names[(i+round)%names.length]);
  if(round%2)order.reverse();
  cases.push(...order.map(n=>'nf-time-'+n+':0'));
}
const child=spawn(process.execPath,[new URL('browser-smoke.mjs',import.meta.url).pathname,...cases],{
  stdio:'inherit',env:{...process.env,ABYSSAL_TIMING:'1',ABYSSAL_REPORT:'near-fly-timing.json',ABYSSAL_LOG:'near-fly-chrome-timing.log'}
});
child.on('error',e=>{console.error(e);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
