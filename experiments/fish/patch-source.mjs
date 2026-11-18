// Reconstruct an uncommitted experiment without changing the working tree.
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
export async function patchedParts(parts, patch) {
  const dir=await fs.mkdtemp(path.join(os.tmpdir(),'abyssal-patch-'));
  try {
    await fs.mkdir(path.join(dir,'source/src'),{recursive:true});
    for(const [name,text] of Object.entries(parts))await fs.writeFile(path.join(dir,'source/src',name),text);
    execFileSync('git',['apply','--no-index',patch.pathname],{cwd:dir});
    return Object.fromEntries(await Promise.all(Object.keys(parts).map(async name=>[name,await fs.readFile(path.join(dir,'source/src',name),'utf8')])));
  }finally{await fs.rm(dir,{recursive:true,force:true});}
}
