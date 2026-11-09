"""Freeze test/calibration manifests independently of training and its checkpoint.

Test membership is a hash of sample ID, excluding the original 319-row corpus.
All test inks are from original test/; no inferred writer identities.
"""
import hashlib
import json
from data_mathwriting import ROOT

FIXTURES = (ROOT / '../../packages/frontend/src/handwriting/__fixtures__').resolve()


def prepare():
    original = json.loads((FIXTURES / 'mathwriting-eval.json').read_text(encoding='utf-8'))
    excluded = {s['id'] for s in original}
    for split, name, count in [('test', 'line-heldout.json', 512), ('valid', 'line-calibration.json', 1024)]:
        samples = [json.loads(line) for line in (ROOT / f'data-cache/lines/{split}.jsonl').open(encoding='utf-8')]
        samples = [s for s in samples if s['id'] not in excluded]
        samples.sort(key=lambda s: hashlib.sha256(('line-eval-v1:' + s['id']).encode()).hexdigest())
        selected = samples[:count]
        target = FIXTURES / name if split == 'test' else ROOT / 'data-cache/line-calibration.json'
        target.write_text(json.dumps(selected, ensure_ascii=False, separators=(',', ':')), encoding='utf-8')
        print(name, len(selected), target, flush=True)


if __name__ == '__main__':
    prepare()
