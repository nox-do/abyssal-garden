"""Measured costs and an offline gallery of original captures. Pillow + NumPy."""
import json
from pathlib import Path
from statistics import median
import numpy as np
from PIL import Image, ImageDraw, ImageFont

out=Path(__file__).resolve().parent/'results'
read=lambda name:json.loads((out/name).read_text())
qa,timing,build=read('browser.json'),read('timing.json'),read('build.json')
font=ImageFont.truetype('/System/Library/Fonts/Supplemental/Arial.ttf',16)
def stats(values):
    return dict(n=len(values),median=median(values),minimum=min(values),maximum=max(values))
summary=dict(build=build,browser=qa['browser'],adapter=qa['adapter'],validation=[],timing=[],underwaterDifferences=[],limits=[
    'One Mac/Chrome, 1280x720 internal resolution and detail 1, also on Low.',
    'One warm-up page omitted, three measured fresh pages per variant/quality.',
    'Serialized GPU timestamps and render command encoding, not free-running FPS.',
    'Equal resource descriptors do not measure process/compiler/driver peak memory.',
    'Old-version surface views are diagnostic cameras outside its former movement range.',
    'Above-water transmission is not refracted; reflections contain sky/sun, not coast geometry.',
    'Optical waves only; mean surface is flat. Sun and coast shadows are static.'
])
for q in range(3):
    a=next(t for t in qa['tests'] if t['name']=='baseline' and t['level']==q)
    b=next(t for t in qa['tests'] if t['name']=='surface' and t['level']==q)
    world=lambda h: {k:v for k,v in h.items() if k not in ('CI','CG')}
    assert world(a['hashes'])==world(b['hashes']) and a['allocations']==b['allocations'] and a['movement']==b['movement']
    assert all(t['sameWorldAndAllocations'] and not t['errors'] for t in [a,b])
    assert len(b['swims'])==6
    assert a['views'] and len(a['views'])==len(b['views'])
    for v,w in zip(a['views'],b['views']):
        assert all(v[k]==w[k] for k in ['label','camera','time','width','height','detail'])
    summary['validation'].append(dict(level=q,hashes=len(a['hashes']),buffers=len(a['allocations']['buffers']),textures=len(a['allocations']['textures']),
        viewsPerVariant=len(a['views']),audio=b['audio'],swims=[dict(label=s['label'],end=s['end']['camera'][:3],collision=s['collision']) for s in b['swims']]))
    for name in ['baseline','surface']:
        runs=[t for t in timing['tests'] if t['name']==name and t['level']==q][1:]
        assert len(runs)==3
        record=dict(name=name,level=q,readyMs=stats([t['readyMs'] for t in runs]),worldMs=stats([t['worldMs'] for t in runs]),poses=[])
        for i,label in enumerate(['underwater1','underwater6','surface']):
            benches=[t['benchmarks'][i] for t in runs]
            assert all(len(b['gpu'])==len(b['cpu'])==120 for b in benches)
            record['poses'].append(dict(view=label,gpuMs=stats([median(b['gpu']) for b in benches]),cpuMs=stats([median(b['cpu']) for b in benches])))
        summary['timing'].append(record)
    for i in range(1,7):
        x=np.asarray(Image.open(out/f'baseline-q{q}-pose{i}.png').convert('RGB'),dtype=np.int16)
        y=np.asarray(Image.open(out/f'surface-q{q}-pose{i}.png').convert('RGB'),dtype=np.int16)
        summary['underwaterDifferences'].append(dict(level=q,view=i,meanAbsoluteChannelDifference=float(np.abs(x-y).mean()),changedPixelFraction=float(np.any(x!=y,axis=2).mean())))
    panel=Image.new('RGB',(1280,440),'#10232e');d=ImageDraw.Draw(panel)
    tags=['cross-0.1','cross-0.03','cross-0.005','cross0','cross0.005','cross0.03','cross0.1','cross0.28']
    for k,tag in enumerate(tags):
        x,y=k%4*320,k//4*220
        panel.paste(Image.open(out/f'surface-q{q}-{tag}.png').resize((320,180)),(x,y+40))
        d.text((x+12,y+12),tag+' m / t=8 s',font=font,fill='white')
    panel.save(out/f'crossing-q{q}.png')
    panel=Image.new('RGB',(1280,400),'#10232e');d=ImageDraw.Draw(panel)
    for k,tag in enumerate(['coast']+[f'wave{i}' for i in range(1,16)]):
        x,y=k%8*160,k//8*200
        panel.paste(Image.open(out/f'surface-q{q}-{tag}.png').crop((480,280,800,640)).resize((160,180)),(x,y+20))
        d.text((x+4,y+2),f't={8+k/30:.3f}',fill='white')
    panel.save(out/f'waves-q{q}.png')
