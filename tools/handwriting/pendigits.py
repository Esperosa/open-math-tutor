"""UCI Pen-Based Recognition of Handwritten Digits (online pen trajectories).

44 writers, 250 samples each, resampled to 8 (x, y) points per digit. Writers
1-30 are the official training split (`pendigits.tra`), writers 31-44 the
writer-independent test split (`pendigits.tes`). Only the 2-D trajectory is
used; the pressure channel of the original tablet was discarded by the authors.

Citation: F. Alimoglu, E. Alpaydin, "Methods of Combining Multiple Classifiers
Based on Different Representations for Pen-based Handwriting Recognition",
TAINN 96. Department of Computer Engineering, Bogazici University.
Data: https://archive.ics.uci.edu/dataset/81/pen+based+recognition+of+handwritten+digits
Licence: CC BY 4.0.
"""
import hashlib
import urllib.request
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parent
CACHE = ROOT / '.cache'
BASE = 'https://archive.ics.uci.edu/ml/machine-learning-databases/pendigits/'
FILES = {
    'pendigits.tra': 'e2b9eb9f0d0467e2b64a4816a3420edf2b8043447576f4b84337aba44a9f97d3',
    'pendigits.tes': '8bd03229c5c5291fefe43e45465dd948d2645bf23328b9d993e0b777666b2015',
    'pendigits.names': 'a90a76e1edac6f1b50f4b44db80587d7b92601fcbb153c83c2c3210c21b34f60',
}


def path(name):
    CACHE.mkdir(exist_ok=True)
    target = CACHE / name
    if not target.exists():
        data = urllib.request.urlopen(BASE + name, timeout=120).read()
        if hashlib.sha256(data).hexdigest() != FILES[name]:
            raise ValueError('pendigits checksum mismatch: ' + name)
        target.write_bytes(data)
    if hashlib.sha256(target.read_bytes()).hexdigest() != FILES[name]:
        raise ValueError('Corrupt cached pendigits: ' + name)
    return target


def load(name):
    """Return [(strokes, label)] where strokes is one polyline in a 0..100 box."""
    rows = np.loadtxt(path(name), delimiter=',')
    result = []
    for row in rows:
        points = row[:16].reshape(8, 2).astype(float).tolist()
        result.append(([points], int(row[16])))
    return result
