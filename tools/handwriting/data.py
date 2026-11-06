"""Seeded stroke augmentation and the same 28x28 raster contract as raster.ts."""
import json
from pathlib import Path
import numpy as np
from scipy.ndimage import shift

ROOT = Path(__file__).resolve().parent
LABELS = list('0123456789+-×÷/=().,xyabcn%msgJNVA:·*[]{}±<>≤≥≠√π°∅')
TEMPLATES = json.loads((ROOT / 'templates.json').read_text(encoding='utf-8'))


def augment(strokes, rng, strength=1.0):
    """Augmentation for font templates: keep glyph shapes readable while adding hand variance."""
    flat = np.concatenate(strokes)
    span = max(np.ptp(flat[:, 0]), np.ptp(flat[:, 1]), 8)
    angle = rng.uniform(-.17, .17) * strength
    shear = rng.uniform(-.22, .22) * strength
    sx, sy = rng.uniform(.8, 1.2, 2)
    matrix = np.array([[np.cos(angle) * sx, shear - np.sin(angle)],
                       [np.sin(angle), np.cos(angle) * sy]])
    result = []
    for stroke in strokes:
        # Irregular subdivision simulates variable pen speed, without erasing corners.
        points = []
        for a, b in zip(stroke, stroke[1:]):
            count = max(1, int(np.linalg.norm(np.subtract(a, b)) / rng.uniform(1, 4)))
            for t in np.linspace(0, 1, count, endpoint=False):
                points.append(np.array(a) * (1 - t) + np.array(b) * t)
        points.append(np.array(stroke[-1]))
        p = np.array(points, dtype=float)
        p += rng.normal(0, span * .012 * strength, p.shape)
        p[:, 0] += np.sin(p[:, 1] / span * 4 + rng.uniform(0, 6)) * span * .025 * strength
        result.append((p @ matrix.T).tolist())
    return result, float(span * rng.uniform(.045, .12))


def augment_pen(strokes, rng):
    """Stronger augmentation for real pen trajectories (UCI pendigits).

    Real writers tilt up to 15 degrees, vary scale and shear, overshoot stroke ends
    and use a 2-3 px pen at 28x28. Font templates keep their gentler transform so
    unseen typefaces stay readable.
    """
    flat = np.concatenate(strokes)
    span = max(np.ptp(flat[:, 0]), np.ptp(flat[:, 1]), 8)
    angle = rng.uniform(-.26, .26)
    shear = rng.uniform(-.26, .26)
    sx, sy = rng.uniform(.75, 1.25, 2)
    matrix = np.array([[np.cos(angle) * sx, shear - np.sin(angle)],
                       [np.sin(angle), np.cos(angle) * sy]])
    result = []
    for stroke in strokes:
        source = [np.array(p, dtype=float) for p in stroke]
        if len(source) > 1:
            if rng.random() < .3:
                source[-1] = source[-1] + (source[-1] - source[-2]) * rng.uniform(.02, .12)
            if rng.random() < .25:
                source[0] = source[0] + (source[0] - source[1]) * rng.uniform(.02, .10)
            if rng.random() < .2:
                t = rng.uniform(.03, .12)
                source[0] = source[0] * (1 - t) + source[1] * t
        points = []
        for a, b in zip(source, source[1:]):
            count = max(1, int(np.linalg.norm(np.subtract(a, b)) / rng.uniform(1, 4)))
            for t in np.linspace(0, 1, count, endpoint=False):
                points.append(np.array(a) * (1 - t) + np.array(b) * t)
        points.append(np.array(source[-1]))
        p = np.array(points, dtype=float)
        p += rng.normal(0, span * .014, p.shape)
        p[:, 0] += np.sin(p[:, 1] / span * 4 + rng.uniform(0, 6)) * span * .02
        result.append((p @ matrix.T).tolist())
    return result, float(span * rng.uniform(.06, .16))


def raster(strokes, width):
    pts = np.concatenate(strokes)
    low, high = pts.min(0), pts.max(0)
    size = high - low
    scale = 20 / max(*(size + width), 1e-6)
    radius = max(.65, width * scale / 2)
    offset = (28 - size * scale) / 2
    yy, xx = np.mgrid[0:28, 0:28]
    image = np.zeros((28, 28), dtype=np.float32)
    for stroke in strokes:
        p = (np.array(stroke) - low) * scale + offset
        for a, b in zip(p, np.concatenate([p[1:], p[-1:]])):
            d = b - a
            norm = d @ d
            t = np.clip(((xx - a[0]) * d[0] + (yy - a[1]) * d[1]) / max(norm, 1e-12), 0, 1)
            dist = np.hypot(xx - a[0] - t * d[0], yy - a[1] - t * d[1])
            image = np.maximum(image, np.clip(radius + .5 - dist, 0, 1))
    mass = image.sum()
    if mass:
        image = shift(image, (13.5 - (image * yy).sum() / mass,
                              13.5 - (image * xx).sum() / mass), order=1, mode='constant')
    return image.astype(np.float32)