(out/'summary.json').write_text(json.dumps(summary,indent=2)+'\n')
views=[v['label'] for v in qa['tests'][0]['views']]
html='''<!doctype html><html lang="de"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Abyssal Garden · Auftauchen</title><style>body{margin:24px;background:#10232e;color:#e2edf2;font:16px system-ui}main{max-width:1280px;margin:auto}h1{font-size:24px}select,button{font:inherit;background:#233946;color:inherit;border:1px solid #64818e;border-radius:6px;padding:8px;margin:4px}#stage{position:relative;aspect-ratio:16/9;margin-top:16px}img{position:absolute;width:100%;height:100%}#after{clip-path:inset(0 0 0 0%)}input{width:100%}p{line-height:1.5}small{color:#a5bec9}a{color:#8fdbef}</style>
<main><h1>Abyssal Garden · Auftauchen</h1><p>Himmel, Sonne und Wasser von oben. Die Augen bleiben höchstens 28 cm über Wasser; die vorhandene Küste ist 1,5–3 m hoch.</p>
<select id="quality"><option value="0">High</option><option value="1">Medium</option><option value="2">Low</option></select><select id="view"></select>
<button id="prev">Zurück</button><button id="next">Weiter</button><button id="play">Wellen abspielen</button><button id="stop">Stop</button>
<div id="stage"><img id="before" alt="Vorher"><img id="after" alt="Auftauchversuch"></div>
<label>Vergleich: links vorher, rechts Versuch <input id="split" type="range" min="0" max="100" value="0"></label><p id="links"></p>
<small>Identische Kamera, Zeit und 1280 × 720 Renderpixel. Original-PNGs ohne Retusche.<br>pose/detail: bisherige Unterwasserwelt. Übrige Ansichten: neue Oberfläche; die alte Version wird dort nur mit einer Testkamera außerhalb ihres bisherigen Bewegungsbereichs dargestellt.<br>cross: Höhenfolge bei t=8 s. Wellen: 16 Bilder von 8–8,5 s bei 30 Hz, dann Wiederholung. Wasser ist noch ohne optische Verzerrung der Unterwasserobjekte und ohne Spiegelung der Küste.</small></main>
<script>
const views=VIEWS,q=document.getElementById('quality'),v=document.getElementById('view');let timer;
for(const name of views)v.add(new Option(name,name));v.value='west';
function update(){const a=`baseline-q${q.value}-${v.value}.png`,b=`surface-q${q.value}-${v.value}.png`;document.getElementById('before').src=a;document.getElementById('after').src=b;document.getElementById('links').innerHTML=`<a href="${a}">Vorher</a> · <a href="${b}">Versuch in Originalgröße</a>`;}
function stop(){clearInterval(timer)}q.onchange=v.onchange=()=>{stop();update()};document.getElementById('split').oninput=e=>document.getElementById('after').style.clipPath=`inset(0 0 0 ${e.target.value}%)`;
document.getElementById('prev').onclick=()=>{stop();v.selectedIndex=(v.selectedIndex+views.length-1)%views.length;update()};document.getElementById('next').onclick=()=>{stop();v.selectedIndex=(v.selectedIndex+1)%views.length;update()};document.getElementById('stop').onclick=stop;
document.getElementById('play').onclick=async()=>{stop();const tags=['coast',...Array.from({length:15},(_,i)=>'wave'+(i+1))];await Promise.all(tags.flatMap(tag=>['baseline','surface'].map(n=>new Promise(resolve=>{const im=new Image;im.onload=im.onerror=resolve;im.src=`${n}-q${q.value}-${tag}.png`}))));let k=0;timer=setInterval(()=>{v.value=tags[k++%16];update()},1000/30)};update();
</script></html>'''.replace('VIEWS',json.dumps(views))
(out/'compare.html').write_text(html)
for t in summary['timing']:
    print(t['level'],t['name'],'start',round(t['readyMs']['median'],1),'GPU',[round(p['gpuMs']['median'],3) for p in t['poses']])
