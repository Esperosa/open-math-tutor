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
import pendigits
from data import LABELS, TEMPLATES, augment, augment_pen, raster

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
        self.c1 = nn.Conv2d(1, 16, 5)
        self.c2 = nn.Conv2d(16, 32, 3)
        self.d1 = nn.Linear(800, 192)
        self.d2 = nn.Linear(192, len(LABELS))

    def forward(self, x):
        x = F.max_pool2d(F.relu(self.c1(x)), 2)
        x = F.max_pool2d(F.relu(self.c2(x)), 2)
        x = F.relu(self.d1(x.flatten(1)))
        return self.d2(x)


def fixed_raster(strokes):
    """Deterministic raster of a real pen trajectory for validation and scoring."""
    flat = np.concatenate(strokes)
    span = max(np.ptp(flat[:, 0]), np.ptp(flat[:, 1]), 1.0)
    return raster(strokes, span * .11)


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
    p.add_argument('--epochs', type=int, default=32)
    p.add_argument('--synthetic-per-class', type=int, default=1400)
    p.add_argument('--pendigits-variants', type=int, default=6)
    p.add_argument('--threads', type=int, default=12)
    p.add_argument('--seed', type=int, default=20261106)
    p.add_argument('--init', help='optional earlier weights.json; matching tensors are copied, new labels start random')
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
    # Real pen trajectories. The official training file contains 30 writers; the
    # last two (500 digits) are a fixed, writer-separated validation block.
    psamples = pendigits.load('pendigits.tra')
    pval, ptrain = psamples[-500:], psamples[:-500]
    pvx = np.array([fixed_raster(strokes) for strokes, _ in pval], dtype=np.float32)
    pvy = np.array([LABELS.index(str(label)) for _, label in pval])
    # Validation is a fixed, separate slice of the original TRAIN split plus real
    # pen digits; selecting on MNIST alone would ignore the harder domain.
    vx = torch.tensor(np.concatenate([x[55000:, None], pvx[:, None]]), dtype=torch.float32)
    vy = torch.tensor(np.concatenate([y[55000:], pvy]).astype('int64'))
    pd_cache = CACHE / f'pendigits-{args.seed}-{args.pendigits_variants}-{len(ptrain)}-v1.npz'
    if pd_cache.exists():
        saved = np.load(pd_cache)
        px, py = saved['x'], saved['y']
    else:
        px, py = [], []
        prng = np.random.default_rng(args.seed + 7)
        for strokes, label in ptrain:
            for _ in range(args.pendigits_variants):
                augmented, width = augment_pen(strokes, prng)
                px.append(raster(augmented, width))
                py.append(LABELS.index(str(label)))
        px, py = np.array(px), np.array(py)
        np.savez_compressed(pd_cache, x=px, y=py)
    print('pendigits train', len(px), 'validation', len(pval), flush=True)
    template_hash = hashlib.sha256((ROOT / 'templates.json').read_bytes() + b'handwriting-v4').hexdigest()[:12]
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
    x = torch.tensor(np.concatenate([x[:55000], sx, px])[:, None], dtype=torch.float32)
    y = torch.tensor(np.concatenate([y[:55000], sy, py]).astype('int64'))
    net = Net()
    if args.init:
        old = json.loads(Path(args.init).read_text(encoding='utf-8'))
        tensors = {name: torch.tensor(np.frombuffer(base64.b64decode(t['data']), dtype='<f4').copy().reshape(t['shape']))
                   for name, t in old['tensors'].items()}
        state = net.state_dict()
        for name, tensor in tensors.items():
            if name in ('d2.weight', 'd2.bias'):
                rows = [LABELS.index(label) for label in old['labels'] if label in LABELS]
                state[name].data[rows] = tensor[[old['labels'].index(label) for label in old['labels'] if label in LABELS]]
            elif name in state and state[name].shape == tensor.shape:
                state[name].data.copy_(tensor)
        net.load_state_dict(state)
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
            mnist_correct = (predicted[:5000] == vy[:5000]).sum().item()
            pendigits_correct = (predicted[5000:] == vy[5000:]).sum().item()
            validation = mnist_correct / 5000 * .5 + pendigits_correct / len(pval) * .5
        print(f'epoch {epoch + 1} train {correct}/{total} mnist {mnist_correct}/5000 pendigits '
              f'{pendigits_correct}/{len(pval)} score {validation:.4f} elapsed {time.perf_counter() - start:.1f}s', flush=True)
        if validation >= best:
            best = validation
            export(net, {'seed': args.seed, 'epoch': epoch + 1, 'epochsRequested': args.epochs,
                         'syntheticPerClass': args.synthetic_per_class, 'pendigitsVariants': args.pendigits_variants,
                         'mnistTrain': 55000, 'pendigitsTrain': len(px), 'validationScore': best,
                         'mnistValidationCorrect': mnist_correct, 'pendigitsValidationCorrect': pendigits_correct,
                         'pendigitsValidationTotal': len(pval), 'torch': torch.__version__})
        for group in opt.param_groups:
            group['lr'] *= .92
    print('weights bytes', (MODEL / 'weights.json').stat().st_size, flush=True)


if __name__ == '__main__':
    main()
