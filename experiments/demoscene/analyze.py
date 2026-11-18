"""Compare original captures; differences locate regressions, not a quality score."""
import json
import sys
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

root = Path(__file__).parent / 'results'
stem = sys.argv[1] if len(sys.argv) > 1 else 'browser'
report = json.loads((root / (stem + '.json')).read_text())
assert report['complete']
out = {'report': stem, 'comparisons': [], 'limits': [
    'Pixel metrics locate differences, not aesthetic acceptance or flicker guarantees.',
    'One machine/browser; buffer sizes and nominal texture payload are not process memory.'
]}
for t in report['tests']:
    if t['name'] == 'baseline': continue
    bases = [b for b in report['tests'] if b['name'] == 'baseline' and b['level'] == t['level']]
    if not bases: continue
    b = bases[0]
    assert t['dataAndResourcesPassed'] and not t['errors']
    metrics = []; temporal = []; previous = {}
    for a, v in zip(b['views'], t['views']):
        assert all(a[k] == v[k] for k in ['label','camera','time','width','height','detail'])
        before = np.asarray(Image.open(root / a['file']).convert('RGB')).astype(np.int16)
        after = np.asarray(Image.open(root / v['file']).convert('RGB')).astype(np.int16)
        d = np.abs(after-before)
        group = 'time' if v['label'].startswith('time') else 'travel' if v['label'].startswith('travel') else None
        if group:
            error = after-before
            if group in previous:
                step = np.abs(error-previous[group])
                temporal.append(dict(label=v['label'],mean=float(step.mean()),maximum=int(step.max()),pixelsOver16=int(np.any(step>16,axis=2).sum())))
            previous[group] = error
        metrics.append(dict(label=v['label'], changedPixels=int(np.any(d,axis=2).sum()),
            mean=float(d.mean()), maximum=int(d.max()), pixelsOver16=int(np.any(d>16,axis=2).sum())))
    rec = dict(name=t['name'], level=t['level'], images=metrics, temporalErrorChange=temporal,
        identicalImages=sum(m['changedPixels']==0 for m in metrics),
        worst=sorted(metrics,key=lambda m:m['mean'],reverse=True)[:5])
    out['comparisons'].append(rec)
    for rank,m in enumerate(rec['worst'][:3]):
        a=next(v for v in b['views'] if v['label']==m['label'])
        v=next(v for v in t['views'] if v['label']==m['label'])
        im0=Image.open(root/a['file']).convert('RGB'); im1=Image.open(root/v['file']).convert('RGB')
        d=np.abs(np.asarray(im0).astype(np.int16)-np.asarray(im1).astype(np.int16))
        score=d.mean(axis=2).reshape(18,40,32,40).mean(axis=(1,3))
        y,x=np.unravel_index(score.argmax(),score.shape)
        left=min(max(int(x)*40-140,0),960);top=min(max(int(y)*40-140,0),400)
        box=(left,top,left+320,top+320)
        panel=Image.new('RGB',(960,350),'#14212b');draw=ImageDraw.Draw(panel)
        panel.paste(im0.crop(box),(0,30));panel.paste(im1.crop(box),(320,30))
        heat=Image.fromarray(np.clip(d*4,0,255).astype(np.uint8));panel.paste(heat.crop(box),(640,30))
        for i,label in enumerate(['Baseline',t['name'],'Difference x4']):draw.text((i*320+8,8),label,fill='white')
        panel.save(root/f"{stem}-{t['name']}-q{t['level']}-worst{rank}.png")
    print(t['name'],t['level'],'identical',rec['identicalImages'],'/',len(metrics),'worst',rec['worst'][:2])
if stem == 'shared-browser':
    other=json.loads((root/'shadow-browser.json').read_text())
    out['combinedAgainstShadow']=[]
    for t in report['tests']:
        if t['name']!='combined': continue
        b=next(v for v in other['tests'] if v['name']=='shadow16-bias0' and v['level']==t['level'])
        for a,v in zip(b['views'],t['views']):
            x=np.array(Image.open(root/a['file']).convert('RGB')).astype(np.int16)
            y=np.array(Image.open(root/v['file']).convert('RGB')).astype(np.int16)
            d=np.abs(x-y)
            if d.max(): out['combinedAgainstShadow'].append(dict(level=t['level'],label=v['label'],changedPixels=int(np.any(d,axis=2).sum()),maximum=int(d.max()),mean=float(d.mean())))
(root/(stem+'-summary.json')).write_text(json.dumps(out,indent=2)+'\n')
