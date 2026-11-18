// Isolated experiment: never edits the frozen reference or the product sources.
import fs from 'node:fs/promises';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { performance } from 'node:perf_hooks';

const original = 'const nearFly = (x, y, z, r) => { for (const p of flyPts) if (hypot(x - p[0], z - p[2]) < r && y < p[1] + 3 && y > p[1] - 13) return true; return false; };';
const height = 'y < p[1] + 3 && y > p[1] - 13';
const distance = 'hypot(x - p[0], z - p[2]) < r';
export const candidates = {
  original,
  height: `const nearFly = (x,y,z,r) => { for (const p of flyPts) if (${height} && ${distance}) return true; return false; };`,
  box: `const nearFly = (x,y,z,r) => { for (const p of flyPts) if (${height} && abs(x-p[0]) < r && abs(z-p[2]) < r && ${distance}) return true; return false; };`,
  squared: `const nearFly = (x,y,z,r) => { for (const p of flyPts) if (${height} && (x-p[0])**2 + (z-p[2])**2 < r*r) return true; return false; };`,
};
for (const size of [8, 16, 32]) candidates['grid' + size] = `
  const fw=${size}, fx=floor(min(...flyPts.map(p=>p[0]))/fw), fz=floor(min(...flyPts.map(p=>p[2]))/fw);
  const fnx=floor(max(...flyPts.map(p=>p[0]))/fw)-fx+1, fnz=floor(max(...flyPts.map(p=>p[2]))/fw)-fz+1;
  const fh=new Int16Array(fnx*fnz).fill(-1), fn=new Int16Array(flyPts.length);
  for(let i=0;i<flyPts.length;i++){const p=flyPts[i],k=floor(p[0]/fw)-fx+fnx*(floor(p[2]/fw)-fz);fn[i]=fh[k];fh[k]=i;}
  const nearFly=(x,y,z,r)=>{
    const xa=max(0,floor((x-r)/fw)-fx), xb=min(fnx-1,floor((x+r)/fw)-fx);
    const za=max(0,floor((z-r)/fw)-fz), zb=min(fnz-1,floor((z+r)/fw)-fz);
    for(let iz=za;iz<=zb;iz++)for(let ix=xa;ix<=xb;ix++)for(let i=fh[ix+fnx*iz];i!==-1;i=fn[i]){
      const p=flyPts[i];if(${height} && ${distance})return true;
    }return false;
  };`;

const compile = (code, points) => new Function('flyPts', `const {hypot,abs,floor,min,max}=Math;${code};return nearFly;`)(points);
export function replay(points, queries, codes, rounds = 7) {
  const now = () => performance.now();
  const prepared = Object.entries(codes).map(([name, code]) => {
    const t=now(), fn=new Function('flyPts', `const {hypot,abs,floor,min,max}=Math;${code};return nearFly;`)(points);
    return {name, fn, setupMs:now()-t, trials:[]};
  });
  const run = fn => {let matches=0;const t=now();for(const q of queries)matches+=fn(...q);return {ms:now()-t,matches};};
  for(const p of prepared)run(p.fn);
  for(let round=0;round<rounds;round++)for(let j=0;j<prepared.length;j++){
    const p=prepared[(j+round)%prepared.length];p.trials.push(run(p.fn));
  }
  return prepared.map(({name,setupMs,trials})=>({name,setupMs,medianMs:medianLocal(trials.map(t=>t.ms)),trials}));
  function medianLocal(a){return a.sort((a,b)=>a-b)[a.length>>1];}
}

