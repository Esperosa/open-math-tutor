"""Evaluate handwriting model on held-out human writers (UCI pendigits, HASYv2, MathWriting)."""
import base64
import json
import pathlib
import numpy as np
import torch
from torch import nn
from torch.nn import functional as F

ROOT = pathlib.Path(__file__).resolve().parent
MODEL_PATH = ROOT.parent.parent / 'packages/frontend/src/handwriting/model/weights.json'
CACHE = ROOT / '.cache'
LABELS = list('0123456789+-×÷/=().,xyabcn%msgJNVA:·*[]{}±<>≤≥≠√π°∅khloWPK')


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


def load_model(path=MODEL_PATH):
    net = Net()
    payload = json.loads(path.read_text(encoding='utf-8'))
    tensors = {
        name: torch.tensor(np.frombuffer(base64.b64decode(t['data']), dtype='<f4').copy().reshape(t['shape']))
        for name, t in payload['tensors'].items()
    }
    net.load_state_dict(tensors)
    net.eval()
    return net, payload


def evaluate():
    net, meta = load_model()
    cache_file = CACHE / 'real_data_cache.npz'
    if not cache_file.exists():
        print('Cache file not found, run prepare_real_data.py first')
        return

    data = np.load(cache_file)
    hasy_test_x = torch.tensor(data['hasy_test_x'][:, None], dtype=torch.float32)
    hasy_test_y = data['hasy_test_y']
    hasy_test_w = data['hasy_test_w']

    with torch.no_grad():
        logits = net(hasy_test_x)
        preds = logits.argmax(dim=1).numpy()

    correct = (preds == hasy_test_y)
    total_samples = len(hasy_test_y)
    acc = correct.mean() * 100.0 if total_samples > 0 else 0

    # Per-writer accuracy
    unique_writers = np.unique(hasy_test_w)
    writer_accs = []
    for w in unique_writers:
        mask = (hasy_test_w == w)
        if mask.sum() > 0:
            writer_accs.append(correct[mask].mean() * 100.0)

    print(f'HASYv2 held-out writers ({len(unique_writers)} writers, {total_samples} samples):')
    print(f'  Overall accuracy: {correct.sum()}/{total_samples} = {acc:.2f}%')
    print(f'  Macro-average per-writer accuracy: {np.mean(writer_accs):.2f}% (min: {np.min(writer_accs):.1f}%, max: {np.max(writer_accs):.1f}%)')

    # MathWriting samples
    mw_x = torch.tensor(data['mw_x'][:, None], dtype=torch.float32)
    mw_y = data['mw_y']
    if len(mw_y) > 0:
        with torch.no_grad():
            mw_preds = net(mw_x).argmax(dim=1).numpy()
        mw_corr = (mw_preds == mw_y)
        print(f'MathWriting excerpt ({len(mw_y)} samples):')
        print(f'  Accuracy: {mw_corr.sum()}/{len(mw_y)} = {mw_corr.mean() * 100.0:.2f}%')


if __name__ == '__main__':
    evaluate()
