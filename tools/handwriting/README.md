# Handwriting model: training and evaluation

Trains the tiny CNN that `packages/frontend/src/handwriting/` runs in the browser. It runs on CPU only,
needs no GPU, and is deterministic for a given seed and torch version. Measured accuracies and the
experiments that did not work are in [`ACCURACY.md`](ACCURACY.md).

## Data and licences

| Data | Used for | Source | Licence |
|---|---|---|---|
| MNIST handwritten digits (train split only, first 55 000 images) | digits 0-9 | Y. LeCun, C. Cortes, C. Burges. Downloaded from `https://storage.googleapis.com/cvdf-datasets/mnist/` with MD5 verification | MNIST has no formal licence text of its own; the widely used copies (Hugging Face, TensorFlow Datasets) list it as CC BY-SA 3.0. It is cited here and in `NOTICE.md`. |
| UCI `pendigits` (F. Alimoglu, E. Alpaydin) | real online pen trajectories for digits 0-9, 30 training and 14 unseen test writers | `https://archive.ics.uci.edu/ml/machine-learning-databases/pendigits/`, downloaded by `pendigits.py` with SHA-256 verification | CC BY 4.0 |
| Hershey vector fonts (`hersh.oc`, USENET distribution by Dr. A. V. Hershey, NBS) | stroke templates for digits, letters, operators and brackets | `https://github.com/russhughes/hershey-scripts` (`hersh.oc`, SHA-256 in `prepare_templates.py` output) | Public domain, see `HERSHEY-README.txt` |
| Own hand-written stroke templates in `prepare_templates.py` (`own` and `variants`) | `x ÷ [ ] { } ± < > ≤ ≥ ≠ √ π ° ∅ :` and the Czech/European digit shapes | written for this project | same as the project (PolyForm Noncommercial 1.0.0) |

No commercial or restrictively licensed dataset is used. Digits are trained on MNIST and the 30 writers of
the `pendigits` training split, plus the Hershey templates. No public, permissively licensed set of
handwritten mathematical symbols (for example CROHME) was found that allows this use, so operators and
letters are synthetic: the templates above, then a random augmentation (affine, shear, per-point jitter,
wavy baseline, irregular sampling, variable pen width) in `data.py`. Real pen trajectories get a stronger
variant (up to 15 degrees of tilt, end overshoots, 2-3 px pen at 28x28) from `augment_pen`.

The official MNIST **test** split (10 000 images) is never opened by `train.py`. It is only used to measure
the final model; a copy lives in `packages/frontend/src/handwriting/__fixtures__/` so the test runs offline.
The 14 `pendigits.tes` writers are likewise never used for training. Their raw trajectories are copied to
`pendigits.json` and rasterized in TypeScript, so the test covers the real `rasterizeSymbol` +
`classifyRaster` path. Hershey families that are not used for training (`heldout.json`: serif "complex" and
"triplex" digits) measure generalisation to unseen letter shapes.

## Reproduce

```bash
cd tools/handwriting
python -m pip install --user -r requirements.txt   # CPU torch: --index-url https://download.pytorch.org/whl/cpu
python prepare_templates.py     # downloads hersh.oc, writes templates.json + heldout.json (only needed to change templates)
python train.py                 # ~7 min on 12 CPU threads: downloads MNIST and pendigits into .cache/,
                                # writes ../../packages/frontend/src/handwriting/model/weights.json
python prepare_evaluation.py    # copies the MNIST test split, writes parity.json + pendigits.json
cd ../../packages/frontend && npx vitest run src/handwriting
```

`train.py` options: `--epochs 32`, `--synthetic-per-class 1400`, `--pendigits-variants 6`, `--threads 12`,
`--seed 20261106`. The first run rasterizes 6 augmented variants of each real pen trajectory and caches them
in `.cache/` (gitignored). Re-run `prepare_evaluation.py` after every retraining, otherwise `model.test.ts`
fails on stale parity or pendigits fixtures.

Punctuation training also accepts `--punctuation-multiplier 4`, `--comma-weight 3` and
`--learning-rate .0018`. The multiplier increases comma, dot and middle-dot samples (the last two
must stay balanced: an isolated pen tap has no baseline). The comma loss weight emphasizes confusing
curved commas without removing any digit/letter replay. Warm-start with `--init` and a smaller learning
rate when preserving an existing model. See `ACCURACY.md` for the exact measured recipe and init commit.
`--retention-weight 2` optionally distills the warm-start model at temperature 2 on augmented training
replay with ground-truth labels in `--retention-labels '0ox×()l'`. It requires an init with identical
labels, anchors the vulnerable digit/letter boundaries without freezing all digit adaptation, and
never consults evaluation samples or expected answers. `--output PATH` writes a candidate separately
from the app's weights (useful while browser tests are running).

Comma validation uses 500 fresh augmented curves, a separate seed and the training templates only.
Checkpoint selection requires at least 98% on these curves, then maximizes the existing equally weighted
MNIST/pendigits validation score. If no checkpoint qualifies, training fails without replacing weights.
No official test images, independent test writers, held-out fonts, TypeScript test seeds or course
answers participate in training or checkpoint selection.

Templates marked `geometryOnly` are intentionally excluded from isolated classification: a straight
comma tail normalizes to the same image as a slash/one. Those shapes, and dots, are tested in actual
rows at multiple scales with deliberately incorrect classifier predictions. The recognizer checks
their original size, baseline and digit neighbours; a compact tap/closed dot keeps `.`, a visible tail
keeps `,`. Multiplication dots are distinguished by their raised position, not by solving the equation.

## Model

Conv 5x5x16, max-pool, Conv 3x3x32, max-pool, Dense 192, Dense `len(LABELS)`; about 169 000 parameters
(the 28x28 input follows the MNIST convention: 20x20 box, centre of mass in the middle).
Weights are float32 little-endian, base64 inside `weights.json` (about 900 kB, under the 1 MB budget).
Inference is hand-written TypeScript (`model.ts`); there is no TensorFlow, ONNX or other runtime dependency.
On a desktop CPU one 15-symbol line takes about 20 ms including stroke grouping and the parser.
