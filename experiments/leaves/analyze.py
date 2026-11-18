"""Summarize leaf measurements and assemble original captures. Pillow + NumPy."""
import json
from pathlib import Path
from statistics import median
import numpy as np
from PIL import Image, ImageDraw, ImageFont

out = Path(__file__).resolve().parent / 'results'
build = json.loads((out / 'build.json').read_text())
qa = json.loads((out / 'browser.json').read_text())
timing = json.loads((out / 'timing.json').read_text())
font = ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf', 18)

def stats(values):
    a = np.array(values, dtype=float)
    assert len(a) and np.isfinite(a).all()
    return dict(n=len(a), median=float(np.median(a)), minimum=float(a.min()),
                maximum=float(a.max()), p95=float(np.percentile(a, 95)))

summary = dict(build=build, browser=qa['browser'], adapter=qa['adapter'],
    validation=[], timing=[], temporal=[], limits=[
        'One Mac and Chrome version; no device/browser performance guarantee.',
        'Fixed internal 1280x720 and detail 1 on all three quality levels.',
        'One warm-up page omitted; three measured pages per variant/quality.',
        'GPU serialized between frames; not free-running FPS or input latency.',
        'Resource descriptors are not measured process/driver peak memory.',
        'Specimens are diagnostic wide leaves with proximity fading disabled.',
        'Image differences are not aesthetic quality or flicker scores.'
    ])

