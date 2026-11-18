import { replaceOnce } from '../leaves/variants.mjs';

// Reconstruct the pre-cleanup product without touching any other accepted feature.
export function beforeMemory(js) {
  js = replaceOnce(js, 'allI = new Uint16Array(nI)', 'allI = new Uint32Array(nI)');
  js = js.replaceAll("setIndexBuffer(ibMesh, 'uint16')", "setIndexBuffer(ibMesh, 'uint32')");
  js = replaceOnce(js, ' m.ni = m.ib.length; m.vb = m.ib = 0;', '');
  js = js.replace(/(meshes\[[^\]]+\]|indexed|MANTA|FISH)\.ni\b/g, '$1.ib.length');
  return replaceOnce(js, 'Wd.solids.data = Wd.bubbles = Wd.fish = Wd.mantas = Wd.snow = Wd.glints = Wd.volD', 'Wd.glints = Wd.volD');
}
