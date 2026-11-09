"""CPU-sized conv/BiGRU CTC trainer and dependency-free runtime weight export.

Only original human train inks enter optimization. Validation is deterministic;
the committed 319-row benchmark and test split never select checkpoints.
"""
import argparse
import base64
import hashlib
import json
import math
import random
import time

import numpy as np
import torch
from torch import nn
from torch.nn.utils.rnn import pack_padded_sequence, pad_packed_sequence

from data_mathwriting import LABELS, ROOT

STEP = .08
MAX_POINTS = 1024


def resample(points, step):
    p = np.asarray(points, dtype=np.float32)
    if len(p) == 1:
        return p
    d = np.concatenate(([0], np.cumsum(np.linalg.norm(np.diff(p, axis=0), axis=1))))
    if d[-1] < 1e-6:
        return p[:1]
    distances = np.arange(0, d[-1], step)
    distances = np.append(distances, d[-1])
    return np.stack([np.interp(distances, d, p[:, c]) for c in (0, 1)], axis=1).astype(np.float32)


def features(traces, rng=None):
    strokes = [np.asarray(p, dtype=np.float32)[:, :2].copy() for p in traces if len(p)]
    flat = np.concatenate(strokes)
    lo = flat.min(0)
    height = max(float(np.ptp(flat[:, 1])), 1.)
    strokes = [(p - lo) / height for p in strokes]
    if rng is not None:
        angle, shear = rng.uniform(-.09, .09), rng.uniform(-.22, .22)
        sx, sy = rng.uniform(.8, 1.2, 2)
        matrix = np.array([[sx * math.cos(angle), shear - math.sin(angle)], [math.sin(angle), sy * math.cos(angle)]])
        transformed = []
        for p in strokes:
            p = p @ matrix.T
            # Sparse pointer sampling and Excalidraw-style thinning, including
            # realistic 3–40px event gaps relative to a random 40–150px glyph.
            if rng.random() < .35:
                p = resample(p, rng.uniform(3, 40) / rng.uniform(40, 150))
            if len(p) > 4 and rng.random() < .2:
                keep = rng.random(len(p)) > .35
                keep[0] = keep[-1] = True
                p = p[keep]
            p += rng.normal(0, rng.uniform(.001, .008), p.shape)
            if len(p) > 8 and rng.random() < .08:
                i = int(rng.integers(3, len(p) - 3))
                transformed.extend([p[:i], p[i:]])
            elif transformed and rng.random() < .025 and np.linalg.norm(transformed[-1][-1] - p[0]) < .25:
                transformed[-1] = np.concatenate([transformed[-1], p])
            else:
                transformed.append(p)
        strokes = transformed
        flat = np.concatenate(strokes)
        lo = flat.min(0)
        height = max(float(np.ptp(flat[:, 1])), .02)
        strokes = [(p - lo) / height for p in strokes]
    total_length = sum(float(np.linalg.norm(np.diff(p, axis=0), axis=1).sum()) for p in strokes)
    step = max(STEP, total_length / max(1, MAX_POINTS - 2 * len(strokes)))
    result = []
    previous = np.zeros(2)
    for stroke in strokes:
        p = resample(stroke, step)
        for i, point in enumerate(p):
            delta = point - previous if result else np.zeros(2)
            result.append([point[0] * .1, point[1], delta[0], delta[1], float(i == 0), float(i == len(p) - 1)])
            previous = point
    return np.asarray(result, dtype=np.float32)


class LineCTC(nn.Module):
    def __init__(self, hidden=64):
        super().__init__()
        self.conv = nn.Conv1d(6, 48, 5, stride=2, padding=2)
        self.gru = nn.GRU(48, hidden, num_layers=2, bidirectional=True, batch_first=True, dropout=.1)
        self.head = nn.Linear(hidden * 2, len(LABELS))

    def forward(self, x, lengths):
        x = torch.relu(self.conv(x.transpose(1, 2))).transpose(1, 2)
        lengths = (lengths + 1) // 2
        x = pack_padded_sequence(x, lengths.cpu(), batch_first=True, enforce_sorted=False)
        x, _ = self.gru(x)
        x, _ = pad_packed_sequence(x, batch_first=True)
        return self.head(x), lengths


def distance(a, b):
    row = list(range(len(b) + 1))
    for i, ca in enumerate(a):
        next_row = [i + 1]
        for j, cb in enumerate(b):
            next_row.append(min(next_row[-1] + 1, row[j + 1] + 1, row[j] + (ca != cb)))
        row = next_row
    return row[-1]


def greedy(logits):
    path = logits.argmax(-1).tolist()
    return ''.join(LABELS[c] for i, c in enumerate(path) if c and (not i or path[i - 1] != c))


def load(split):
    samples = []
    for line in (ROOT / f'data-cache/lines/{split}.jsonl').open(encoding='utf-8'):
        sample = json.loads(line)
        sample['traces'] = [np.asarray(p, dtype=np.float32) for p in sample['traces']]
        samples.append(sample)
    return samples


def batch(items, rng=None):
    xs = [features(s['traces'], rng) for s in items]
    lengths = torch.tensor([len(x) for x in xs], dtype=torch.long)
    x = np.zeros((len(xs), max(lengths).item(), 6), dtype=np.float32)
    for i, f in enumerate(xs):
        x[i, :len(f)] = f
    ys = [torch.tensor([LABELS.index(c) for c in s['label']], dtype=torch.long) for s in items]
    return torch.from_numpy(x), lengths, torch.cat(ys), torch.tensor([len(y) for y in ys], dtype=torch.long)


