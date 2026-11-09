"""Prepare and cache real human handwriting data (MathWriting + HASYv2)."""
import csv
import io
import json
import pathlib
import sys
import tarfile
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from scipy.ndimage import shift

ROOT = pathlib.Path(__file__).resolve().parent
DATA_CACHE = ROOT / 'data-cache'
CACHE = ROOT / '.cache'
CACHE.mkdir(exist_ok=True)

LABELS = list('0123456789+-×÷/=().,xyabcn%msgJNVA:·*[]{}±<>≤≥≠√π°∅khloWPK')

LATEX_MAP = {
    '\\times': '×',
    '\\cdot': '·',
    '\\div': '÷',
    '\\pm': '±',
    '\\le': '≤',
    '\\leq': '≤',
    '\\ge': '≥',
    '\\geq': '≥',
    '\\neq': '≠',
    '\\sqrt': '√',
    '\\pi': 'π',
    '\\degree': '°',
    '\\emptyset': '∅',
    '\\{': '{',
    '\\}': '}',
    '\\%': '%',
}
for ch in LABELS:
    LATEX_MAP[ch] = ch


def parse_inkml_traces(content: bytes):
    root = ET.fromstring(content)
    ns = {'ink': 'http://www.w3.org/2003/InkML'}
    traces = []
    for trace in root.findall('ink:trace', ns):
        text = trace.text or ''
        pts = []
        for token in text.strip().split(','):
            parts = token.strip().split()
            if len(parts) >= 2:
                try:
                    pts.append([float(parts[0]), float(parts[1])])
                except ValueError:
                    pass
        if len(pts) > 0:
            traces.append(pts)
    return traces


def raster_image_32_to_28(img_bytes: bytes) -> np.ndarray:
    img = Image.open(io.BytesIO(img_bytes)).convert('L')
    arr = np.array(img, dtype=np.float32)
    ink = (255.0 - arr) / 255.0

    active_y, active_x = np.where(ink > 0.1)
    if len(active_x) == 0 or len(active_y) == 0:
        return np.zeros((28, 28), dtype=np.float32)

    min_x, max_x = active_x.min(), active_x.max()
    min_y, max_y = active_y.min(), active_y.max()
    cropped = ink[min_y:max_y + 1, min_x:max_x + 1]

    h, w = cropped.shape
    scale = 20.0 / max(h, w, 1)
    new_w = max(1, int(round(w * scale)))
    new_h = max(1, int(round(h * scale)))

    c_img = Image.fromarray((cropped * 255).astype(np.uint8)).resize((new_w, new_h), Image.Resampling.BILINEAR)
    c_arr = np.array(c_img, dtype=np.float32) / 255.0

    out = np.zeros((28, 28), dtype=np.float32)
    ox = (28 - new_w) // 2
    oy = (28 - new_h) // 2
    out[oy:oy + new_h, ox:ox + new_w] = c_arr

    yy, xx = np.mgrid[0:28, 0:28]
    mass = out.sum()
    if mass > 0:
        out = shift(out, (13.5 - (out * yy).sum() / mass,
                          13.5 - (out * xx).sum() / mass), order=1, mode='constant')
    return np.clip(out, 0.0, 1.0).astype(np.float32)


def raster_strokes_fixed(strokes):
    from data import raster
    pts = np.concatenate(strokes)
    span = max(np.ptp(pts[:, 0]), np.ptp(pts[:, 1]), 1.0)
    return raster(strokes, span * 0.11)


