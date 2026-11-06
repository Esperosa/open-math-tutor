"""CPU-only deterministic training. No test data is opened by this script."""
import argparse
import base64
import gzip
import hashlib
import json
import random
import sys
import time
import urllib.request
from pathlib import Path

import numpy as np
import torch
from torch import nn
from torch.nn import functional as F
from data import LABELS, TEMPLATES, augment, raster

ROOT = Path(__file__).resolve().parent
MODEL = ROOT.parent.parent / 'packages/frontend/src/handwriting/model'
CACHE = ROOT / '.cache'
MNIST = {
    'train-images-idx3-ubyte.gz': 'f68b3c2dcbeaaa9fbdd348bbdeb94873',
    'train-labels-idx1-ubyte.gz': 'd53e105ee54ea40749a09fcbcd1e9432',
    't10k-images-idx3-ubyte.gz': '9fb629c4189551a2d022fa330f9573f3',
    't10k-labels-idx1-ubyte.gz': 'ec29112dd5afa0611ce80d1b7f02629c',
}


def mnist_file(name):
    CACHE.mkdir(exist_ok=True)
    path = CACHE / name
    if not path.exists():
        data = urllib.request.urlopen('https://storage.googleapis.com/cvdf-datasets/mnist/' + name, timeout=120).read()
        if hashlib.md5(data).hexdigest() != MNIST[name]:
            raise ValueError('MNIST checksum mismatch: ' + name)
        path.write_bytes(data)
    if hashlib.md5(path.read_bytes()).hexdigest() != MNIST[name]:
        raise ValueError('Corrupt cached MNIST: ' + name)
    return gzip.decompress(path.read_bytes())


class Net(nn.Module):
    def __init__(self):
        super().__init__()
        self.c1 = nn.Conv2d(1, 8, 5)
        self.c2 = nn.Conv2d(8, 16, 3)
        self.d1 = nn.Linear(400, 64)
        self.d2 = nn.Linear(64, len(LABELS))

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.c1(x)), 2)
        x = F.max_pool2d(F.relu(self.c2(x)), 2)
        x = F.relu(self.d1(x.flatten(1)))
        return self.d2(x)


def export(net, metadata):
    tensors = {}
    for name, t in net.state_dict().items():
        # Float32 LE embedded in JSON: synchronously importable in Node and browser,
        # no fetch, platform-specific path handling, or runtime dependency.
        array = t.detach().numpy().astype('<f4')
        tensors[name] = {'shape': list(array.shape), 'data': base64.b64encode(array.tobytes()).decode('ascii')}
    payload = {'version': 1, 'labels': LABELS, 'tensors': tensors, 'training': metadata}
    MODEL.mkdir(exist_ok=True, parents=True)
    (MODEL / 'weights.json').write_text(json.dumps(payload, separators=(',', ':')), encoding='utf-8')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser()
    p.add_argument('--epochs', type=int, default=24)
    p.add_argument('--synthetic-per-class', type=int, default=1400)
    p.add_argument('--threads', type=int, default=4)
    p.add_argument('--seed', type=int, default=20261106)
    args = p.parse_args()
    start = time.perf_counter()
    torch.set_num_threads(args.threads)
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(args.seed)
    np.random.seed(args.seed)
    random.seed(args.seed)
    rng = np.random.default_rng(args.seed)
    x = np.frombuffer(mnist_file('train-images-idx3-ubyte.gz'), np.uint8, offset=16).reshape(-1, 28, 28).copy() / 255.
    y = np.frombuffer(mnist_file('train-labels-idx1-ubyte.gz'), np.uint8, offset=8).copy()
    # Validation is a fixed, separate slice of the original TRAIN split.
    vx, vy = torch.tensor(x[55000:, None], dtype=torch.float32), torch.tensor(y[55000:].astype('int64'))
    template_hash = hashlib.sha256((ROOT / 'templates.json').read_bytes() + b'punctuation-width-v2').hexdigest()[:12]
    cache = CACHE / f'synthetic-{template_hash}-{args.seed}-{args.synthetic_per_class}.npz'
    if cache.exists():
        saved = np.load(cache)
        sx, sy = saved['x'], saved['y']
    else:
        sx, sy = [], []
        for label in LABELS:
            templates = [t for t in TEMPLATES if t['label'] == label]
            for _ in range(args.synthetic_per_class):
                template = templates[rng.integers(len(templates))]
                strokes, width = augment(template['strokes'], rng)
                if label == ',':
                    width *= rng.uniform(1, 4.5)  # tiny real commas use the same pen as full-height digits
                sx.append(raster(strokes, width))
                sy.append(LABELS.index(label))
            print('generated', label, flush=True)
        sx, sy = np.array(sx), np.array(sy)
        np.savez_compressed(cache, x=sx, y=sy)
    x = torch.tensor(np.concatenate([x[:55000], sx])[:, None], dtype=torch.float32)
    y = torch.tensor(np.concatenate([y[:55000], sy]).astype('int64'))
    net = Net()
    opt = torch.optim.AdamW(net.parameters(), lr=.0018, weight_decay=.0001)
    best = 0
    for epoch in range(args.epochs):
        net.train()
        order = torch.randperm(len(x))
        total = correct = 0
        for indices in order.split(256):
            batch, labels = x[indices], y[indices]
            # Modest online affine augmentation on top of the strong stroke augmentation.
            affine = torch.eye(2, 3)[None].repeat(len(batch), 1, 1)
            affine[:, :2, :2] += torch.randn(len(batch), 2, 2) * .055
            affine[:, :, 2] = torch.randn(len(batch), 2) * .035
            batch = F.grid_sample(batch, F.affine_grid(affine, batch.size(), align_corners=False), align_corners=False)
            logits = net(batch)
            loss = F.cross_entropy(logits, labels)
            opt.zero_grad()
            loss.backward()
            opt.step()
            total += len(batch)
            correct += (logits.argmax(1) == labels).sum().item()
        net.eval()
        with torch.no_grad():
            predicted = torch.cat([net(b).argmax(1) for b in vx.split(256)])
            validation = (predicted == vy).sum().item()
        print(f'epoch {epoch + 1} train {correct}/{total} validation {validation}/5000 elapsed {time.perf_counter() - start:.1f}s', flush=True)
        if validation >= best:
            best = validation
            export(net, {'seed': args.seed, 'epoch': epoch + 1, 'epochsRequested': args.epochs,
                         'syntheticPerClass': args.synthetic_per_class, 'mnistTrain': 55000,
                         'validationCorrect': best, 'validationTotal': 5000, 'torch': torch.__version__})
        for group in opt.param_groups:
            group['lr'] *= .92
    print('weights bytes', (MODEL / 'weights.json').stat().st_size, flush=True)


if __name__ == '__main__':
    main()