def evaluate(model, samples):
    errors, chars, exact = 0, 0, 0
    model.eval()
    with torch.inference_mode():
        for offset in range(0, len(samples), 32):
            chunk = samples[offset:offset + 32]
            x, lens, _, _ = batch(chunk)
            output, lens = model(x, lens)
            for s, logits, n in zip(chunk, output, lens):
                pred = greedy(logits[:n])
                errors += distance(s['label'], pred)
                chars += len(s['label'])
                exact += pred == s['label']
    return {'samples': len(samples), 'errors': errors, 'chars': chars, 'cer': errors / chars, 'exact': exact, 'accuracy': exact / len(samples)}


def export(model, destination, metadata):
    weights = {}
    for key, value in model.state_dict().items():
        a = value.detach().cpu().numpy().astype('<f4')
        weights[key] = {'shape': list(a.shape), 'data': base64.b64encode(a.tobytes()).decode('ascii')}
    payload = {'version': 1, 'architecture': 'conv5s2-48-bigru64x2-ctc', 'labels': LABELS, 'step': STEP,
        'maxPoints': MAX_POINTS, 'license': 'CC-BY-NC-SA-4.0', 'source': 'Google MathWriting 2024',
        'metadata': metadata, 'weights': weights}
    destination.write_text(json.dumps(payload, separators=(',', ':')), encoding='utf-8')
    # Runtime parity includes unpadded and variable-length data.
    samples = load('valid')[:3]
    parity = []
    model.eval()
    with torch.inference_mode():
        for sample in samples:
            x = features(sample['traces'])
            logits, _ = model(torch.from_numpy(x)[None], torch.tensor([len(x)]))
            parity.append({'id': sample['id'], 'traces': [p.tolist() for p in sample['traces']], 'features': x.tolist(),
                'logits': logits[0].tolist(), 'greedy': greedy(logits[0])})
    (ROOT / '../../packages/frontend/src/handwriting/__fixtures__/line-parity.json').resolve().write_text(json.dumps(parity), encoding='utf-8')


def train(args):
    torch.set_num_threads(args.threads)
    torch.manual_seed(args.seed)
    rng = np.random.default_rng(args.seed)
    train_samples = load('train')
    random.Random(args.seed).shuffle(train_samples)
    if args.limit:
        train_samples = train_samples[:args.limit]
    old_ids = {s['id'] for s in json.loads((ROOT / '../../packages/frontend/src/handwriting/__fixtures__/mathwriting-eval.json').resolve().read_text())}
    valid = [s for s in load('valid') if s['id'] not in old_ids]
    random.Random(1122).shuffle(valid)
    valid = valid[:args.validation]
    model = LineCTC()
    output = ROOT / '.cache/line-ctc.pt'
    start_epoch = 0
    best = 10.
    if args.resume and output.exists():
        checkpoint = torch.load(output, weights_only=True)
        model.load_state_dict(checkpoint['state'])
        start_epoch, best = checkpoint['epoch'], checkpoint['validation']['cer']
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=.0001)
    loss_fn = nn.CTCLoss(blank=0, zero_infinity=True)
    print('parameters', sum(p.numel() for p in model.parameters()), 'train', len(train_samples), 'validation', len(valid), flush=True)
    history = []
    for epoch in range(start_epoch, start_epoch + args.epochs):
        start = time.monotonic()
        # Random length buckets reduce backward padding; no benchmark labels.
        random.Random(args.seed + epoch).shuffle(train_samples)
        groups = []
        for offset in range(0, len(train_samples), 512):
            bucket = sorted(train_samples[offset:offset + 512], key=lambda s: sum(map(len, s['traces'])))
            groups.extend(bucket[i:i + args.batch] for i in range(0, len(bucket), args.batch))
        random.Random(epoch).shuffle(groups)
        model.train()
        losses = []
        for i, chunk in enumerate(groups):
            x, lens, y, ylens = batch(chunk, rng)
            logits, out_lens = model(x, lens)
            loss = loss_fn(logits.log_softmax(-1).transpose(0, 1), y, out_lens, ylens)
            if not torch.isfinite(loss):
                raise RuntimeError('non-finite CTC loss')
            opt.zero_grad(set_to_none=True)
            loss.backward()
            torch.nn.utils.clip_grad_norm_(model.parameters(), 5.)
            opt.step()
            losses.append(loss.item())
            if (i + 1) % 100 == 0:
                print(f'epoch {epoch + 1} batch {i + 1}/{len(groups)} loss {np.mean(losses[-100:]):.4f} seconds {time.monotonic() - start:.1f}', flush=True)
        metrics = evaluate(model, valid)
        record = {'epoch': epoch + 1, 'loss': float(np.mean(losses)), 'seconds': time.monotonic() - start, 'validation': metrics}
        history.append(record)
        print(json.dumps(record), flush=True)
        if metrics['cer'] < best:
            best = metrics['cer']
            meta = {'epoch': epoch + 1, 'validation': metrics, 'trainRows': len(train_samples), 'seed': args.seed,
                'trainIdSha256': hashlib.sha256('\n'.join(sorted(s['id'] for s in train_samples)).encode()).hexdigest()}
            torch.save({'state': model.state_dict(), **meta}, output)
            export(model, (ROOT / '../../packages/frontend/src/handwriting/model/line-weights.json').resolve(), meta)
        (ROOT / '.cache/line-history.json').write_text(json.dumps(history, indent=2), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=12)
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--validation', type=int, default=512)
    parser.add_argument('--batch', type=int, default=32)
    parser.add_argument('--threads', type=int, default=4)
    parser.add_argument('--seed', type=int, default=20261109)
    parser.add_argument('--lr', type=float, default=.002)
    parser.add_argument('--resume', action='store_true')
    train(parser.parse_args())
