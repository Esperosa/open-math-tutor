"""Extract held-out human expressions from MathWriting valid and test splits for evaluation."""
import json
import pathlib
import re
import tarfile
import xml.etree.ElementTree as ET

ROOT = pathlib.Path(__file__).resolve().parent
DATA_CACHE = ROOT / 'data-cache'
CACHE = ROOT / '.cache'
CACHE.mkdir(exist_ok=True)

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
    '\\degree': '°',
    '\\{': '(',
    '\\}': ')',
    '\\%': '%',
}
APP_CHARS = set('0123456789+-×÷/=().,xyabcn%msgJNVA:·*[]{}±<>≤≥≠°khloWPK')


def norm(text: str) -> str:
    for k, v in LATEX_MAP.items():
        text = text.replace(k, v)
    text = text.replace('\\left', '').replace('\\right', '')
    text = text.replace('{', '(').replace('}', ')')
    text = re.sub(r'\\!', '', text)
    text = re.sub(r'\\,', '', text)
    text = re.sub(r'\\;', '', text)
    text = re.sub(r'\\quad', '', text)
    text = re.sub(r'\\qquad', '', text)
    text = re.sub(r'\\mathbf', '', text)
    text = re.sub(r'\\mathit', '', text)
    text = re.sub(r'\\mathrm', '', text)
    text = re.sub(r'\s+', '', text)
    return text


def extract_eval_expressions(target_count=350):
    archive = DATA_CACHE / 'mathwriting-2024.tgz'
    if not archive.exists():
        archive = DATA_CACHE / 'mathwriting-2024-excerpt.tgz'

    print(f'Opening {archive} for extraction...')
    found = []
    split_counts = {}
    with tarfile.open(archive, 'r|*') as tar:
        for m in tar:
            if not m.name.endswith('.inkml'):
                continue
            parts = m.name.split('/')
            if len(parts) < 3 or parts[1] not in ('valid', 'test'):
                continue
            content = tar.extractfile(m).read()
            root = ET.fromstring(content)
            ns = {'ink': 'http://www.w3.org/2003/InkML'}
            anns = {a.attrib.get('type'): a.text for a in root.findall('ink:annotation', ns)}
            if anns.get('inkCreationMethod') and anns.get('inkCreationMethod') != 'human':
                continue
            raw_label = anns.get('normalizedLabel') or anns.get('label') or ''

            # Skip 2D multi-line or complex structures
            if any(k in raw_label for k in ('\\frac', '\\sum', '\\int', '^', '_', '\\lim', '\\prod', '\\sqrt', '\\overline', '\\vec', '\\matrix')):
                continue

            label = norm(raw_label)
            if len(label) < 3 or len(label) > 15:
                continue
            if not all(ch in APP_CHARS for ch in label):
                continue

            traces = []
            for t in root.findall('ink:trace', ns):
                pts = []
                for token in (t.text or '').strip().split(','):
                    p = token.strip().split()
                    if len(p) >= 2:
                        try:
                            pts.append([float(p[0]), float(p[1])])
                        except ValueError:
                            pass
                if len(pts) > 0:
                    traces.append(pts)
            if not traces:
                continue

            all_pts = [pt for tr in traces for pt in tr]
            xs = [pt[0] for pt in all_pts]
            ys = [pt[1] for pt in all_pts]
            w = max(xs) - min(xs)
            h = max(ys) - min(ys)
            if w < 5 or h < 5:
                continue

            sample_id = pathlib.Path(m.name).stem
            split_name = parts[1]
            split_counts[split_name] = split_counts.get(split_name, 0) + 1
            found.append({
                'id': sample_id,
                'label': label,
                'raw_label': raw_label,
                'split': split_name,
                'traces': traces,
                'bbox': {'width': w, 'height': h},
            })

            if len(found) % 50 == 0:
                print(f'Extracted {len(found)}/{target_count} expressions (valid: {split_counts.get("valid", 0)}, test: {split_counts.get("test", 0)})...', flush=True)

            if len(found) >= target_count:
                break

    out_file = CACHE / 'mathwriting_eval_set.json'
    out_file.write_text(json.dumps(found, indent=2), encoding='utf-8')
    print(f'Successfully extracted {len(found)} expressions to {out_file} (splits: {split_counts})')
    return found


if __name__ == '__main__':
    extract_eval_expressions(350)
