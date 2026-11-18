import fs from 'node:fs/promises';
import assert from 'node:assert/strict';

const root = new URL('./results/', import.meta.url);
const read = async file => JSON.parse(await fs.readFile(new URL(file, root), 'utf8'));
const [build, data, browser] = await Promise.all(['build.json', 'data.json', 'browser.json'].map(read));
const audio = await read('browser-audio.json').catch(() => browser);
const original = build.variants.original;
const packed = build.variants['original-packed'];
const packedComparisons = browser.comparisons.filter(c => c.name === 'original-packed');
assert.equal(packedComparisons.length, 3);
assert.ok(packedComparisons.every(c => c.startEqual && c.allSixViewsEqual && c.movementEqual));
assert.ok(browser.tests.every(t => !t.error && !t.errors.length && !t.requests.some(url => /^https?:/.test(url))));
assert.ok(audio.tests.filter(t => ['original', 'original-packed'].includes(t.name)).every(t => t.audio.state === 'running'));
const summary = {
  upstream: build.upstream,
  primaryResult: {
    originalHtmlBytes: original.bytes,
    packedHtmlBytes: packed.bytes,
    savedBytes: original.bytes - packed.bytes,
    savedPercent: (original.bytes - packed.bytes) / original.bytes * 100,
    restoredJavaScriptIsByteIdentical: packed.exactSourceRoundtrip,
    browser: browser.browser.product,
    platform: 'macOS, Apple Metal WebGPU adapter',
    qualityLevels: 3,
    cameraViewsPerQuality: 6,
    initialViewsAndMovementPixelIdentical: true,
    offlineFileUrlLoading: true,
    externalResourceRequests: 0,
    audioStartedWithUserGesture: true
  },
  secondaryResults: {
    terserPackedBytes: build.variants['terser-packed'].bytes,
    terserPackedSavedBytes: original.bytes - build.variants['terser-packed'].bytes,
    highQualityObjectIndexBufferSavedBytes: data.geometryReports[0].originalBytes - data.geometryReports[0].compactBytes,
    densityCopyAvoidedBytes: data.densityArrayCopyBytes,
    nearFlySyntheticMicrobenchmark: { originalMedianMs: data.nearFly.originalMedianMs, reorderedMedianMs: data.nearFly.reorderedMedianMs, queries: data.nearFly.syntheticQueries }
  },
  limits: [
    'File-size savings describe the local HTML artifact. HTTP gzip sizes are 40287 bytes original and 41197 bytes packed.',
    'Browser tests use one Chrome version on one Mac. No claim of universal browser compatibility.',
    'Fixed views and a movement sequence are pixel-compared; this is not an exhaustive full-world visual audit.',
    'The nearFly benchmark uses synthetic queries and is not an end-to-end scene speedup.',
    'Startup timings share browser caches and are not a controlled performance comparison.',
    'The mapped-buffer experiment avoids one 80 MiB JavaScript copy; peak process or GPU memory savings were not measured.',
    'Audio initialization and running state were verified; audio waveforms were not compared.'
  ]
};
await fs.writeFile(new URL('summary.json', root), JSON.stringify(summary, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
