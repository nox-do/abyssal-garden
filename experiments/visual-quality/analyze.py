"""Summarize measured costs; create unretouched comparisons from captured PNGs.

Dependencies: Pillow, NumPy. No new scene rendering or image generation.
"""
import json
from pathlib import Path
from statistics import median

import numpy as np
from PIL import Image, ImageDraw

root = Path(__file__).resolve().parent
out = root / 'results'
build = json.loads((out / 'build.json').read_text())
qa = json.loads((out / 'browser.json').read_text())
timing = json.loads((out / 'timing.json').read_text())


def stats(values):
    a = np.array(values, dtype=float)
    assert len(a) and np.isfinite(a).all()
    return dict(n=len(a), median=float(np.median(a)), minimum=float(a.min()),
                maximum=float(a.max()), p95=float(np.percentile(a, 95)))


summary = dict(build=build['variants'], browser=qa['browser'], adapter=qa['adapter'],
               validation=[], timing=[], imageDifferences=[],
               limits=[
                   'Image differences are not quality scores; adoption is an aesthetic judgement.',
                   'Fixed 1280x720 internal resolution and detail 1, including Low.',
                   'Equal resource descriptors do not measure driver/process peak memory.',
                   'GPU is serialized between frames; not a free-running FPS benchmark.',
                   'One warm-up per variant/quality omitted, five fresh pages measured.',
                   'One Mac/Chrome only; no general browser or device guarantee.'
               ])
for q in range(3):
    base = next(t for t in qa['tests'] if t['name'] == 'baseline' and t['level'] == q)
    test = next(t for t in qa['tests'] if t['name'] == 'organic' and t['level'] == q)
    assert base['hashes'] == test['hashes']
    assert base['allocations'] == test['allocations']
    assert base['movement'] == test['movement']
    assert all(t['sameWorldAndAllocations'] and not t['errors'] for t in [base, test])
    summary['validation'].append(dict(level=q, typedArrayHashes=len(base['hashes']),
        bufferDescriptors=len(base['allocations']['buffers']),
        textureDescriptors=len(base['allocations']['textures']),
        generatedDataEqual=True, allocationsEqual=True, movementEqual=True,
        viewsPerVariant=len(base['views']), audio=test['audio']))
    for name in ['baseline', 'organic']:
        runs = [t for t in timing['tests'] if t['name'] == name and t['level'] == q][1:]
        assert len(runs) == 5
        record = dict(name=name, level=q, readyMs=stats([t['readyMs'] for t in runs]),
                      worldMs=stats([t['worldMs'] for t in runs]), poses=[])
        for pose in [0, 3, 5]:
            benches = [next(b for b in t['benchmarks'] if b['pose'] == pose) for t in runs]
            assert all(len(b['gpu']) == 120 and len(b['cpu']) == 120 for b in benches)
            record['poses'].append(dict(pose=pose+1,
                gpuRunMediansMs=stats([median(b['gpu']) for b in benches]),
                cpuRunMediansMs=stats([median(b['cpu']) for b in benches]),
                gpuRunP95Ms=stats([float(np.percentile(b['gpu'], 95)) for b in benches])))
        summary['timing'].append(record)
    for v, w in zip(base['views'], test['views']):
        assert [v[k] for k in ['label','camera','time','width','height','detail']] == [w[k] for k in ['label','camera','time','width','height','detail']]
        if not (v['label'].startswith('pose') or v['label'].startswith('detail')):
            continue
        a = np.asarray(Image.open(out/v['file']).convert('RGB'), dtype=np.int16)
        b = np.asarray(Image.open(out/w['file']).convert('RGB'), dtype=np.int16)
        d = np.abs(a-b)
        summary['imageDifferences'].append(dict(level=q, view=v['label'],
            meanAbsoluteChannelDifference=float(d.mean()), changedPixelFraction=float(np.any(d, axis=2).mean())))
    # Exact 1:1 crops, only labels added outside the captured scene.
    panel = Image.new('RGB', (1280, 340), '#11222b')
    draw = ImageDraw.Draw(panel)
    for i, name in enumerate(['baseline', 'organic']):
        panel.paste(Image.open(out/f'{name}-q{q}-pose4.png').crop((640,420,1280,720)), (i*640,40))
        draw.text((i*640+16,12), ('Vorher' if i == 0 else 'Nachher') + ' / ' + ['High','Medium','Low'][q] + ' / t=8s / 1:1', fill='white')
    panel.save(out/f'comparison-q{q}.png')
    temporal = Image.new('RGB', (1200,600), '#11222b')
    draw = ImageDraw.Draw(temporal)
    for row, name in enumerate(['baseline','organic']):
        for col, tag in enumerate(['pose4','sponge-time8.033','sponge-time8.067','sponge-time8.100']):
            temporal.paste(Image.open(out/f'{name}-q{q}-{tag}.png').crop((700,450,1000,700)), (col*300,row*300+40))
            draw.text((col*300+6,row*300+10), name+' '+tag, fill='white')
    temporal.save(out/f'temporal-q{q}.png')

