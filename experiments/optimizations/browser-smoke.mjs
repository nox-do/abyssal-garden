import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

const root = fileURLToPath(new URL('./', import.meta.url));
const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const sha256 = data => createHash('sha256').update(data).digest('hex');
class CDP {
  constructor(ws) {
    this.ws = ws; this.id = 0; this.pending = new Map(); this.listeners = [];
    ws.addEventListener('message', e => {
      const message = JSON.parse(e.data);
      if (message.id) {
        const pending = this.pending.get(message.id);
        if (pending) { this.pending.delete(message.id); clearTimeout(pending.timer); message.error ? pending.reject(new Error(JSON.stringify(message.error))) : pending.resolve(message.result); }
      } else for (const listener of this.listeners) listener(message);
    });
  }
  send(method, params = {}, sessionId) {
    const id = ++this.id;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { this.pending.delete(id); reject(new Error('CDP timeout: ' + method)); }, 30000);
      this.pending.set(id, { resolve, reject, timer });
      this.ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }));
    });
  }
  async evaluate(session, expression, userGesture = false) {
    const response = await this.send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture }, session);
    if (response.exceptionDetails) throw new Error(JSON.stringify(response.exceptionDetails));
    return response.result.value;
  }
}

const profile = await fs.mkdtemp(path.join(os.tmpdir(), 'abyssal-chrome-'));
const logPath = path.join(root, 'results', process.env.ABYSSAL_LOG || 'chrome.log');
await fs.writeFile(logPath, '');
const chrome = spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', [
  '--headless=new', '--no-first-run', '--no-default-browser-check', '--disable-background-networking',
  '--disable-component-update', '--remote-debugging-address=127.0.0.1', '--remote-debugging-port=0',
  '--user-data-dir=' + profile, '--window-size=1280,720', 'about:blank'
], { stdio: ['ignore', 'pipe', 'pipe'] });
chrome.stdout.on('data', d => fs.appendFile(logPath, d).catch(() => {}));
chrome.stderr.on('data', d => fs.appendFile(logPath, d).catch(() => {}));
let cdp;
const report = { date: new Date().toISOString(), offline: true, viewport: { width: 1280, height: 720, deviceScaleFactor: 1 }, tests: [] };
const reportFile = path.join(root, 'results', process.env.ABYSSAL_REPORT || 'browser.json');
try {
  let endpoint;
  for (let i = 0; i < 100; i++) {
    try { const [port, suffix] = (await fs.readFile(path.join(profile, 'DevToolsActivePort'), 'utf8')).trim().split('\n'); endpoint = `ws://127.0.0.1:${port}${suffix}`; break; } catch {}
    if (chrome.exitCode !== null) throw new Error('Chrome exited: ' + chrome.exitCode);
    await sleep(100);
  }
  assert.ok(endpoint, 'Chrome debugging endpoint unavailable');
  const ws = new WebSocket(endpoint);
  await new Promise((resolve, reject) => { ws.addEventListener('open', resolve, { once: true }); ws.addEventListener('error', reject, { once: true }); });
  cdp = new CDP(ws);
  report.browser = await cdp.send('Browser.getVersion');
  const args = process.argv.slice(2);
  const cases = args.includes('--probe') ? [['original', 2, true]] : args.length ? args.map(arg => { const [name, level = '0'] = arg.split(':'); return [name, Number(level), false]; }) : [
    ['original', 0, false], ['original-packed', 0, false], ['near-fly-uint16', 0, false],
    ['near-fly-uint16-mapped', 0, false], ['terser-packed', 0, false],
    ['original', 1, false], ['original-packed', 1, false], ['near-fly-uint16', 1, false],
    ['original', 2, false], ['original-packed', 2, false], ['near-fly-uint16', 2, false]
  ];
  for (const [name, level, probe] of cases) {
    console.log('Starting ' + name + ', quality ' + level + (probe ? ' (probe)' : ''));
    const { targetId } = await cdp.send('Target.createTarget', { url: 'about:blank' });
    const { sessionId } = await cdp.send('Target.attachToTarget', { targetId, flatten: true });
    const errors = [], requests = [], failures = [];
    const listener = message => {
      if (message.sessionId !== sessionId) return;
      if (message.method === 'Runtime.exceptionThrown') errors.push(message.params.exceptionDetails);
      if (message.method === 'Runtime.consoleAPICalled' && message.params.type === 'error') errors.push(message.params.args.map(a => a.description || a.value));
      if (message.method === 'Network.requestWillBeSent') requests.push(message.params.request.url);
      if (message.method === 'Network.loadingFailed') failures.push(message.params);
    };
    cdp.listeners.push(listener);
    try {
      await cdp.send('Page.enable', {}, sessionId);
      await cdp.send('Runtime.enable', {}, sessionId);
      await cdp.send('Network.enable', {}, sessionId);
      await cdp.send('Network.emulateNetworkConditions', { offline: true, latency: 0, downloadThroughput: 0, uploadThroughput: 0 }, sessionId);
      await cdp.send('Emulation.setDeviceMetricsOverride', { ...report.viewport, mobile: false }, sessionId);
      await cdp.send('Page.addScriptToEvaluateOnNewDocument', { source: `
        window.__testStart=performance.now();
        try { localStorage.abyssal='${level}'; localStorage.abyssalLoad=''; } catch(e) {}
        const raf=requestAnimationFrame.bind(window), pending=[];
        let frozen=true, simulatedTime=0;
        window.requestAnimationFrame=callback=>frozen?(pending.push(callback),pending.length):raf(callback);
        window.__resumeFrames=()=>{frozen=false;for(const callback of pending.splice(0))raf(callback)};
        window.__stepFrames=(count=1)=>{for(let i=0;i<count;i++){const callback=pending.shift();if(callback)callback(simulatedTime+=1000/60)}};
        const submit=GPUQueue.prototype.submit;
        GPUQueue.prototype.submit=function(commands){const value=submit.call(this,commands);window.__gpuIdle=this.onSubmittedWorkDone();return value};
        const NativeAudioContext=AudioContext;
        window.AudioContext=class extends NativeAudioContext{constructor(...args){super(...args);window.__audioContext=this}};
        window.__startupStages=[];
        addEventListener('DOMContentLoaded',()=>{
          const node=document.getElementById('s');
          if(node)new MutationObserver(()=>window.__startupStages.push({text:node.textContent,ms:performance.now()-window.__testStart})).observe(node,{childList:true,characterData:true,subtree:true});
        });
      ` }, sessionId);
      await cdp.send('Page.navigate', { url: pathToFileURL(path.join(root, 'variants', name + '.html')).href }, sessionId);
      await sleep(150);
      const capabilities = await cdp.evaluate(sessionId, `(async()=>{const a=navigator.gpu&&await navigator.gpu.requestAdapter();return {secure:isSecureContext,webgpu:!!navigator.gpu,adapter:!!a,adapterInfo:a?{vendor:a.info.vendor,architecture:a.info.architecture,device:a.info.device,description:a.info.description}:null,decompression:typeof DecompressionStream}})()`);
      if (probe) { report.tests.push({ name, level, capabilities, errors, requests }); console.log(JSON.stringify(report.tests.at(-1))); continue; }
      assert.ok(capabilities.adapter, 'No WebGPU adapter');
      let state;
      const deadline = Date.now() + 180000;
      while (Date.now() < deadline) {
        state = await cdp.evaluate(sessionId, `({body:document.body.className,status:document.getElementById('s')?.textContent,ms:performance.now()-window.__testStart,stages:window.__startupStages})`);
        if (state.body === 'm' || state.body.includes('e')) break;
        await sleep(1000);
      }
      assert.equal(state.body, 'm', 'Scene did not reach menu: ' + JSON.stringify(state));
      assert.equal(errors.length, 0, 'Browser errors: ' + JSON.stringify(errors));
      if (process.env.ABYSSAL_TIMING === '1') {
        const nearFly = await cdp.evaluate(sessionId, 'globalThis.__nearFlyReport');
        assert.ok(Number.isFinite(nearFly?.worldMs), 'World timing missing');
        assert.deepEqual(requests.filter(url => /^https?:/.test(url)), []);
        report.tests.push({name,level,nearFly,stages:state.stages,errors,requests});
        console.log(JSON.stringify({name,level,worldMs:nearFly.worldMs}));
        await fs.writeFile(reportFile, JSON.stringify(report,null,2)+'\n');
        continue;
      }
      await cdp.evaluate(sessionId, `document.body.className='g';document.querySelector('canvas').style.transition='none';document.querySelector('canvas').style.filter='none';document.querySelector('canvas').style.transform='none';document.querySelector('canvas').style.opacity='1';document.getElementById('m').style.display='none';document.getElementById('o').style.display='none'`);
      await sleep(150);
      const screenshot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
      const screenshotBytes = Buffer.from(screenshot.data, 'base64');
      const screenshotFile = name + '-q' + level + '.png';
      await fs.writeFile(path.join(root, 'results', screenshotFile), screenshotBytes);
      const heap = await cdp.send('Runtime.getHeapUsage', {}, sessionId);
      const views = [];
      await cdp.evaluate(sessionId, `document.getElementById('d').click();window.__stepFrames(1)`, true);
      assert.ok((await cdp.evaluate(sessionId, 'document.body.className')).startsWith('g'), 'Dive-in did not enter the scene');
      for (let pose = 1; pose <= 6; pose++) {
        await cdp.evaluate(sessionId, `dispatchEvent(new KeyboardEvent('keydown',{code:'Digit${pose}'}));window.__stepFrames(1);window.__gpuIdle`);
        const shot = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
        const bytes = Buffer.from(shot.data, 'base64');
        const filename = name + '-q' + level + '-pose' + pose + '.png';
        await fs.writeFile(path.join(root, 'results', filename), bytes);
        views.push({ pose, screenshotFile: filename, sha256: sha256(bytes) });
      }
      await cdp.evaluate(sessionId, `dispatchEvent(new KeyboardEvent('keydown',{code:'KeyW'}));window.__stepFrames(10);dispatchEvent(new KeyboardEvent('keyup',{code:'KeyW'}));window.__gpuIdle`);
      const moved = await cdp.send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false }, sessionId);
      const movementSha256 = sha256(Buffer.from(moved.data, 'base64'));
      assert.notEqual(movementSha256, views.at(-1).sha256, 'Forward movement must change the scene');
      await cdp.evaluate(sessionId, `dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));dispatchEvent(new KeyboardEvent('keydown',{code:'KeyM'}));dispatchEvent(new KeyboardEvent('keydown',{code:'Escape'}));`);
      assert.equal(await cdp.evaluate(sessionId, 'document.body.className'), 'm', 'Escape must return to the menu');
      const audio = await cdp.evaluate(sessionId, `({created:!!window.__audioContext,state:window.__audioContext?.state,sampleRate:window.__audioContext?.sampleRate})`);
      assert.ok(audio.created, 'Audio context must initialize on dive-in');
      assert.equal(audio.state, 'running', 'Audio must run after the user gesture');
      await cdp.evaluate(sessionId, 'window.__resumeFrames()');
      await sleep(1000);
      assert.equal(errors.length, 0, 'Runtime errors after interaction: ' + JSON.stringify(errors));
      assert.deepEqual(requests.filter(url => /^https?:/.test(url)), [], 'No external resource requests expected');
      const nearFly = await cdp.evaluate(sessionId, 'globalThis.__nearFlyReport || null');
      const result = { name, level, capabilities, startupMs: state.ms, stages: state.stages, screenshotFile, screenshotSha256: sha256(screenshotBytes), views, movementSha256, audio, liveAnimationChecked: true, heap, errors, requests, failures, ...(nearFly ? { nearFly } : {}) };
      report.tests.push(result);
      console.log(JSON.stringify({ name, level, startupMs: result.startupMs, screenshotSha256: result.screenshotSha256, requests, errors }));
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
    } catch (error) {
      report.tests.push({ name, level, error: error.message, errors, requests, failures });
      console.log('FAILED ' + name + ': ' + error.message);
      await fs.writeFile(reportFile, JSON.stringify(report, null, 2) + '\n');
      if (!probe) throw error;
    } finally {
      cdp.listeners = cdp.listeners.filter(l => l !== listener);
      await cdp.send('Target.closeTarget', { targetId });
    }
  }
  if (!process.argv.includes('--probe') && process.env.ABYSSAL_TIMING !== '1') {
    const baselineName = process.env.ABYSSAL_BASELINE || 'original';
    report.comparisons = report.tests.filter(test => test.name !== baselineName).map(test => {
      const baseline = report.tests.find(other => other.name === baselineName && other.level === test.level);
      if (!baseline) return { name: test.name, level: test.level, baselineMissing: true };
      const startEqual = baseline.screenshotSha256 === test.screenshotSha256;
      const allViewsEqual = test.views.every((view, i) => view.sha256 === baseline.views[i].sha256);
      const movementEqual = test.movementSha256 === baseline.movementSha256;
      assert.ok(startEqual && allViewsEqual && movementEqual, 'Image mismatch: ' + test.name + ' quality ' + test.level);
      if (baseline.nearFly && test.nearFly) {
        assert.equal(test.nearFly.worldSha256, baseline.nearFly.worldSha256, 'Generated world differs');
        assert.equal(test.nearFly.queryCount, baseline.nearFly.queryCount, 'Query stream differs');
      }
      return { name: test.name, level: test.level, startEqual, allSixViewsEqual: allViewsEqual, movementEqual };
    });
    console.log('All available baseline comparisons passed: ' + report.comparisons.length);
  }
} finally {
  await fs.writeFile(process.argv.includes('--probe') ? path.join(root, 'results', 'browser-probe.json') : reportFile, JSON.stringify(report, null, 2) + '\n');
  if (cdp) { try { await cdp.send('Browser.close'); } catch {} cdp.ws.close(); }
  if (chrome.exitCode === null) chrome.kill();
  await sleep(250);
  await fs.rm(profile, { recursive: true, force: true, maxRetries: 3 }).catch(() => {});
}
