import { replaceOnce } from './transforms.mjs';

// Keep the accepted per-cell selection; only the far instance storage changes.
export function sharedFar(source) {
  let s = replaceOnce(source, 'const pack = (L, step = 1, wm = 1) => {', 'const pack = (L, step = 1) => {');
  s = replaceOnce(s,
    'const buf = new ArrayBuffer(n * 36), f = new Float32Array(buf), u8 = new Uint8Array(buf), lo = new Float32Array(nCells).fill(1e9), hi = new Float32Array(nCells).fill(-1e9);',
    'const buf = step === 1 ? new ArrayBuffer(n * 36) : null, f = buf && new Float32Array(buf), u8 = buf && new Uint8Array(buf), lo = new Float32Array(nCells).fill(1e9), hi = new Float32Array(nCells).fill(-1e9);');
  s = replaceOnce(s,
    `      for (let j = 0; j < 8; j++) f[k * 9 + j] = a[i + j];
      f[k * 9 + 6] *= wm;
      u8[k * 36 + 32] = a[i + 8]; u8[k * 36 + 33] = a[i + 9] * 255; u8[k * 36 + 34] = a[i + 10] * 255; u8[k * 36 + 35] = a[i + 11] * 255;`,
    `      if (buf) {
        for (let j = 0; j < 8; j++) f[k * 9 + j] = a[i + j];
        u8[k * 36 + 32] = a[i + 8]; u8[k * 36 + 33] = a[i + 9] * 255; u8[k * 36 + 34] = a[i + 10] * 255; u8[k * 36 + 35] = a[i + 11] * 255;
      }`);
  s = replaceOnce(s, '    return { buf, n, start, lo, hi };',
    '    // Shared far leaves: keep original cell metadata, without another leaf array.\n    return buf ? { buf, n, start, lo, hi } : { n, start, lo, hi };');
  s = replaceOnce(s, 'bigF: pack(big, 2, 1.5)', 'bigF: pack(big, 2)');
  s = replaceOnce(s,
    "const pLeafF = scenePipe(mLeaf, 'vs', 'fs', [ibLeaf], { strip: true, coverage: true, constants: { CUTOUT: true, ROWS: 3 } });",
    "const pLeafF = scenePipe(mLeaf, 'vs', 'fs', [{ ...ibLeaf, arrayStride: 72 }], { strip: true, coverage: true, constants: { CUTOUT: true, ROWS: 3, WIDTH: 1.5 } });");
  s = replaceOnce(s,
    'const ibBig = buf(new Uint8Array(Wd.big.buf), BU.VERTEX), ibBigF = buf(new Uint8Array(Wd.bigF.buf), BU.VERTEX), ibSmall = buf(new Uint8Array(Wd.small.buf), BU.VERTEX);',
    'const ibBig = buf(new Uint8Array(Wd.big.buf), BU.VERTEX), ibSmall = buf(new Uint8Array(Wd.small.buf), BU.VERTEX);');
  s = replaceOnce(s, 'override FAR: f32 = 150.;', 'override FAR: f32 = 150.;\noverride WIDTH: f32 = 1.;');
  s = replaceOnce(s, '  let len = i.a.w; let hA = i.b.w;', '  let len = i.a.w; let hA = i.b.w; let wid = i.b.z * WIDTH;');
  s = replaceOnce(s, ' * i.b.z * .36 * u * shape2(v) * nearK;', ' * wid * .36 * u * shape2(v) * nearK;');
  s = replaceOnce(s,
    'select(i.b.z * .5 * shape, select(max(i.b.z * .5, .09) * shape, 0., ty == 1), shp_)',
    'select(wid * .5 * shape, select(max(wid * .5, .09) * shape, 0., ty == 1), shp_)');
  s = replaceOnce(s,
    'function drawCells(r, start, lo, hi, mar, indexed, verts, minD, maxD) {',
    'function drawCells(r, start, lo, hi, mar, indexed, verts, minD, maxD, sharedFar = false) {');
  s = replaceOnce(s, '      if (v) { if (run < 0) run = c; } else if (run >= 0) {',
    `      // Far selection restarts per cell; odd near counts prevent merging cells.
      if (sharedFar) {
        if (v) {
          const a = Wd.big.start[c], n = start[c + 1] - start[c];
          if (n > 0) {
            r.setVertexBuffer(0, ibBig, a * 36, (Wd.big.start[c + 1] - a) * 36);
            r.draw(verts, n, 0, 0);
          }
        }
        continue;
      }
      if (v) { if (run < 0) run = c; } else if (run >= 0) {`);
  return replaceOnce(s,
    'r.setPipeline(pLeafF); r.setVertexBuffer(0, ibBigF); drawCells(r, Wd.bigF.start, Wd.bigF.lo, Wd.bigF.hi, 5, false, 6, 58, 150);',
    'r.setPipeline(pLeafF); drawCells(r, Wd.bigF.start, Wd.bigF.lo, Wd.bigF.hi, 5, false, 6, 58, 150, true);');
}