(out/'summary.json').write_text(json.dumps(summary, indent=2)+'\n')

# Offline gallery. Images remain original, unmodified PNGs; no external assets.
views = [v['label'] for v in qa['tests'][0]['views']]
gallery = '''<!doctype html><html lang="de"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Abyssal Garden · Materialvergleich</title>
<style>body{margin:24px;background:#101f29;color:#e2edf2;font:16px system-ui}main{max-width:1280px;margin:auto}h1{font-size:24px}select,button{font:inherit;background:#233946;color:inherit;border:1px solid #64818e;border-radius:6px;padding:8px;margin:4px}label{margin-right:16px}#stage{position:relative;aspect-ratio:16/9;margin-top:16px}img{position:absolute;width:100%;height:100%}#after{clip-path:inset(0 0 0 50%)}input{width:100%}p{line-height:1.5}small{color:#a5bec9}</style>
<main><h1>Abyssal Garden · ruhigeres Schwamm- und Korallenmaterial</h1>
<p>Links vorher, rechts Materialversuch. Gleiche Kamera, Zeit und 1280 × 720 Renderpixel. Original-PNGs ohne Retusche.</p>
<label>Qualität <select id="quality"><option value="0">High</option><option value="1">Medium</option><option value="2">Low</option></select></label>
<label>Ansicht <select id="view"></select></label><button id="prev">Zurück</button><button id="next">Weiter</button>
<div id="stage"><img id="before" alt="Vorher"><img id="after" alt="Materialversuch"></div>
<label>Vergleichsgrenze <input id="split" type="range" min="0" max="100" value="50"></label>
<p id="links"></p><small>pose = Gesamtansicht bei t=8 s · detail = 3 m angenähert · sponge-time = Ansicht 4 · time = Ansicht 6 · travel = Kameraschritte von 0,25 m bei t=8 s.<br>Low behält seine eigenen Qualitätsparameter, wurde hier aber ebenfalls bei 1280 × 720 gerendert. Kein FPS- oder Qualitätswert wird aus Bilddifferenzen abgeleitet.</small></main>
<script>
const views=VIEW_DATA, q=document.getElementById('quality'),v=document.getElementById('view');
for(const name of views)v.add(new Option(name,name));v.value='pose4';
function update(){const a=`baseline-q${q.value}-${v.value}.png`,b=`organic-q${q.value}-${v.value}.png`;document.getElementById('before').src=a;document.getElementById('after').src=b;document.getElementById('links').innerHTML=`<a style="color:#8fdbef" href="${a}">Vorher in Originalgröße</a> · <a style="color:#8fdbef" href="${b}">Nachher in Originalgröße</a>`;}
q.onchange=v.onchange=update;document.getElementById('split').oninput=e=>document.getElementById('after').style.clipPath=`inset(0 0 0 ${e.target.value}%)`;
document.getElementById('prev').onclick=()=>{v.selectedIndex=(v.selectedIndex+views.length-1)%views.length;update()};document.getElementById('next').onclick=()=>{v.selectedIndex=(v.selectedIndex+1)%views.length;update()};update();
</script></html>'''.replace('VIEW_DATA', json.dumps(views))
(out/'compare.html').write_text(gallery)
for record in summary['timing']:
    print(record['level'], record['name'], 'start', round(record['readyMs']['median'],1),
          'GPU', [round(p['gpuRunMediansMs']['median'],3) for p in record['poses']],
          'CPU', [round(p['cpuRunMediansMs']['median'],3) for p in record['poses']])
