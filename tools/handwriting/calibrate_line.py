"""Calibrate emitted-token correctness, splitting by LINE, not correlated frames.

Input is collected using the actual TS N-best decoder and forced alignment.
Deletion errors have no emitted-token confidence; report their count separately.
"""
import hashlib
import json
from data_mathwriting import ROOT


def bins(rows, predict=lambda p: p):
    result = []
    for i in range(15):
        group = [r for r in rows if min(14, int(predict(r['confidence']) * 15)) == i]
        result.append({'from': i / 15, 'to': (i + 1) / 15, 'count': len(group),
            'accuracy': sum(r['correct'] for r in group) / max(1, len(group)),
            'confidence': sum(predict(r['confidence']) for r in group) / max(1, len(group))})
    return result


def ece(reliability):
    return sum(b['count'] * abs(b['accuracy'] - b['confidence']) for b in reliability) / sum(b['count'] for b in reliability)


def calibrate():
    observations = json.loads((ROOT / '.cache/line-calibration-observations.json').read_text())
    rows = observations['observations']
    is_fitting = lambda r: int(hashlib.sha256(r['id'].encode()).hexdigest()[:8], 16) % 2 == 0
    fitting = sorted([r for r in rows if is_fitting(r)], key=lambda r: r['confidence'])
    evaluation = [r for r in rows if not is_fitting(r)]
    # Equal-mass initial groups followed by pool-adjacent-violators isotonic fit.
    # Beta(1,1) smoothing avoids unmeasured certainty from a finite positive bin.
    blocks = []
    size = max(50, len(fitting) // 30)
    for offset in range(0, len(fitting), size):
        group = fitting[offset:offset + size]
        blocks.append({'upper': group[-1]['confidence'], 'count': len(group) + 2, 'correct': sum(r['correct'] for r in group) + 1})
        while len(blocks) > 1 and blocks[-2]['correct'] / blocks[-2]['count'] > blocks[-1]['correct'] / blocks[-1]['count']:
            b, a = blocks.pop(), blocks.pop()
            blocks.append({'upper': b['upper'], 'count': a['count'] + b['count'], 'correct': a['correct'] + b['correct']})
    mapping = [{'upper': b['upper'], 'probability': b['correct'] / b['count']} for b in blocks]
    mapping[-1]['upper'] = 1.

    def predict(p):
        return next(b['probability'] for b in mapping if p <= b['upper'])

    before, after = bins(evaluation), bins(evaluation, predict)
    deploy = ece(after) <= ece(before)
    config = {'version': 1, 'fitted': True, 'threshold': .98, 'mapping': mapping if deploy else [],
        'method': '30 equal-mass bins + smoothed PAVA; sample-ID hash line-disjoint half split',
        'scope': 'emitted raw transcript tokens (substitutions/insertions); deletions reported separately',
        'fittingLines': len({r['id'] for r in fitting}), 'evaluationLines': len({r['id'] for r in evaluation}),
        'fittingTokens': len(fitting), 'evaluationTokens': len(evaluation), 'deletedCharacters': observations['deleted'],
        'ece': {'before': ece(before), 'after': ece(after) if deploy else ece(before)},
        'bins': {'before': before, 'after': after if deploy else before}}
    for name, group in [('fitting', fitting), ('evaluation', evaluation)]:
        accepted = [r for r in group if (predict(r['confidence']) if deploy else r['confidence']) >= config['threshold']]
        config[name] = {'tokens': len(group), 'accepted': len(accepted), 'wrongAbove': sum(not r['correct'] for r in accepted)}
    target = (ROOT / '../../packages/frontend/src/handwriting/model/line-calibration.json').resolve()
    target.write_text(json.dumps(config, indent=2), encoding='utf-8')
    print(json.dumps({k: v for k, v in config.items() if k not in ('mapping', 'bins')}, indent=2))


if __name__ == '__main__':
    calibrate()
