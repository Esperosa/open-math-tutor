# Handwriting accuracy

Measured on the exported model in `packages/frontend/src/handwriting/model/weights.json`.
Everything below is produced by `npx vitest run src/handwriting` (the test records the numbers);
none of these samples are used for training.

Environment: Windows, Intel64 CPU, Python 3.10.11, PyTorch 2.7.1+cpu, NumPy 2.2.6, seed 20261106.
The exported checkpoint is epoch 28 of 32 (best combined validation score, 0.9881). It has 58 labels:
the original 51 plus `k`, `h`, `l`, `o`, `W`, `P`, `K` for physics and chemistry units.

| Test | Samples | Accuracy | Target | Result |
|---|---:|---:|---:|---|
| MNIST test split | 10 000 | **99.13 %** | ≥ 97 % | pass |
| UCI `pendigits`, 14 unseen writers | 3 498 | **96.51 %** | ≥ 95 % | pass |
| Unseen Hershey fonts (complex + triplex digits) | 1 200 | **95.67 %** | ≥ 85 % | pass |
| Printed rows, training font families | 270 | **99.63 %** | ≥ 95 % | pass |
| Printed rows with held-out digit bodies | 200 | **90.00 %** | ≥ 90 % | pass |
| Synthetic digits + operators | 1 440 | **99.38 %** | ≥ 92 % | pass |
| All synthetic symbols (58 labels) | 4 640 | **98.92 %** | — | — |
| Catalog auto-check templates (23 skills) | 69 | **100.00 %** | ≥ 90 % | pass |
| Line inference, 15 symbols | 40 runs | median **14.2 ms**, p95 **19.7 ms** | < 50 ms | pass |

Model size: 907 823 bytes (target < 1 MB), about 170 000 float32 parameters.

## What the remaining errors look like

- `pendigits`: 122 wrong of 3 498. The largest pairs are 2→5 (27), 7→1 (9), 1→5 (8), 7→3 (7),
  1→2 (7), 9→2 (5), 8→5 (5), 9→7 (5), 9→3 (5), 1→7 (4), 6→5 (4), 9→4 (3), 2→1 (3), 8→2 (3).
- Held-out Hershey fonts: 52 wrong of 1 200. Complex is 593/600 (4→8 twice, 8→2 five times); triplex is
  555/600, mostly 8→2 (32) and 4→8 (8), plus 6→2 (3) and 4→7 (2). The new unit letters were trained on
  simplex templates and do not affect these digit-only fonts.
- Held-out rows: 20 wrong of 200. In `3*4=12` five `3`s become `8`; in `(2+3)*4=20` five `2`s become `8`;
  five commas in `7:2=3,5` become `b`, `.` or `8`; one `7` in `12+7=19` becomes `1`.
- Printed rows: 1 wrong of 270. One `1` becomes `l` in `1/2+1/3`. A `0`→`o` misread can
  still appear in the raw classifier, but `normalizeExpression` repairs it beside digits so it
  does not reach the checker.
- Synthetic operators: `x`→`×` (34), `,`→`9` (7), `×`→`x` (5), `0`→`o` (3), `/`→`1` (1). The confusion is
  between visually similar glyphs, not a collapsed class.

## What did not work

- Baseline 8/16-channel, 64-unit head (committed as `8aae2b4`): rows 91 %, pendigits 25.6 %.
- Widening to 16/32 channels and a 192-unit head fixed capacity, but with the original data the held-out
  rows stayed at 78 % because `2` was read as `5`.
- Fine-tuning only the dense head (`--init` + frozen convolutions) destroyed the printed accuracy
  (rows 28.5 %); the shape features have to move together with the head.
- Adding every extra Hershey digit font caused 3→8 and dropped rows to 59.5 %.
- Strong affine augmentation on the printed templates caused 2→5 and dropped rows to 47.5 %; real pen
  trajectories need the strong variant, printed templates do not.
- Two `pendigits` variants per sample reached 93.4 % on writers but only 78.5 % on held-out rows.
- Adding extra `2`, `5`, `7` **and** `9` templates fixed 2→5 but introduced 1→9 (rows 86.5 %). Keeping
  only the extra `2` and `5` templates is the recipe that reached 91 %.
- Training the 58-label model from scratch for 32 epochs underfit the seven new letters: validation reached
  0.9902, but printed rows fell to 88.9 % and rows with held-out digits to 73 %. Warm-starting from the
  51-label checkpoint with `--init` (28 epochs, validation 0.9881) kept every existing metric above target.

## Reproduce

```bash
cd tools/handwriting
python prepare_templates.py
# Warm start from the previous 51-label checkpoint (git HEAD before the unit labels).
git show HEAD:packages/frontend/src/handwriting/model/weights.json > model-old.json
python train.py --epochs 32 --synthetic-per-class 1400 --pendigits-variants 6 --threads 12 --init model-old.json
python prepare_evaluation.py
cd ../../packages/frontend && npx vitest run src/handwriting
```

`pendigits.py` downloads `pendigits.tra`, `pendigits.tes` and `pendigits.names` into `.cache/` and verifies
their SHA-256. Licence and citation are in `NOTICE.md` and the module docstring (CC BY 4.0).
