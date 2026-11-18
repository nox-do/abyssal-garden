"""Validate the independent memory change, including decoded image pixels."""
import json
from pathlib import Path
import numpy as np
from PIL import Image

root = Path(__file__).parent / 'results'
report = json.loads((root / 'memory-browser.json').read_text())
summary = {'note': 'Array payloads/references and GPU descriptors; no RSS measurement.', 'tests': []}
for q in range(3):
    a = next(t for t in report['tests'] if t['name'] == 'memory-before' and t['level'] == q)
    b = next(t for t in report['tests'] if t['name'] == 'memory' and t['level'] == q)
    assert a['hashes'] == b['hashes'] and a['movement'] == b['movement']
    assert not a['errors'] and not b['errors']
    assert a['audio']['state'] == b['audio']['state'] == 'running'
    assert b['retainedCPU'] == 0
    expected = json.loads(json.dumps(a['allocations']))
    changed = [i for i, (x, y) in enumerate(zip(expected['buffers'], b['allocations']['buffers'])) if x != y]
    assert len(changed) == 1
    expected['buffers'][changed[0]]['size'] //= 2
    assert b['allocations'] == expected
    images = []
    assert len(a['views']) == len(b['views']) == 41
    for v, w in zip(a['views'], b['views']):
        assert all(v[k] == w[k] for k in ['label', 'camera', 'time', 'width', 'height', 'detail'])
        x = np.asarray(Image.open(root / v['file'])).astype(np.int16)
        y = np.asarray(Image.open(root / w['file'])).astype(np.int16)
        d = np.abs(x - y)
        count, peak = int(np.any(d, axis=2).sum()), int(d.max())
        # Allow at most one pixel differing by one 8-bit unit; report it explicitly.
        assert count <= 1 and peak <= 1, (q, v['label'], count, peak)
        images.append(dict(label=v['label'], changedPixels=count, maxChannelDifference=peak))
    summary['tests'].append(dict(level=q, freedCPUBytes=a['retainedCPU'],
        savedGPUBytes=expected['buffers'][changed[0]]['size'], matchedHashes=len(a['hashes']),
        identicalImages=sum(i['changedPixels'] == 0 for i in images), images=images))
(root / 'memory-summary.json').write_text(json.dumps(summary, indent=2) + '\n')
print(json.dumps([{k: v for k, v in t.items() if k != 'images'} for t in summary['tests']], indent=2))