for q in range(3):
    base = next(t for t in qa['tests'] if t['name'] == 'baseline' and t['level'] == q)
    test = next(t for t in qa['tests'] if t['name'] == 'contour' and t['level'] == q)
    assert base['hashes'] == test['hashes']
    assert base['allocations'] == test['allocations']
    assert base['movement'] == test['movement']
    assert all(t['sameWorldAndAllocations'] and not t['errors'] for t in [base, test])
    for a, b in zip(base['views'], test['views']):
        assert [a[k] for k in ['label','camera','time','width','height','detail']] == [b[k] for k in ['label','camera','time','width','height','detail']]
    summary['validation'].append(dict(level=q, typedArrayHashes=len(base['hashes']),
        bufferDescriptors=len(base['allocations']['buffers']),
        textureDescriptors=len(base['allocations']['textures']),
        generatedDataEqual=True, allocationsEqual=True, movementEqual=True,
        viewsPerVariant=len(base['views']), audio=test['audio']))
    for name in ['baseline', 'contour']:
        runs = [t for t in timing['tests'] if t['name'] == name and t['level'] == q][1:]
        assert len(runs) == 3
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
        for mode, first, prefix, crop in [
            ('world','pose6','time',(880,180,1280,580)),
            ('specimen','specimen2','leaf-time',(280,240,600,600))]:
            tags = [first] + [prefix+f'{8+i/30:.3f}' for i in range(1,16)]
            frames = [np.asarray(Image.open(out/f'{name}-q{q}-{tag}.png').convert('RGB').crop(crop),dtype=np.int16) for tag in tags]
            delta = [float(np.abs(b-a).mean()) for a,b in zip(frames,frames[1:])]
            summary['temporal'].append(dict(name=name,level=q,mode=mode,
                frameMeanAbsoluteChannelDifferences=delta, stats=stats(delta)))
    # Unscaled crops, labels outside the captures.
    for view, crop, label in [('pose6',(880,180,1280,580),'Welt'),
                             ('specimen2',(300,240,940,590),'Diagnose / 5 Reihen')]:
        w,h=crop[2]-crop[0],crop[3]-crop[1]
        panel=Image.new('RGB',(w*2,h+40),'#132735');d=ImageDraw.Draw(panel)
        for i,name in enumerate(['baseline','contour']):
            panel.paste(Image.open(out/f'{name}-q{q}-{view}.png').crop(crop),(w*i,40))
            d.text((w*i+12,10),('Vorher' if i==0 else 'Kontur')+f' / {label} / '+['High','Medium','Low'][q]+' / 1:1',font=font,fill='white')
        panel.save(out/f'comparison-{view}-q{q}.png')
    # All 16 consecutive samples, downscaled equally for visual contact sheet.
    tags=['specimen2']+['leaf-time'+f'{8+i/30:.3f}' for i in range(1,16)]
    panel=Image.new('RGB',(1280,800),'#132735');d=ImageDraw.Draw(panel)
    for row,name in enumerate(['baseline','contour']):
        for k,tag in enumerate(tags):
            x,y=(k%8)*160,(row*2+k//8)*200
            im=Image.open(out/f'{name}-q{q}-{tag}.png').crop((280,240,600,600)).resize((160,180))
            panel.paste(im,(x,y+20));d.text((x+4,y+1),name+' '+f'{8+k/30:.3f}',fill='white')
    panel.save(out/f'temporal-q{q}.png')

(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
views=[v['label'] for v in qa['tests'][0]['views']]
gallery='''<!doctype html><html lang="de"><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1"><title>Abyssal Garden · Blattvergleich</title>
<style>body{margin:24px;background:#101f29;color:#e2edf2;font:16px system-ui}main{max-width:1280px;margin:auto}h1{font-size:24px}select,button{font:inherit;background:#233946;color:inherit;border:1px solid #64818e;border-radius:6px;padding:8px;margin:4px}label{margin-right:16px}#stage{position:relative;aspect-ratio:16/9;margin-top:16px}img{position:absolute;width:100%;height:100%}#after{clip-path:inset(0 0 0 50%)}input{width:100%}p{line-height:1.5}small{color:#a5bec9}a{color:#8fdbef}</style>
<main><h1>Abyssal Garden · mathematische Blattkonturen</h1>
<p>Links vorher, rechts Konturversuch. Identische Kamera, Animationszeit und 1280 × 720 Renderpixel. Originalbilder ohne Retusche.</p>
<label>Qualität <select id="quality"><option value="0">High</option><option value="1">Medium</option><option value="2">Low</option></select></label>
<label>Ansicht <select id="view"></select></label><button id="prev">Zurück</button><button id="next">Weiter</button>
<button id="world">Weltbewegung</button><button id="leaf">Blattbewegung</button><button id="stop">Stop</button>
<div id="stage"><img id="before" alt="Vorher"><img id="after" alt="Konturversuch"></div>
<label>Vergleichsgrenze <input id="split" type="range" min="0" max="100" value="50"></label>
<p id="links"></p><small>pose: Gesamtansicht bei t=8 s · detail: Kamera 3 m näher · time: Weltansicht 6 · travel: 0,25-m-Kameraschritte.<br>specimen/leaf-time: separate Diagnoseblätter, verbreitert und ohne kameranahe Ausblendung; 1/2/3 verwenden 9/5/3 Reihen. Keine normale Spielansicht.<br>Bewegung: 16 feste Zeitpunkte von 8,0–8,5 s in 1/30-s-Schritten, danach Wiederholung. Der Sprung am Schleifenende ist die Wiedergabe. Low ebenfalls bei 1280 × 720.</small></main>
<script>
const views=VIEW_DATA,q=document.getElementById('quality'),v=document.getElementById('view');let timer;
for(const name of views)v.add(new Option(name,name));v.value='pose6';
function update(){const a=`baseline-q${q.value}-${v.value}.png`,b=`contour-q${q.value}-${v.value}.png`;document.getElementById('before').src=a;document.getElementById('after').src=b;document.getElementById('links').innerHTML=`<a href="${a}">Vorher in Originalgröße</a> · <a href="${b}">Kontur in Originalgröße</a>`;}
function stop(){clearInterval(timer)}
q.onchange=v.onchange=()=>{stop();update()};document.getElementById('split').oninput=e=>document.getElementById('after').style.clipPath=`inset(0 0 0 ${e.target.value}%)`;
document.getElementById('prev').onclick=()=>{stop();v.selectedIndex=(v.selectedIndex+views.length-1)%views.length;update()};document.getElementById('next').onclick=()=>{stop();v.selectedIndex=(v.selectedIndex+1)%views.length;update()};
async function play(lab){stop();const tags=[lab?'specimen2':'pose6',...Array.from({length:15},(_,i)=>(lab?'leaf-time':'time')+(8+(i+1)/30).toFixed(3))];await Promise.all(tags.flatMap(tag=>['baseline','contour'].map(name=>new Promise(resolve=>{const im=new Image;im.onload=im.onerror=resolve;im.src=`${name}-q${q.value}-${tag}.png`}))));let k=0;timer=setInterval(()=>{v.value=tags[k++%tags.length];update()},1000/30)}
document.getElementById('world').onclick=()=>play(false);document.getElementById('leaf').onclick=()=>play(true);document.getElementById('stop').onclick=stop;update();
</script></html>'''.replace('VIEW_DATA',json.dumps(views))
(out/'compare.html').write_text(gallery)
for r in summary['timing']:
    print(r['level'],r['name'],'start',round(r['readyMs']['median'],1),
        'GPU',[round(p['gpuRunMediansMs']['median'],3) for p in r['poses']],
        'CPU',[round(p['cpuRunMediansMs']['median'],3) for p in r['poses']])
