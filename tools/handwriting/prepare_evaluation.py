"""Fetch the official held-out test split, never used by train.py; export parity fixtures."""
import base64
import json
import shutil
import numpy as np
import torch
import pendigits
from data import TEMPLATES, LABELS, augment, raster
from train import ROOT, CACHE, MODEL, Net, mnist_file


def main():
    out = ROOT.parent.parent / 'packages/frontend/src/handwriting/__fixtures__'
    out.mkdir(exist_ok=True)
    for name in ['t10k-images-idx3-ubyte.gz', 't10k-labels-idx1-ubyte.gz']:
        mnist_file(name)
        shutil.copyfile(CACHE / name, out / name)
    weights = json.loads((MODEL / 'weights.json').read_text(encoding='utf-8'))
    net = Net()
    net.load_state_dict({name: torch.tensor(np.frombuffer(base64.b64decode(t['data']), dtype='<f4').copy().reshape(t['shape']))
                         for name, t in weights['tensors'].items()})
    net.eval()
    rng = np.random.default_rng(188523)
    fixtures = []
    for template in [TEMPLATES[i] for i in [0, 4, 10, 19, 30]]:
        strokes, width = augment(template['strokes'], rng)
        image = raster(strokes, width)
        with torch.no_grad():
            probabilities = net(torch.tensor(image[None, None])).softmax(1)[0].numpy()
        order = np.argsort(-probabilities)[:3]
        fixtures.append({'strokes': strokes, 'width': width, 'raster': image.flatten().tolist(),
                         'candidates': [{'label': LABELS[i], 'probability': float(probabilities[i])} for i in order]})
    (out / 'parity.json').write_text(json.dumps(fixtures, separators=(',', ':')), encoding='utf-8')
    # Official pendigits test split: 14 writers never seen by train.py. Stored as
    # raw pen trajectories so the TypeScript test exercises rasterization + inference,
    # not a pre-baked bitmap.
    samples = []
    for strokes, label in pendigits.load('pendigits.tes'):
        flat = np.concatenate(strokes)
        span = max(np.ptp(flat[:, 0]), np.ptp(flat[:, 1]), 1.0)
        samples.append({'strokes': [[[int(x), int(y)] for x, y in stroke] for stroke in strokes],
                        'width': float(span * .11), 'label': str(label)})
    (out / 'pendigits.json').write_text(json.dumps({'source': 'UCI pendigits test split (14 unseen writers)',
                                                    'samples': samples}, separators=(',', ':')), encoding='utf-8')


if __name__ == '__main__':
    main()
