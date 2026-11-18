// Focused transforms of the product at checkpoint 461db8a. No world changes.
export function replaceOnce(source, before, after) {
  if (source.split(before).length !== 2) throw Error('Expected one match: ' + before.slice(0, 90));
  return source.replace(before, after);
}

export function normals(js) {
  // N and T0 also deform the geometry. Keep them untouched; correct only shading.
  js = replaceOnce(js, '  o.cp = g.vp * vec4f(p, 1.); o.wp = p; o.n = normalize(N2 + S * u * .55 - T0 * cos(v * 10. + s2 * 30. + t * .6) * u * .7 * nearK);', `
  let slN = sK + wv + cos(wph) * .12 * wav * v * (3. + 5. * s2);
  let nShade = normalize(pe * cK - d * slN);
  let tShade = normalize(d * cK + pe * slN);
  o.cp = g.vp * vec4f(p, 1.); o.wp = p; o.n = normalize(nShade * cos(tw) - sd * sin(tw) + S * u * .55 - tShade * cos(v * 10. + s2 * 30. + t * .6) * u * .7 * nearK);`);
  return js;
}

export function geometry(js) {
  for (const [before,after] of [
    ["constants: { ROWS: 9 } });", "constants: { ROWS: 13 } });"],
    ["constants: { ROWS: 5 } });", "constants: { ROWS: 7 } });"],
    ["const pLeafF = scenePipe(mLeaf, 'vs', 'fs', [ibLeaf], { strip: true, constants: { ROWS: 3 } });", "const pLeafF = scenePipe(mLeaf, 'vs', 'fs', [ibLeaf], { strip: true, constants: { ROWS: 5 } });"],
    ['5, false, 18, 0, 24);','5, false, 26, 0, 24);'],
    ['5, false, 10, 24, 58);','5, false, 14, 24, 58);'],
    ['5, false, 6, 58, 150);','5, false, 10, 58, 150);']
  ]) js=replaceOnce(js,before,after);
  return js;
}

export function contour(js) {
  js=replaceOnce(js,'override ROWS: f32 = 7.;','override ROWS: f32 = 7.;\noverride CUTOUT: bool = false;');
  js=replaceOnce(js,'@location(5) @interpolate(flat) sd: vec2f, @location(6) @interpolate(flat) spc: vec3f };',
    '@location(5) @interpolate(flat) sd: vec2f, @location(6) @interpolate(flat) spc: vec3f, @location(7) @interpolate(flat) edge: vec3f };');
  js=replaceOnce(js,'fn shape2(v: f32) -> f32 { return sin(3.14159 * sat(v)); }', `
fn shape2(v: f32) -> f32 { return sin(3.14159 * sat(v)); }
fn leafWidth(v: f32, s: vec2f) -> f32 { return pow(max(sin(3.14159 * pow(sat(v), s.x)), 0.), s.y); }
@fragment fn fsSh(i: LO) { if (i.edge.z > .5 && abs(i.uv.x) > leafWidth(i.uv.y, i.edge.xy)) { discard; } }
`);
  js=replaceOnce(js,'  let shape = pow(max(sin(3.14159 * pow(v, shp.x)), 0.), shp.y);',
    '  let cut = CUTOUT && ty != 1;\n  let shape = select(leafWidth(v, shp), 1., cut);');
  js=replaceOnce(js,'  o.col = col; o.pr = pr; o.sd = vec2f(s1, s2); o.spc = spc;',
    '  o.col = col; o.pr = pr; o.sd = vec2f(s1, s2); o.spc = spc; o.edge = vec3f(shp, f32(cut));');
  js=replaceOnce(js,'@fragment fn fs(i: LO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {', `
@fragment fn fs(i: LO, @builtin(front_facing) ff: bool) -> @location(0) vec4f {
  let width = leafWidth(i.uv.y, i.edge.xy);
  let edge = width - abs(i.uv.x);
  let coverage = ss(-.5, .5, edge / max(fwidth(edge), 1e-4));
  if (i.edge.z > .5 && coverage < select(.001, .5, LOW)) { discard; }
  let uv = vec2f(select(i.uv.x, i.uv.x / max(width, .001), i.edge.z > .5), i.uv.y);
`);
  // Only the leaf color fragment uses normalized blade UVs. Preserve the mask UVs.
  const start=js.indexOf('  let dist = length(i.wp - g.cam.xyz);',js.indexOf('@fragment fn fs(i: LO'));
  const end=js.indexOf('// ---------------------------------------------------------------- fish + mantas',start);
  const leafFs=js.slice(start,end).replaceAll('i.uv','uv').replace('return fin(fog(c, i.wp, z));','return vec4f(fin(fog(c, i.wp, z)).rgb, select(1., coverage, i.edge.z > .5 && !LOW));');
  js=js.slice(0,start)+leafFs+js.slice(end);
  js=replaceOnce(js,'multisample: { count: AA } });','multisample: { count: AA, alphaToCoverageEnabled: !!o.coverage && AA > 1 } });');
  js=replaceOnce(js,'const shadowPipe = (m, vsE, buffers, o = {}) => device.createRenderPipeline({ layout: pl0,',
    "const shadowPipe = (m, vsE, buffers, o = {}) => device.createRenderPipeline({ layout: pl0,\n  fragment: o.clip ? { module: m, entryPoint: 'fsSh', targets: [] } : undefined,");
  for(const pipe of ['pLeaf','pLeaf5','pLeafF']) {
    const re=new RegExp('const '+pipe+' = scenePipe[^\\n]+');
    const line=js.match(re)?.[0];if(!line)throw Error(pipe);
    js=replaceOnce(js,line,line.replace('strip: true, constants:', 'strip: true, coverage: true, constants:').replace('constants: { ROWS:', 'constants: { CUTOUT: true, ROWS:'));
  }
  js=replaceOnce(js,"const pLeafSh = shadowPipe(mLeaf, 'vs', [ibLeaf], { strip: true, constants: { ROWS: 3 } });",
    "const pLeafSh = shadowPipe(mLeaf, 'vs', [ibLeaf], { strip: true, clip: true, constants: { CUTOUT: true, ROWS: 3 } });");
  return js;
}

export function balanced(js) {
  // Concentrate the existing rows at both ends, where the width changes fastest.
  return replaceOnce(js, 'let v = sin(f32(vi >> 1u) / (ROWS - 1.) * 1.5708);',
    'let v = .5 - .5 * cos(f32(vi >> 1u) / (ROWS - 1.) * 3.14159);');
}

export const variants = { baseline: js=>js, normals, contour, geometry, balanced };