def strong_augment_strokes(strokes, rng):
    """Strong affine, elastic, line thickness and sampling augmentation on real strokes."""
    flat = np.concatenate(strokes)
    span = max(np.ptp(flat[:, 0]), np.ptp(flat[:, 1]), 8.0)

    angle = rng.uniform(-0.25, 0.25)
    shear = rng.uniform(-0.20, 0.20)
    sx, sy = rng.uniform(0.80, 1.20, 2)
    matrix = np.array([
        [np.cos(angle) * sx, shear - np.sin(angle)],
        [np.sin(angle), np.cos(angle) * sy]
    ])

    result = []
    for stroke in strokes:
        source = [np.array(p, dtype=float) for p in stroke]
        if len(source) < 2:
            result.append(source)
            continue

        sample_step = rng.uniform(2.0, 8.0)
        resampled = []
        for a, b in zip(source, source[1:]):
            dist = float(np.linalg.norm(b - a))
            steps = max(1, int(dist / sample_step))
            for t in np.linspace(0, 1, steps, endpoint=False):
                resampled.append(a * (1.0 - t) + b * t)
        resampled.append(source[-1])

        p = np.array(resampled, dtype=float)
        p[:, 0] += np.sin(p[:, 1] / span * 5.0 + rng.uniform(0, 6.28)) * span * rng.uniform(0.01, 0.03)
        p[:, 1] += np.cos(p[:, 0] / span * 5.0 + rng.uniform(0, 6.28)) * span * rng.uniform(0.01, 0.03)
        p += rng.normal(0, span * 0.01, p.shape)

        transformed = (p @ matrix.T).tolist()
        result.append(transformed)

    width = float(span * rng.uniform(0.07, 0.16))
    return result, width


