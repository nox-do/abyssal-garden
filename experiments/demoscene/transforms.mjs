export const replaceOnce = (s, a, b) => {
  if (s.split(a).length !== 2) throw Error('Transform anchor changed: ' + a);
  return s.replace(a, () => b);
};
export function shadow16(s, bias = 0) {
  s = replaceOnce(s, "DEPTH = 'depth32float';", "DEPTH = 'depth32float', SHADOW_DEPTH = 'depth16unorm';");
  s = replaceOnce(s, 'tex(SHADOW, SHADOW, DEPTH,', 'tex(SHADOW, SHADOW, SHADOW_DEPTH,');
  return replaceOnce(s, "format: DEPTH, depthWriteEnabled: true, depthCompare: 'less', depthBias: 2,", "format: SHADOW_DEPTH, depthWriteEnabled: true, depthCompare: 'less', depthBias: " + bias + ',');
}
