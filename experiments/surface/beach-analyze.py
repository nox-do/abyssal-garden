"""Costs and controlled image comparisons for the isolated beach experiment."""
import json
import statistics as st
from pathlib import Path
import numpy as np
from PIL import Image, ImageDraw

root = Path(__file__).parent / 'results'
read = lambda name: json.loads((root / name).read_text())
qa, build, timing = read('beach-browser.json'), read('beach-build.json'), read('beach-timing.json')
assert len(qa['tests']) == 6 and len(timing['tests']) == 24
stats = lambda a: dict(median=st.median(a), minimum=min(a), maximum=max(a))
summary = dict(build=build, validation=[], timing=[], limitations=[
    'One machine/browser; warm-page runs, not controlled cold shader compilation.',
    'Array payloads and resource descriptors, not total process or peak memory.',
    'Physics tests omit rendering between steps; image sequences are separate.',
    'Shader morph preserves topology and placement buffers; deformed vertex positions differ.',
    'Volume lighting is remapped from the original baked volume, not rebaked transport.'
])
for q in range(3):
    a = next(t for t in qa['tests'] if t['name'] == 'beach-before' and t['level'] == q)
    b = next(t for t in qa['tests'] if t['name'] == 'beach' and t['level'] == q)
    assert a['sameWorldAndAllocations'] and b['sameWorldAndAllocations']
    assert a['allocations'] == b['allocations'] and a['movement'] == b['movement']
    assert not a['errors'] and not b['errors']
    pairs=[]
    for v,w in zip(a['views'], b['views']):
        assert v['label']==w['label']
        if v['label'].startswith('reachable-coast'): continue
        assert all(v[k]==w[k] for k in ['camera','time','width','height','detail'])
        x=np.asarray(Image.open(root/v['file'])).astype(np.int16)
        y=np.asarray(Image.open(root/w['file'])).astype(np.int16)
        d=np.abs(x-y)
        pairs.append(dict(label=v['label'], changedPixels=int(np.any(d,axis=2).sum()),meanAbsoluteDifference=float(d.mean()),maximum=int(d.max())))
    assert len(pairs)==45
    frames=[next(v for v in b['views'] if v['label']==label) for label in ['beach-near']+[f'wave{i}' for i in range(1,16)]]
    changes=[]
    previous=None
    sheet=Image.new('RGB',(320*4,180*4))
    for i,v in enumerate(frames):
        img=Image.open(root/v['file']).convert('RGB')
        px=np.asarray(img).astype(np.int16)
        if previous is not None: changes.append(float(np.abs(px-previous).mean()))
        previous=px
        tile=img.resize((320,180));ImageDraw.Draw(tile).text((6,6),f"t={v['time']:.3f}s",fill='black',stroke_width=1,stroke_fill='white')
        sheet.paste(tile,((i%4)*320,(i//4)*180))
    sheet.save(root/f'beach-q{q}-temporal.png')
    summary['validation'].append(dict(level=q, images=pairs, extraEndPositionImages=3,
        unchangedHashes=len(b['hashes'])-len(b['changedData']),changedData=b['changedData'],
        collisionBytesBefore=a['hashes']['CI']['bytes']+a['hashes']['CG']['bytes'],
        collisionBytesAfter=b['hashes']['CI']['bytes']+b['hashes']['CG']['bytes'],
        paths=len(b['shore']),minimumClearance=min(s['clearance'] for s in b['shore']),
        maximumRadius=max(s['maxRadius'] for s in b['shore']),
        westBefore=next(s['end']['camera'][:3] for s in a['shore'] if s['angle']==12 and s['y']==.28),
        westAfter=next(s['end']['camera'][:3] for s in b['shore'] if s['angle']==12 and s['y']==.28),
        temporalAdjacentMeanDifferences=changes))
    for name in ['beach-before','beach']:
        runs=[t for t in timing['tests'] if t['name']==name and t['level']==q][1:]
        assert len(runs)==3 and all(len(r['benchmarks'])==4 for r in runs)
        summary['timing'].append(dict(name=name,level=q,readyMs=stats([r['readyMs'] for r in runs]),collisionMs=stats([r['collisionMs'] for r in runs]),
            views=[dict(pose=runs[0]['benchmarks'][i]['pose'],gpuMs=stats([st.median(r['benchmarks'][i]['gpu']) for r in runs]),cpuMs=stats([st.median(r['benchmarks'][i]['cpu']) for r in runs])) for i in range(4)]))
(root/'beach-summary.json').write_text(json.dumps(summary,indent=2)+'\n')
for q in range(3):
    print(q,[(r['name'],r['readyMs']['median'],r['collisionMs']['median'],[v['gpuMs']['median'] for v in r['views']]) for r in summary['timing'] if r['level']==q])

gallery='''<!doctype html><meta charset="utf-8"><title>Abyssal Garden · Sandbucht</title>
<style>body{font:16px system-ui;background:#172029;color:#eef2f4;max-width:1280px;margin:24px auto;padding:0 16px}select,input{margin:8px}figure{margin:16px 0;position:relative;aspect-ratio:16/9}img{position:absolute;width:100%;height:100%;object-fit:contain}label{display:inline-block}#after{clip-path:inset(0 0 0 50%)}p{line-height:1.5}</style>
<h1>Eine Sandbucht · gleicher Blick, gleiche Zeit</h1><p>Links vorher, rechts Strandversuch. 1280 × 720, t=8 s. Der Regler verschiebt die Vergleichskante.</p>
<label>Qualität <select id="q"><option value="0">High</option><option value="1">Medium</option><option value="2">Low</option></select></label>
<label>Ansicht <select id="v"><option value="beach-side">Seitlicher Blick</option><option value="beach-wide">Gesamtansicht</option><option value="beach-near">Nahansicht</option><option value="beach-under">Unter Wasser</option><option value="pose1">Tiefe Startansicht</option><option value="west">Westliche Küste</option></select></label>
<label>Vergleich <input id="split" type="range" min="0" max="100" value="50"></label>
<figure><img id="before" alt="Vorher"><img id="after" alt="Strandversuch"></figure>
<script>const q=document.getElementById('q'),v=document.getElementById('v'),a=document.getElementById('after'),b=document.getElementById('before'),s=document.getElementById('split');function draw(){b.src=`beach-before-q${q.value}-${v.value}.png`;a.src=`beach-q${q.value}-${v.value}.png`}q.onchange=v.onchange=draw;s.oninput=()=>a.style.clipPath=`inset(0 0 0 ${s.value}%)`;draw()</script>'''
(root/'beach-compare.html').write_text(gallery)