def main():
    cache_file = CACHE / 'real_data_cache.npz'

    print('Building real human handwriting dataset from MathWriting & HASYv2...', flush=True)

    # 1. MathWriting standalone symbols + excerpt cuts
    mw_samples = []

    # First from full archive symbols/
    full_mw = DATA_CACHE / 'mathwriting-2024.tgz'
    if full_mw.exists():
        print(f'Extracting standalone symbols from {full_mw}...', flush=True)
        with tarfile.open(full_mw, 'r|*') as tar:
            for m in tar:
                if not m.name.startswith('mathwriting-2024/symbols/'):
                    continue
                if not m.name.endswith('.inkml'):
                    continue
                content = tar.extractfile(m).read()
                root = ET.fromstring(content)
                ns = {'ink': 'http://www.w3.org/2003/InkML'}
                label_text = None
                for ann in root.findall('ink:annotation', ns):
                    if ann.attrib.get('type') in ('normalizedLabel', 'label'):
                        label_text = ann.text
                        break
                mapped = LATEX_MAP.get(label_text, label_text)
                if mapped in LABELS:
                    traces = parse_inkml_traces(content)
                    if traces:
                        mw_samples.append({'label': mapped, 'strokes': traces})

    # Also from excerpt if present
    excerpt_mw = DATA_CACHE / 'mathwriting-2024-excerpt.tgz'
    if excerpt_mw.exists():
        with tarfile.open(excerpt_mw) as tar:
            try:
                sym_file = tar.extractfile('mathwriting-2024-excerpt/symbols.jsonl')
                if sym_file:
                    cuts = [json.loads(line.decode('utf-8')) for line in sym_file]
                    cuts_by_source = {}
                    for c in cuts:
                        cuts_by_source.setdefault(c['sourceSampleId'], []).append(c)
                    for sid, sid_cuts in cuts_by_source.items():
                        subpath = f'mathwriting-2024-excerpt/train/{sid}.inkml'
                        try:
                            content = tar.extractfile(tar.getmember(subpath)).read()
                            all_traces = parse_inkml_traces(content)
                            for c in sid_cuts:
                                mapped = LATEX_MAP.get(c['label'], c['label'])
                                if mapped in LABELS:
                                    selected = [all_traces[i] for i in c['strokeIndices'] if i < len(all_traces)]
                                    if selected:
                                        mw_samples.append({'label': mapped, 'strokes': selected})
                        except Exception:
                            continue
            except Exception:
                pass

    print(f'Total extracted MathWriting stroke symbols: {len(mw_samples)}', flush=True)

    # Convert MW samples to rasters with strong augmentation
    from data import raster
    mw_x, mw_y = [], []
    rng = np.random.default_rng(20261108)
    for s in mw_samples:
        lbl_idx = LABELS.index(s['label'])
        try:
            r = raster_strokes_fixed(s['strokes'])
            mw_x.append(r)
            mw_y.append(lbl_idx)
            # 3 augmented variants per real stroke symbol
            for _ in range(3):
                aug_strokes, aug_w = strong_augment_strokes(s['strokes'], rng)
                r_aug = raster(aug_strokes, aug_w)
                mw_x.append(r_aug)
                mw_y.append(lbl_idx)
        except Exception:
            continue

    mw_x = np.array(mw_x, dtype=np.float32) if mw_x else np.zeros((0, 28, 28), dtype=np.float32)
    mw_y = np.array(mw_y, dtype=np.int64) if mw_y else np.zeros((0,), dtype=np.int64)
    print(f'Total MathWriting rasters (with augmentations): {len(mw_x)}', flush=True)

    # 2. HASYv2 archive
    hasy_archive = DATA_CACHE / 'HASYv2.tar.bz2'
    hasy_train_x, hasy_train_y, hasy_train_w = [], [], []
    hasy_test_x, hasy_test_y, hasy_test_w = [], [], []

    if hasy_archive.exists():
        print('Extracting HASYv2 labels and user_id mappings...', flush=True)
        labels_info = {}
        writer_counts = {}
        with tarfile.open(hasy_archive) as tar:
            f = io.TextIOWrapper(tar.extractfile('hasy-data-labels.csv'), encoding='utf-8')
            reader = csv.DictReader(f)
            for row in reader:
                mapped = LATEX_MAP.get(row['latex'], row['latex'])
                if mapped in LABELS:
                    uid = row['user_id']
                    labels_info[row['path']] = (mapped, uid)
                    writer_counts[uid] = writer_counts.get(uid, 0) + 1

            # Deterministic held-out writers: target ~2500 samples (approx 15-20% of data)
            all_writers = sorted(writer_counts.keys())
            rng_writers = np.random.default_rng(20261108)
            shuffled_writers = list(all_writers)
            rng_writers.shuffle(shuffled_writers)

            heldout_writers = set()
            heldout_sample_count = 0
            for w in shuffled_writers:
                if writer_counts[w] > 2000:
                    continue
                heldout_writers.add(w)
                heldout_sample_count += writer_counts[w]
                if heldout_sample_count >= 2500:
                    break

            train_expected = sum(c for w, c in writer_counts.items() if w not in heldout_writers)
            print(f'HASY matched entries: {len(labels_info)}, heldout writers: {len(heldout_writers)} ({heldout_sample_count} samples), train expected: {train_expected}', flush=True)

            # Stream extract
            extracted = 0
            for m in tar:
                if m.name in labels_info:
                    label, uid = labels_info[m.name]
                    img_bytes = tar.extractfile(m).read()
                    r_img = raster_image_32_to_28(img_bytes)
                    lbl_idx = LABELS.index(label)
                    uid_int = int(uid) if uid.isdigit() else hash(uid) % 100000

                    if uid in heldout_writers:
                        if len(hasy_test_x) < 3000:
                            hasy_test_x.append(r_img)
                            hasy_test_y.append(lbl_idx)
                            hasy_test_w.append(uid_int)
                    else:
                        if len(hasy_train_x) < 12000:
                            hasy_train_x.append(r_img)
                            hasy_train_y.append(lbl_idx)
                            hasy_train_w.append(uid_int)

                    extracted += 1
                    if len(hasy_test_x) >= 3000 and len(hasy_train_x) >= 12000:
                        break

    hasy_train_x = np.array(hasy_train_x, dtype=np.float32)
    hasy_train_y = np.array(hasy_train_y, dtype=np.int64)
    hasy_train_w = np.array(hasy_train_w, dtype=np.int64)

    hasy_test_x = np.array(hasy_test_x, dtype=np.float32)
    hasy_test_y = np.array(hasy_test_y, dtype=np.int64)
    hasy_test_w = np.array(hasy_test_w, dtype=np.int64)

    print(f'Done: HASY train {len(hasy_train_x)}, HASY heldout writers test {len(hasy_test_x)}', flush=True)

    np.savez_compressed(
        cache_file,
        mw_x=mw_x, mw_y=mw_y,
        hasy_train_x=hasy_train_x, hasy_train_y=hasy_train_y, hasy_train_w=hasy_train_w,
        hasy_test_x=hasy_test_x, hasy_test_y=hasy_test_y, hasy_test_w=hasy_test_w,
    )
    print(f'Saved compressed dataset to {cache_file} (MW: {len(mw_x)}, HASY train: {len(hasy_train_x)}, HASY test: {len(hasy_test_x)})', flush=True)


if __name__ == '__main__':
    main()
