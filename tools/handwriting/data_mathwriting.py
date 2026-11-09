"""Strict line labels and deterministic train-only extraction. Never downloads data.

MathWriting, Google LLC, CC BY-NC-SA 4.0. No writer IDs are published;
the original split is the only available writer-disjointness guarantee.
"""
import argparse
import collections
import json
import re
import tarfile
import xml.etree.ElementTree as ET
from pathlib import Path

from real_data import parse_inkml_traces

ROOT = Path(__file__).resolve().parent
LABELS = [''] + list('0123456789+-=×·÷:/.,()[]abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ^%<>≤≥≠±√π°')
COMMANDS = {
    'times': '×', 'cdot': '·', 'div': '÷', 'le': '≤', 'leq': '≤',
    'ge': '≥', 'geq': '≥', 'ne': '≠', 'neq': '≠', 'pm': '±',
    'pi': 'π', 'degree': '°', '%': '%', '{': '(', '}': ')',
}


def linear_label(latex):
    """Parse the supported LaTeX subset; reject unknown syntax, never strip it.

    Groups are transparent except explicit scalable delimiters, fractions and
    multi-character powers. Subscripts/matrices/functions are deliberately OOD.
    """
    tokens = re.findall(r'\\[a-zA-Z]+|\\.|[^\s]', latex)
    pos = 0

    def sequence(group=False):
        nonlocal pos
        out = ''
        while pos < len(tokens):
            token = tokens[pos]
            pos += 1
            if token == '}':
                if not group:
                    raise ValueError('unbalanced group')
                return out
            if token == '{':
                out += sequence(True)
            elif token == '^':
                arg = argument()
                out += '^' + (arg if len(arg) == 1 else '(' + arg + ')')
            elif token in ('\\frac', '\\dfrac', '\\tfrac'):
                numerator, denominator = argument(), argument()
                out += '(' + numerator + ')/(' + denominator + ')'
            elif token == '\\sqrt':
                out += '√(' + argument() + ')'
            elif token in ('\\mathrm', '\\mathit', '\\mathbf', '\\mathnormal'):
                out += argument()
            elif token in ('\\left', '\\right', '\\!', '\\,', '\\;', '\\quad', '\\qquad', '\\ '):
                continue
            elif token.startswith('\\'):
                out += COMMANDS[token[1:]]
            elif token == '*':
                out += '×'
            elif token in LABELS[1:]:
                out += token
            else:
                raise ValueError('unsupported token: ' + token)
        if group:
            raise ValueError('unclosed group')
        return out

    def argument():
        nonlocal pos
        if pos >= len(tokens):
            raise ValueError('missing argument')
        token = tokens[pos]
        pos += 1
        if token == '{':
            return sequence(True)
        if token.startswith('\\'):
            return COMMANDS[token[1:]]
        if token not in LABELS[1:]:
            raise ValueError('bad argument')
        return token

    try:
        return sequence()
    except (KeyError, ValueError):
        return None


def extract(archive, output):
    output.mkdir(parents=True, exist_ok=True)
    counts = collections.Counter()
    files = {split: (output / f'{split}.jsonl').open('w', encoding='utf-8') for split in ('train', 'valid', 'test')}
    ns = {'i': 'http://www.w3.org/2003/InkML'}
    try:
        with tarfile.open(archive, 'r|gz') as tar:
            for member in tar:
                parts = member.name.split('/')
                if len(parts) != 3 or parts[1] not in files or not member.name.endswith('.inkml'):
                    continue
                if member.size > 2 * 1024 * 1024:
                    raise ValueError('Oversized InkML member')
                content = tar.extractfile(member).read()
                if b'<!DOCTYPE' in content or b'<!ENTITY' in content:
                    raise ValueError('DTD/entity declarations are not supported')
                root = ET.fromstring(content)
                anns = {a.get('type'): a.text for a in root.findall('i:annotation', ns)}
                if anns.get('inkCreationMethod', 'human') != 'human':
                    continue
                raw = anns.get('normalizedLabel') or anns.get('label') or ''
                label = linear_label(raw)
                if not label or not 1 <= len(label) <= 40:
                    counts['rejected'] += 1
                    continue
                traces = parse_inkml_traces(content)
                if not traces or sum(map(len, traces)) > 12000:
                    continue
                sample = {'id': Path(member.name).stem, 'split': parts[1], 'label': label, 'raw_label': raw, 'traces': traces}
                files[parts[1]].write(json.dumps(sample, ensure_ascii=False, separators=(',', ':')) + '\n')
                counts[parts[1]] += 1
                if sum(counts.values()) % 10000 == 0:
                    print(dict(counts), flush=True)
    finally:
        for handle in files.values():
            handle.close()
    (output / 'manifest.json').write_text(json.dumps({'counts': dict(counts), 'labels': LABELS, 'archive': archive.name,
        'source': 'Google MathWriting 2024', 'license': 'CC BY-NC-SA-4.0',
        'split_policy': 'Original human train/valid/test; writer IDs not published.'}, indent=2), encoding='utf-8')
    print(dict(counts), flush=True)


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--archive', type=Path, default=ROOT / 'data-cache/mathwriting-2024.tgz')
    parser.add_argument('--output', type=Path, default=ROOT / 'data-cache/lines')
    args = parser.parse_args()
    extract(args.archive, args.output)
