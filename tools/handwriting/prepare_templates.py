"""Extract a small, auditable subset of public-domain Hershey coordinates."""
import hashlib
import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parent
BASE = 'https://raw.githubusercontent.com/russhughes/hershey-scripts/master/hershey/'


def main():
    raw = urllib.request.urlopen(BASE + 'hersh.oc', timeout=60).read()
    text = raw.decode('ascii')
    records = re.split(r'(?m)^\s*(\d+)\s+(\d+)', text)
    glyphs = {}
    for i in range(1, len(records), 3):
        key, count, body = int(records[i]), int(records[i + 1]), records[i + 2]
        body = body.replace('\n', '').replace('\r', '')[:count * 2]
        strokes, stroke = [], []
        for j in range(2, len(body), 2):
            pair = body[j:j + 2]
            if len(pair) < 2:
                continue
            if pair[0] == ' ':
                if stroke:
                    strokes.append(stroke)
                stroke = []
            else:
                stroke.append([ord(pair[0]) - 82, ord(pair[1]) - 82])
        if stroke:
            strokes.append(stroke)
        glyphs[key] = strokes
    out = []
    letters = 'xyabcnmsgJNVAkhloWPK'
    for family, digits, upper, lower in [('simplex', 700, 501, 601), ('plain', 200, 1, 1)]:
        mapping = {str(i): digits + i for i in range(10)}
        mapping.update({c: (upper if c.isupper() else lower) + ord(c.upper()) - 65 for c in letters})
        mapping.update({'+': 725 if family == 'simplex' else 225,
                        '-': 724 if family == 'simplex' else 224,
                        '=': 726 if family == 'simplex' else 226,
                        '/': 720 if family == 'simplex' else 220,
                        '(': 721 if family == 'simplex' else 221,
                        ')': 722 if family == 'simplex' else 222,
                        '.': 710 if family == 'simplex' else 210,
                        ',': 711 if family == 'simplex' else 211,
                        '×': 727, '÷': 228, '%': 2271})
        for label, key in mapping.items():
            if family == 'plain' and label.islower():
                continue  # Plain has capitals only; do not silently mislabel them.
            out.append({'label': label, 'source': f'hershey-{family}:{key}', 'strokes': glyphs[key]})
    # Extra public-domain shapes only for the digit pairs the model confuses
    # (2/5). Other digits keep the small simplex/plain set, so their
    # decision boundaries are not disturbed. Complex (2200) and triplex (3200)
    # stay completely unseen for the generalisation measurement.
    extra = [0, 500, 600, 800, 900, 1000, 1100, 1200, 1400, 2000, 2100, 2300, 2400,
             2500, 2600, 2700, 2800, 2900, 3000, 3100, 3300, 3400, 3500, 3600, 3700, 3800, 3900]
    for base in extra:
        for digit in (2, 5):
            key = base + digit
            if key in glyphs:
                out.append({'label': str(digit), 'source': f'hershey-extra:{key}', 'strokes': glyphs[key]})
    own = {
        '+': [[[0, 10], [20, 10]], [[10, 0], [10, 20]]],
        '-': [[[0, 10], [20, 10]]],
        '=': [[[0, 6], [20, 6]], [[0, 14], [20, 14]]],
        '×': [[[0, 0], [20, 20]], [[20, 0], [0, 20]]],
        '÷': [[[0, 10], [20, 10]], [[10, 1], [10, 1]], [[10, 19], [10, 19]]],
        '/': [[[0, 20], [12, 0]]],
        'x': [[[0, 0], [3, 1], [9, 9], [15, 18], [20, 20]], [[19, 0], [16, 3], [4, 18], [0, 20]]],
        'y': [[[0, 0], [7, 12], [14, 0]], [[14, 0], [5, 23], [0, 24]]],
        '.': [[[0, 0], [0, 0]]],
        ',': [[[3, 0], [3, 3], [0, 6]]],
        ':': [[[10, 2], [10, 2]], [[10, 18], [10, 18]]],
        '·': [[[0, 0], [0, 0]]],
        '*': [[[10, 0], [10, 20]], [[1, 5], [19, 15]], [[1, 15], [19, 5]]],
        '[': [[[12, 0], [0, 0], [0, 25], [12, 25]]],
        ']': [[[0, 0], [12, 0], [12, 25], [0, 25]]],
        '{': [[[12, 0], [5, 1], [4, 5], [4, 10], [0, 13], [4, 16], [4, 22], [5, 25], [12, 26]]],
        '}': [[[0, 0], [7, 1], [8, 5], [8, 10], [12, 13], [8, 16], [8, 22], [7, 25], [0, 26]]],
        '±': [[[0, 8], [20, 8]], [[10, 0], [10, 16]], [[0, 19], [20, 19]]],
        '<': [[[20, 0], [0, 10], [20, 20]]],
        '>': [[[0, 0], [20, 10], [0, 20]]],
        '≤': [[[20, 0], [0, 8], [20, 16]], [[0, 23], [20, 23]]],
        '≥': [[[0, 0], [20, 8], [0, 16]], [[0, 23], [20, 23]]],
        '≠': [[[0, 7], [20, 7]], [[0, 15], [20, 15]], [[16, 0], [4, 22]]],
        '√': [[[0, 13], [4, 11], [9, 23], [17, 0], [38, 0]]],
        'π': [[[0, 4], [4, 0], [20, 0]], [[6, 0], [5, 20]], [[16, 0], [16, 18], [20, 20]]],
        '°': [[[5, 0], [1, 1], [0, 5], [1, 9], [5, 10], [9, 9], [10, 5], [9, 1], [5, 0]]],
        '∅': [[[10, 0], [3, 2], [0, 10], [3, 18], [10, 20], [17, 18], [20, 10], [17, 2], [10, 0]], [[20, 0], [0, 20]]],
    }
    for label, strokes in own.items():
        out.append({'label': label, 'source': 'own', 'strokes': strokes})
    # Baseline dots are resolved spatially in the recognizer. Do not mislabel
    # identical isolated dots as commas; teach the actual tails and hooks here.
    for name, strokes in {
        'comma-slash': [[[3, 0], [0, 8]]],
        'comma-hook': [[[1, 0], [3, 2], [3, 4], [0, 7]]],
        'comma-short-tail': [[[2, 0], [2, 2], [1, 4]]],
    }.items():
        # A straight tail has the same normalized raster as / or 1. It belongs
        # to spatial regression fixtures, not a contradictory isolated class.
        out.append({'label': ',', 'source': 'punctuation:' + name, 'strokes': strokes,
                    'geometryOnly': name != 'comma-hook'})
    variants = {
        'one-hook': ('1', [[[0, 6], [8, 0], [8, 24]]]),
        'one-top-bar': ('1', [[[0, 5], [8, 0], [8, 24]], [[2, 0], [13, 0]]]),
        'seven-crossbar': ('7', [[[0, 0], [20, 0], [5, 25]], [[3, 13], [16, 13]]]),
        'four-open': ('4', [[[12, 0], [0, 16], [20, 16]], [[14, 4], [14, 25]]]),
        'four-closed': ('4', [[[15, 25], [15, 0], [0, 16], [21, 16]]]),
        'nine-european': ('9', [[[16, 11], [14, 2], [7, 0], [0, 4], [0, 11], [7, 15], [15, 11], [16, 0], [15, 20], [9, 26]]]),
        'round-angular-left': ('(', [[[12, 0], [0, 12], [12, 25]]]),
        'round-angular-right': (')', [[[0, 0], [12, 12], [0, 25]]]),
        'equals-one-stroke': ('=', [[[0, 4], [20, 4], [20, 14], [0, 14]]]),
        'minus-long': ('-', [[[0, 10], [40, 10]]]),
    }
    for name, (label, strokes) in variants.items():
        out.append({'label': label, 'source': 'variant:' + name, 'strokes': strokes})
    # Held-out glyph families that are NEVER used for training: serif ("complex") and
    # triplex-style Hershey numerals (operator code points differ per font, so digits only), used only to measure generalisation.
    heldout = []
    for family, base in [('complex', 2200), ('triplex', 3200)]:
        mapping = {str(i): base + i for i in range(10)}
        for label, key in mapping.items():
            if key in glyphs:
                heldout.append({'label': label, 'source': f'heldout-{family}:{key}', 'strokes': glyphs[key]})
    (ROOT / 'heldout.json').write_text(json.dumps(heldout, separators=(',', ':')), encoding='utf-8')
    (ROOT / 'templates.json').write_text(json.dumps(out, separators=(',', ':')), encoding='utf-8')
    for name in ['README', 'COPYING']:
        try:
            data = urllib.request.urlopen(BASE + name, timeout=30).read()
            (ROOT / ('HERSHEY-' + name + '.txt')).write_bytes(data)
        except urllib.error.HTTPError:
            if name == 'README':
                raise
    print('hersh.oc sha256', hashlib.sha256(raw).hexdigest(), 'templates', len(out))


if __name__ == '__main__':
    main()
