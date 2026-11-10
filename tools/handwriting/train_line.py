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

from data_mathwriting import LABELS, ROOT, linear_label

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
    def __init__(self, hidden=96, layers=2):
        super().__init__()
        self.hidden = hidden
        self.layers = layers
        self.conv = nn.Conv1d(6, 48, 5, stride=2, padding=2)
        self.gru = nn.GRU(48, hidden, num_layers=layers, bidirectional=True, batch_first=True, dropout=.1 if layers > 1 else 0.)
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
    with (ROOT / f'data-cache/lines/{split}.jsonl').open(encoding='utf-8') as source:
        for line in source:
            sample = json.loads(line)
            if linear_label(sample['raw_label']) != sample['label']:
                raise ValueError('Stale/unsupported line labels; rerun data_mathwriting.py before training')
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
    payload = {'version': 1, 'architecture': f'conv5s2-48-bigru{model.hidden}x{model.layers}-ctc',
        'hidden': model.hidden, 'layers': model.layers,
        'labels': LABELS, 'step': STEP,
        'maxPoints': MAX_POINTS, 'license': 'CC-BY-NC-SA-4.0', 'source': 'Google MathWriting 2024',
        'metadata': metadata, 'weights': weights}
    temporary = destination.with_suffix('.json.tmp')
    temporary.write_text(json.dumps(payload, separators=(',', ':')), encoding='utf-8')
    temporary.replace(destination)
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
    if args.flat_focus:
        # The app is primarily a writing line, not a page-level LaTeX parser.
        # Balance its underrepresented flat rows with equally many 2-D rows;
        # never synthesize an answer or draw from valid/test to fill a class.
        def flat(sample):
            return len(sample['label']) <= 24 and not any(marker in sample['raw_label'] for marker in ('\\frac', '\\dfrac', '\\tfrac', '^', '\\sqrt'))
        flat_rows = [s for s in train_samples if flat(s)]
        structured = [s for s in train_samples if not flat(s)]
        train_samples = flat_rows + structured[:len(flat_rows)]
        random.Random(args.seed).shuffle(train_samples)
    if args.limit:
        train_samples = train_samples[:args.limit]
    eval_319_ids = {s['id'] for s in json.loads((ROOT / '../../packages/frontend/src/handwriting/__fixtures__/mathwriting-eval.json').resolve().read_text(encoding='utf-8'))}
    heldout_512_ids = {s['id'] for s in json.loads((ROOT / '../../packages/frontend/src/handwriting/__fixtures__/line-heldout.json').resolve().read_text(encoding='utf-8'))}
    calib_ids = {s['id'] for s in json.loads((ROOT / 'data-cache/line-calibration.json').resolve().read_text(encoding='utf-8'))} if (ROOT / 'data-cache/line-calibration.json').exists() else set()
    forbidden = eval_319_ids | heldout_512_ids | calib_ids
    if forbidden.intersection(s['id'] for s in train_samples):
        raise ValueError('Benchmark ID found in training split')
    valid_candidates = [s for s in load('valid') if s['id'] not in forbidden]
    random.Random(1122).shuffle(valid_candidates)
    valid = valid_candidates[:args.validation]
    model = LineCTC(hidden=args.hidden, layers=args.layers)
    output = ROOT / '.cache/line-ctc.pt'
    output_latest = ROOT / '.cache/line-ctc-latest.pt'
    start_epoch = 0
    best = 10.
    checkpoint_file = output_latest if output_latest.exists() else output
    if args.resume and checkpoint_file.exists():
        checkpoint = torch.load(checkpoint_file, weights_only=False)
        model.load_state_dict(checkpoint['state'])
        start_epoch = checkpoint.get('epoch', 0)
        best = checkpoint.get('best', checkpoint['validation']['cer'])
        print(f'Resumed from epoch {start_epoch}, previous best CER {best:.4f}', flush=True)
    total_epochs = args.total_epochs or (start_epoch + args.epochs)
    opt = torch.optim.AdamW(model.parameters(), lr=args.lr, weight_decay=.0001)
    scheduler = torch.optim.lr_scheduler.CosineAnnealingLR(opt, T_max=total_epochs, eta_min=args.lr * 0.05)
    if args.resume and checkpoint_file.exists():
        if 'opt' in checkpoint:
            opt.load_state_dict(checkpoint['opt'])
        if 'scheduler' in checkpoint:
            scheduler.load_state_dict(checkpoint['scheduler'])
        else:
            for _ in range(start_epoch):
                scheduler.step()
    history = []
    if (ROOT / '.cache/line-history.json').exists():
        try:
            history = json.loads((ROOT / '.cache/line-history.json').read_text(encoding='utf-8'))
        except Exception:
            history = []
    loss_fn = nn.CTCLoss(blank=0, zero_infinity=True)
    print(f'architecture conv5s2-48-bigru{args.hidden}x{args.layers}-ctc parameters {sum(p.numel() for p in model.parameters())} train {len(train_samples)} validation {len(valid)} threads {args.threads} target {start_epoch}->{min(total_epochs, start_epoch + args.epochs)}', flush=True)
    for epoch in range(start_epoch, min(total_epochs, start_epoch + args.epochs)):
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
            if (i + 1) % 100 == 0 or (i + 1) == len(groups):
                print(f'epoch {epoch + 1} batch {i + 1}/{len(groups)} loss {np.mean(losses[-100:]):.4f} lr {scheduler.get_last_lr()[0]:.6f} seconds {time.monotonic() - start:.1f}', flush=True)
        scheduler.step()
        metrics = evaluate(model, valid)
        record = {'epoch': epoch + 1, 'loss': float(np.mean(losses)), 'seconds': time.monotonic() - start, 'validation': metrics}
        # Update or append epoch history
        history = [h for h in history if h['epoch'] != epoch + 1] + [record]
        print(json.dumps(record), flush=True)
        if metrics['cer'] < best:
            best = metrics['cer']
            meta = {'epoch': epoch + 1, 'validation': metrics, 'trainRows': len(train_samples), 'seed': args.seed,
                'selection': 'balanced flat and structured replay' if args.flat_focus else 'full clean mathwriting corpus',
                'trainIdSha256': hashlib.sha256('\\n'.join(sorted(s['id'] for s in train_samples)).encode()).hexdigest(),
                'hidden': args.hidden, 'layers': args.layers}
            torch.save({'state': model.state_dict(), **meta}, output)
            export(model, (ROOT / '../../packages/frontend/src/handwriting/model/line-weights.json').resolve(), meta)
        torch.save({'state': model.state_dict(), 'opt': opt.state_dict(), 'scheduler': scheduler.state_dict(), 'epoch': epoch + 1, 'best': best, 'validation': metrics, 'hidden': args.hidden, 'layers': args.layers}, output_latest)
        (ROOT / '.cache/line-history.json').write_text(json.dumps(history, indent=2), encoding='utf-8')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--epochs', type=int, default=1)
    parser.add_argument('--total-epochs', type=int, default=10)
    parser.add_argument('--limit', type=int, default=0)
    parser.add_argument('--validation', type=int, default=512)
    parser.add_argument('--batch', type=int, default=64)
    parser.add_argument('--threads', type=int, default=8)
    parser.add_argument('--seed', type=int, default=20261109)
    parser.add_argument('--lr', type=float, default=.002)
    parser.add_argument('--hidden', type=int, default=96)
    parser.add_argument('--layers', type=int, default=2)
    parser.add_argument('--resume', action='store_true')
    parser.add_argument('--flat-focus', action='store_true')
    train(parser.parse_args())