export async function buildSuite({parts, build, metrics}) {
  const root = new URL('./', import.meta.url);
  const pathSource=parts.main.slice(parts.main.indexOf('const POSES = ['),parts.main.indexOf("await say('Growing kelp"));
  const ctx=vm.createContext({});
  vm.runInContext(parts.math+'\n'+pathSource+'\nglobalThis.points=flyPts;',ctx);
  const points=JSON.parse(JSON.stringify(ctx.points));
  assert.ok(points.length < 32768, 'Linked grid uses signed 16-bit point indices');
  let seed=20261118;
  const rnd=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);
  const radii=[1.3,2.2,3,3.5,4,6];
  const queries=Array.from({length:20000},()=>[rnd()*384-192,rnd()*59-56,rnd()*384-192,radii[rnd()*radii.length|0]]);
  const boundaries=[];
  for(const p of points)for(const r of radii)for(const a of [0,Math.PI/4,Math.PI/2,Math.PI])for(const epsilon of [-1e-12,0,1e-12]){
    boundaries.push([p[0]+Math.cos(a)*(r+epsilon),p[1],p[2]+Math.sin(a)*(r+epsilon),r]);
  }
  for(const p of points)for(const y of [p[1]+3,p[1]-13])for(const eps of [-1e-12,0,1e-12])boundaries.push([p[0],y+eps,p[2],3]);
  // Cell boundaries and the region outside the grid, including negative positions.
  for(let x=-200;x<=200;x+=8)for(let z=-200;z<=200;z+=8)for(const r of radii)boundaries.push([x,-40,z,r]);
  const reference=compile(original,points), expected=[...queries,...boundaries].map(q=>reference(...q));
  const checks={};
  for(const [name,code] of Object.entries(candidates)){
    const fn=compile(code,points);let mismatches=0,firstMismatch;
    for(const [i,q] of [...queries,...boundaries].entries())if(fn(...q)!==expected[i]){mismatches++;firstMismatch??={query:q,expected:expected[i],actual:fn(...q)};}
    checks[name]={mismatches,...(firstMismatch?{firstMismatch}:{})};
    if(name!=='squared')assert.equal(mismatches,0,name+' must preserve every decision');
  }
  const timings=replay(points,queries,candidates);
  const report={date:new Date().toISOString(),node:process.version,points:points.length,syntheticQueries:queries.length,boundaryQueries:boundaries.length,checks,timings,variants:{},gridPayloadBytes:{}};
  for(const size of [8,16,32]){
    const nx=Math.floor(Math.max(...points.map(p=>p[0]))/size)-Math.floor(Math.min(...points.map(p=>p[0]))/size)+1;
    const nz=Math.floor(Math.max(...points.map(p=>p[2]))/size)-Math.floor(Math.min(...points.map(p=>p[2]))/size)+1;
    report.gridPayloadBytes['grid'+size]=2*(nx*nz+points.length);
  }
  await fs.mkdir(new URL('variants/',root),{recursive:true});
  assert.equal(parts.world.split(original).length,2,'Expected exactly one nearFly declaration');
  for(const [name,code] of Object.entries(candidates)){
    const world=parts.world.replace(original,()=>code);
    const html=await build({...parts,world});
    if(name==='original')assert.equal(html,await fs.readFile(new URL('upstream/index.html',root),'utf8'),'Reference build must be byte-identical');
    report.variants[name]=metrics(html);
    // Squared distance is diagnostic only; excluded when boundary decisions differ.
    if(checks[name].mismatches)continue;
    const collectingCode=code.replace('const nearFly=', 'const nfRaw=').replace('const nearFly =','const nfRaw =')+
      '\nconst nfQueries=[];const nearFly=(...q)=>{nfQueries.push(q);return nfRaw(...q)};';
    const measuredWorld=parts.world.replace(original,()=>collectingCode).replace('  return { gy, glints:', '  globalThis.__nfQueries=nfQueries;\n  return { gy, glints:');
    const hook=`
      globalThis.__nearFlyReport={name:${JSON.stringify(name)},worldMs:performance.now()-nfStart};
      const nfParts=[];let nfBytes=0;
      async function nfHash(v,path='world'){
        if(ArrayBuffer.isView(v)){nfBytes+=v.byteLength;const h=await crypto.subtle.digest('SHA-256',new Uint8Array(v.buffer,v.byteOffset,v.byteLength));nfParts.push([path,v.constructor.name,v.length,Array.from(new Uint8Array(h),b=>b.toString(16).padStart(2,'0')).join('')]);}
        else if(v&&typeof v==='object'){for(const k of Object.keys(v))await nfHash(v[k],path+'.'+k);}
        else if(typeof v!=='function')nfParts.push([path,v]);
      }
      await nfHash(Wd);
      globalThis.__nearFlyReport.worldDataBytes=nfBytes;
      const nfDigest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(nfParts)));
      globalThis.__nearFlyReport.worldSha256=Array.from(new Uint8Array(nfDigest),b=>b.toString(16).padStart(2,'0')).join('');
      globalThis.__nearFlyReport.queryCount=globalThis.__nfQueries.length;
      globalThis.__nearFlyReport.replay=(${replay.toString()})(flyPts,globalThis.__nfQueries,${JSON.stringify(Object.fromEntries(Object.entries(candidates).filter(([k])=>!checks[k].mismatches)))},7);
      globalThis.__nfQueries=null;
    `;
    const main=parts.main.replace('const Wd = makeWorld(D, T, flyPts, POSES);','const nfStart=performance.now();\nconst Wd = makeWorld(D, T, flyPts, POSES);\n'+hook);
    await fs.writeFile(new URL('variants/nf-'+name+'.html',root),await build({...parts,world:measuredWorld,main}));
    await fs.writeFile(new URL('variants/near-fly-'+name+'.html',root),html);
    const timingMain=parts.main.replace('const Wd = makeWorld(D, T, flyPts, POSES);',
      `const nfStart=performance.now();\nconst Wd = makeWorld(D, T, flyPts, POSES);\nglobalThis.__nearFlyReport={name:${JSON.stringify(name)},worldMs:performance.now()-nfStart};`)
      .replace('ui(true);\nrequestAnimationFrame', 'ui(true);\nglobalThis.__nearFlyReport.readyMs=performance.now()-globalThis.__testStart;\nrequestAnimationFrame');
    await fs.writeFile(new URL('variants/nf-time-'+name+'.html',root),await build({...parts,world,main:timingMain}));
  }
  await fs.writeFile(new URL('results/near-fly-data.json',root),JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify(report,null,2));
}
