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

The legacy symbol recipe below predates the MathWriting line model. Its digits are trained on MNIST and the 30 writers of
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

## Line-level CTC recognizer

The primary sequence candidate reads a complete row without `groupSymbols`.
`lineFeatures.ts` arc-length samples each stroke independently and emits six
features: height-normalized x/y, dx/dy and stroke-start/end flags. A stride-2
width-5 convolution (48 channels) feeds two bidirectional GRUs (64 units per
direction), then a CTC head. The 131,112 float32 parameters are base64-encoded
inside JSON (about 701 kB). Inference is pure TypeScript, with no new browser
dependencies or network calls. `ctc.ts` implements greedy, prefix beam and
forced Viterbi alignment to **predicted** tokens. Alignment associates tokens
with stroke IDs and sampled-point bounding boxes; it is not ground-truth
segmentation. Connected strokes can belong to several tokens; transcript-scoped
`ctcKey` keeps their one-tap corrections distinct and invalidates them after
retokenization. Neural inputs are cached separately from context-dependent
decoding, so assignment/previous-row changes do not rerun the GRU.

The original CNN remains a comparison/fallback reader. `reader: 'ctc'` and
`reader: 'symbol'` explicitly select standalone evaluation; the default uses
CTC with a low-sequence-evidence fallback. Confident agreement preserves the
legacy reader's measured probabilities and skips unnecessary N-best work; a
more confident length-compatible legacy candidate, known unit spelling and
unsupported degree/empty-set readings can also win the comparison. This
heuristic is **not a human-calibrated ensemble** and remains a serious quality
limit; see the accepted-but-wrong row counts in ACCURACY.md. Complete CTC N-best hypotheses use
the existing syntax/task/previous-row prior, never equation correctness.
Calibration raster prototypes remain local and participate in hypothesis
reranking. The existing geometric parser must not spatially reparse an
already-linear CTC transcript when the user corrects a token.

No automatic download is performed by the line tools. Place/link the existing
`mathwriting-2024.tgz` in ignored `data-cache/`, then from repository root:

```powershell
python tools/handwriting/data_mathwriting.py
python tools/handwriting/prepare_line_eval.py
python -m unittest discover -s tools/handwriting -p test_line_data.py
python tools/handwriting/train_line.py --epochs 12 --threads 4 --limit 24000
python tools/handwriting/train_line.py --resume --flat-focus --epochs 6 --threads 4 --lr .001
npm run build -w packages/shared
node --import tsx packages/frontend/src/handwriting/eval_line_pipeline.ts calibrate
python tools/handwriting/calibrate_line.py
node --import tsx packages/frontend/src/handwriting/eval_line_pipeline.ts
npm exec -w packages/frontend -- vitest run src/handwriting
$env:PLAYWRIGHT_PORT='5430'
npm run test:e2e
```

Use the resource-limited runner required by the local project environment
around training/build/test commands. Checkpoints/history and full per-row
benchmark results go to ignored `.cache/`; only exported weights, calibration
and bounded evaluation fixtures are committed. `--resume` warm-starts the
best validation checkpoint; it starts a fresh AdamW optimizer, not an exact
interrupted-run continuation. Checkpoint selection uses 512 original valid
inks, excluding the original 319 benchmark IDs. The 1,024 calibration inks
exclude both the 319 and those 512 checkpoint-selection IDs, then split by
line-ID hash into fitting/evaluation halves. Fresh test membership is
frozen by a sample-ID hash from original test/, excluding the 319. Neither
benchmark participates in training or checkpoint selection.

The second phase uses all eligible flat training rows (at most 24 labels,
without fractions, powers or roots), with equally many seeded structured rows
as replay. This counters the source subset's strong 2-D imbalance: 40,409 of
64,515 eligible training rows contain fractions, versus 11,806 without a
fraction or power. It does not select rows by benchmark similarity or equation
truth. The best checkpoint still minimizes CER on the same original valid
selection set, not on either reported benchmark.

The label parser rejects unsupported commands/subscripts instead of dropping
them. It linearizes fractions as `(numerator)/(denominator)` and powers as
`^x` or `^(...)`; brackets, decimal punctuation, multiplication and division
spellings remain labels. Those structural tokens need not have their own
visible strokes, so chronological CTC is inherently less suitable for heavily
reordered two-dimensional math. Writer IDs are not published by MathWriting;
we preserve its original partitions rather than claim independently verified
writer identities. Model weights and derived handwriting fixtures are
**CC BY-NC-SA 4.0**, see NOTICE.md. Measured limitations are in ACCURACY.md.

**Preparation version caveat:** the exported checkpoint was trained with the
initial preparation, which mishandled indexed roots (`\sqrt[3]{x}`): 233 of its
28,086 unique training rows contain that unsupported form. The corrected parser
now rejects indexed roots; the training loader refuses stale cached labels, and
the final calibration/new512 fixtures exclude them. Re-extract before a new
training run. Current scripts intentionally do not bit-for-bit reproduce that
known label-preparation defect. A clean retraining remains required before a
release; the shipped snapshot is a measured candidate, not a successful product
acceptance result.

## Legacy symbol model

Conv 5x5x16, max-pool, Conv 3x3x32, max-pool, Dense 192, Dense `len(LABELS)`; about 169 000 parameters
(the 28x28 input follows the MNIST convention: 20x20 box, centre of mass in the middle).
Weights are float32 little-endian, base64 inside `weights.json` (about 900 kB, under the 1 MB budget).
Inference is hand-written TypeScript (`model.ts`); there is no TensorFlow, ONNX or other runtime dependency.
On a desktop CPU one 15-symbol line takes about 20 ms including stroke grouping and the parser.
