"""CPU-only deterministic training. No test data is opened by this script."""
import argparse
import base64
import copy
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


def export(net, metadata, output):
    tensors = {}
    for name, t in net.state_dict().items():
        # Float32 LE embedded in JSON: synchronously importable in Node and browser,
        # no fetch, platform-specific path handling, or runtime dependency.
        array = t.detach().numpy().astype('<f4')
        tensors[name] = {'shape': list(array.shape), 'data': base64.b64encode(array.tobytes()).decode('ascii')}
    payload = {'version': 1, 'labels': LABELS, 'tensors': tensors, 'training': metadata}
    output.parent.mkdir(exist_ok=True, parents=True)
    output.write_text(json.dumps(payload, separators=(',', ':')), encoding='utf-8')


def main():
    sys.stdout.reconfigure(encoding='utf-8')
    p = argparse.ArgumentParser()
    p.add_argument('--epochs', type=int, default=32)
    p.add_argument('--synthetic-per-class', type=int, default=1400)
    p.add_argument('--pendigits-variants', type=int, default=6)
    p.add_argument('--threads', type=int, default=12)
    p.add_argument('--seed', type=int, default=20261106)
    p.add_argument('--init', help='optional earlier weights.json; matching tensors are copied, new labels start random')
    p.add_argument('--learning-rate', type=float, default=.0018)
    p.add_argument('--punctuation-multiplier', type=int, default=4)
    p.add_argument('--comma-weight', type=float, default=3.)
    p.add_argument('--retention-weight', type=float, default=0., help='warm-start distillation on selected-class replay')
    p.add_argument('--retention-labels', default='0ox×()l', help='classes anchored by warm-start distillation')
    p.add_argument('--real-data', action='store_true', help='Include Google MathWriting & HASYv2 real human writing')
    p.add_argument('--output', type=Path, default=MODEL / 'weights.json')
    args = p.parse_args()
    if (args.epochs < 1 or args.synthetic_per_class < 1 or args.pendigits_variants < 1
            or args.punctuation_multiplier < 1 or args.learning_rate <= 0 or args.comma_weight <= 0
            or args.retention_weight < 0):
        p.error('epochs, sample counts, learning rate and class weight must be positive')
    if args.retention_weight and not args.init:
        p.error('--retention-weight requires --init')
    if args.retention_weight and not args.retention_labels:
        p.error('--retention-weight requires nonempty --retention-labels')
    if any(label not in LABELS or label == ',' for label in args.retention_labels):
        p.error('retention labels must be known non-comma classes')
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
    template_hash = hashlib.sha256((ROOT / 'templates.json').read_bytes() + b'handwriting-v6').hexdigest()[:12]
    cache = CACHE / f'synthetic-{template_hash}-{args.seed}-{args.synthetic_per_class}-{args.punctuation_multiplier}.npz'
    if cache.exists():
        saved = np.load(cache)
        sx, sy = saved['x'], saved['y']
    else:
        sx, sy = [], []
        for label in LABELS:
            templates = [t for t in TEMPLATES if t['label'] == label and not t.get('geometryOnly')]
            # Isolated . and middle-dot are identical: keep their sampling
            # balanced and resolve their vertical position in TypeScript.
            count = args.synthetic_per_class * (args.punctuation_multiplier if label in ',.·' else 1)
            for _ in range(count):
                template = templates[rng.integers(len(templates))]
                strokes, width = augment(template['strokes'], rng)
                if label == ',':
                    width *= rng.uniform(1, 4.5)  # tiny real commas use the same pen as full-height digits
                sx.append(raster(strokes, width))
                sy.append(LABELS.index(label))
            print('generated', label, flush=True)
        sx, sy = np.array(sx), np.array(sy)
        np.savez_compressed(cache, x=sx, y=sy)

    # Real human data (Google MathWriting & HASYv2)
    rx, ry = [], []
    hasy_test_x, hasy_test_y = None, None
    if args.real_data:
        real_cache = CACHE / 'real_data_cache.npz'
        if real_cache.exists():
            rdata = np.load(real_cache)
            rx = np.concatenate([rdata['hasy_train_x'], rdata['mw_x']])
            ry = np.concatenate([rdata['hasy_train_y'], rdata['mw_y']])
            hasy_test_x = torch.tensor(rdata['hasy_test_x'][:, None], dtype=torch.float32)
            hasy_test_y = torch.tensor(rdata['hasy_test_y'], dtype=torch.int64)
            print(f'loaded real human data: train {len(rx)}, test held-out writers {len(hasy_test_y)}', flush=True)

    if len(rx) > 0:
        x = torch.tensor(np.concatenate([x[:55000], sx, px, rx])[:, None], dtype=torch.float32)
        y = torch.tensor(np.concatenate([y[:55000], sy, py, ry]).astype('int64'))
    else:
        x = torch.tensor(np.concatenate([x[:55000], sx, px])[:, None], dtype=torch.float32)
        y = torch.tensor(np.concatenate([y[:55000], sy, py]).astype('int64'))

    net = Net()
    init_sha256 = None
    if args.init:
        initial_bytes = Path(args.init).read_bytes()
        init_sha256 = hashlib.sha256(initial_bytes).hexdigest()
        old = json.loads(initial_bytes.decode('utf-8'))
        if args.retention_weight and old['labels'] != LABELS:
            p.error('retention requires an initial checkpoint with the same labels in the same order')
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
    teacher = copy.deepcopy(net).eval().requires_grad_(False) if args.retention_weight else None
    retention_labels = torch.tensor([LABELS.index(label) for label in args.retention_labels])
    # Separate seed and samples, never the TS evaluation variants or held-out rows.
    crng = np.random.default_rng(args.seed + 101)
    commas = [t for t in TEMPLATES if t['label'] == ',' and not t.get('geometryOnly')]
    cvx = []
    for n in range(500):
        strokes, width = augment(commas[n % len(commas)]['strokes'], crng)
        cvx.append(raster(strokes, width * crng.uniform(1, 4.5)))
    cvx = torch.tensor(np.array(cvx)[:, None], dtype=torch.float32)
    class_weights = torch.ones(len(LABELS))
    class_weights[LABELS.index(',')] = args.comma_weight
    opt = torch.optim.AdamW(net.parameters(), lr=args.learning_rate, weight_decay=.0001)
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
            loss = F.cross_entropy(logits, labels, weight=class_weights)
            # Preserve the initial model's boundaries for digits/letters while
            # letting commas move. Only replay TRAIN samples enter this term.
            if teacher is not None:
                keep = torch.isin(labels, retention_labels)
                if keep.any():
                    with torch.no_grad():
                        target = (teacher(batch[keep]) / 2).softmax(1)
                    loss += args.retention_weight * 4 * F.kl_div(
                        (logits[keep] / 2).log_softmax(1), target, reduction='batchmean')
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
            comma_correct = sum((net(b).argmax(1) == LABELS.index(',')).sum().item() for b in cvx.split(256))
            hasy_info = ''
            hasy_corr = 0
            hasy_total = len(hasy_test_y) if hasy_test_y is not None else 0
            if hasy_test_x is not None:
                hasy_pred = torch.cat([net(b).argmax(1) for b in hasy_test_x.split(256)])
                hasy_corr = (hasy_pred == hasy_test_y).sum().item()
                hasy_info = f' hasy_heldout {hasy_corr}/{hasy_total} ({hasy_corr/hasy_total*100:.1f}%)'
                validation = (mnist_correct / 5000) * 0.40 + (pendigits_correct / len(pval)) * 0.35 + (hasy_corr / hasy_total) * 0.25
            else:
                validation = mnist_correct / 5000 * .5 + pendigits_correct / len(pval) * .5

        print(f'epoch {epoch + 1} train {correct}/{total} mnist {mnist_correct}/5000 pendigits '
              f'{pendigits_correct}/{len(pval)} comma {comma_correct}/500 score {validation:.4f}{hasy_info} '
              f'elapsed {time.perf_counter() - start:.1f}s', flush=True)
        if comma_correct >= 490 and mnist_correct >= 4950 and pendigits_correct >= 485 and validation >= best:
            best = validation
            export(net, {'seed': args.seed, 'epoch': epoch + 1, 'epochsRequested': args.epochs,
                         'syntheticPerClass': args.synthetic_per_class, 'pendigitsVariants': args.pendigits_variants,
                         'mnistTrain': 55000, 'pendigitsTrain': len(px), 'realDataTrain': len(rx), 'validationScore': best,
                         'mnistValidationCorrect': mnist_correct, 'pendigitsValidationCorrect': pendigits_correct,
                         'pendigitsValidationTotal': len(pval), 'torch': torch.__version__,
                         'hasyHeldoutCorrect': hasy_corr, 'hasyHeldoutTotal': hasy_total,
                         'learningRate': args.learning_rate, 'commaWeight': args.comma_weight,
                         'retentionWeight': args.retention_weight,
                         'retentionLabels': args.retention_labels,
                         'punctuationMultiplier': args.punctuation_multiplier,
                         'commaValidationCorrect': comma_correct, 'commaValidationTotal': 500,
                         'initSha256': init_sha256,
                         'templatesSha256': hashlib.sha256((ROOT / 'templates.json').read_bytes()).hexdigest()}, args.output)
        for group in opt.param_groups:
            group['lr'] *= .92
    if best == 0:
        raise RuntimeError('No checkpoint met validation requirements; existing weights were not replaced')
    print('weights bytes', args.output.stat().st_size, flush=True)


if __name__ == '__main__':
    main()
