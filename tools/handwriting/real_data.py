"""Google MathWriting and HASYv2 extraction and evaluation on held-out human writers."""
import csv
import io
import json
import pathlib
import tarfile
import xml.etree.ElementTree as ET
import numpy as np
from PIL import Image
from scipy.ndimage import shift

ROOT = pathlib.Path(__file__).resolve().parent
DATA_CACHE = ROOT / 'data-cache'
CACHE = ROOT / '.cache'

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
    """Parse trace points from an InkML XML payload."""
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


def load_mathwriting_excerpt():
    """Extract human-written symbol strokes from the MathWriting sample excerpt."""
    archive = DATA_CACHE / 'mathwriting-2024-excerpt.tgz'
    if not archive.exists():
        return []

    samples = []
    with tarfile.open(archive) as tar:
        # 1. Standalone symbols in symbols/
        for m in tar.getmembers():
            if m.name.startswith('mathwriting-2024-excerpt/symbols/') and m.name.endswith('.inkml'):
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
                        samples.append({'label': mapped, 'strokes': traces, 'source': 'mathwriting-symbols'})

        # 2. Cut symbols from symbols.jsonl
        try:
            sym_file = tar.extractfile('mathwriting-2024-excerpt/symbols.jsonl')
            if sym_file:
                cuts = []
                for line in sym_file:
                    cuts.append(json.loads(line.decode('utf-8')))
                # Group cuts by sourceSampleId
                cuts_by_source = {}
                for c in cuts:
                    cuts_by_source.setdefault(c['sourceSampleId'], []).append(c)

                for sid, sid_cuts in cuts_by_source.items():
                    subpath = f'mathwriting-2024-excerpt/train/{sid}.inkml'
                    try:
                        member = tar.getmember(subpath)
                        content = tar.extractfile(member).read()
                        all_traces = parse_inkml_traces(content)
                        for c in sid_cuts:
                            mapped = LATEX_MAP.get(c['label'], c['label'])
                            if mapped in LABELS:
                                selected = [all_traces[i] for i in c['strokeIndices'] if i < len(all_traces)]
                                if selected:
                                    samples.append({'label': mapped, 'strokes': selected, 'source': f'mathwriting-{sid}'})
                    except (KeyError, ET.ParseError):
                        continue
        except Exception:
            pass

    return samples


def load_hasy_writers(max_samples=25000):
    """Load HASYv2 dataset split by human writer (user_id)."""
    archive = DATA_CACHE / 'HASYv2.tar.bz2'
    if not archive.exists():
        return [], []

    # First read labels CSV
    labels_info = []
    with tarfile.open(archive) as tar:
        f = io.TextIOWrapper(tar.extractfile('hasy-data-labels.csv'), encoding='utf-8')
        reader = csv.DictReader(f)
        for row in reader:
            mapped = LATEX_MAP.get(row['latex'], row['latex'])
            if mapped in LABELS:
                labels_info.append({
                    'path': row['path'],
                    'label': mapped,
                    'user_id': row['user_id']
                })

    # Select deterministic held-out writers (approx 20% of writers)
    all_writers = sorted(set(r['user_id'] for r in labels_info))
    rng = np.random.default_rng(20261108)
    shuffled_writers = list(all_writers)
    rng.shuffle(shuffled_writers)
    heldout_writers = set(shuffled_writers[:max(1, len(shuffled_writers) // 5)])

    train_meta = [r for r in labels_info if r['user_id'] not in heldout_writers]
    test_meta = [r for r in labels_info if r['user_id'] in heldout_writers]

    # Limit to max_samples for fast loading
    if len(train_meta) > max_samples:
        train_meta = train_meta[:max_samples]
    if len(test_meta) > 4000:
        test_meta = test_meta[:4000]

    return train_meta, test_meta, heldout_writers


def raster_image_32_to_28(img_bytes: bytes) -> np.ndarray:
    """Rasterize a 32x32 HASY grayscale PNG to 28x28 centered float32 [0, 1]."""
    img = Image.open(io.BytesIO(img_bytes)).convert('L')
    arr = np.array(img, dtype=np.float32)
    # HASY is black ink on white background (255 background, 0 ink)
    # Convert to MNIST format: white ink [0..1] on black background [0]
    ink = (255.0 - arr) / 255.0

    # Crop to ink bounding box
    active_y, active_x = np.where(ink > 0.1)
    if len(active_x) == 0 or len(active_y) == 0:
        return np.zeros((28, 28), dtype=np.float32)

    min_x, max_x = active_x.min(), active_x.max()
    min_y, max_y = active_y.min(), active_y.max()
    cropped = ink[min_y:max_y + 1, min_x:max_x + 1]

    # Scale to fit 20x20 keeping aspect ratio
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

    # Center of mass shift to (13.5, 13.5)
    yy, xx = np.mgrid[0:28, 0:28]
    mass = out.sum()
    if mass > 0:
        out = shift(out, (13.5 - (out * yy).sum() / mass,
                          13.5 - (out * xx).sum() / mass), order=1, mode='constant')
    return np.clip(out, 0.0, 1.0).astype(np.float32)


def strong_augment_strokes(strokes, rng):
    """Strong affine, elastic, line thickness and sampling augmentation on real strokes."""
    flat = np.concatenate(strokes)
    span = max(np.ptp(flat[:, 0]), np.ptp(flat[:, 1]), 8.0)

    # 1. Affine: angle +-20 deg, shear +-20 deg, scale 0.75-1.25
    angle = rng.uniform(-0.35, 0.35)
    shear = rng.uniform(-0.30, 0.30)
    sx, sy = rng.uniform(0.75, 1.25, 2)
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

        # Uneven mouse sampling (sparse points with steps 3-40px simulated)
        sample_step = rng.uniform(2.0, 12.0)
        resampled = []
        for a, b in zip(source, source[1:]):
            dist = float(np.linalg.norm(b - a))
            steps = max(1, int(dist / sample_step))
            for t in np.linspace(0, 1, steps, endpoint=False):
                resampled.append(a * (1.0 - t) + b * t)
        resampled.append(source[-1])

        p = np.array(resampled, dtype=float)

        # 2. Elastic wavy deformation
        p[:, 0] += np.sin(p[:, 1] / span * 5.0 + rng.uniform(0, 6.28)) * span * rng.uniform(0.01, 0.04)
        p[:, 1] += np.cos(p[:, 0] / span * 5.0 + rng.uniform(0, 6.28)) * span * rng.uniform(0.01, 0.04)

        # Jitter / tremor
        p += rng.normal(0, span * 0.015, p.shape)

        # Transform
        transformed = (p @ matrix.T).tolist()

        # 3. Multi-stroke splitting (optionally fragment a stroke into 2 pieces)
        if len(transformed) > 6 and rng.random() < 0.25:
            split_idx = rng.integers(2, len(transformed) - 2)
            result.append(transformed[:split_idx])
            result.append(transformed[split_idx:])
        else:
            result.append(transformed)

    # Line thickness
    width = float(span * rng.uniform(0.06, 0.18))
    return result, width
