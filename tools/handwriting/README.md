# Handwriting model: training and evaluation

Trains the tiny CNN that `packages/frontend/src/handwriting/` runs in the browser. It runs on CPU only,
needs no GPU, and is deterministic for a given seed and torch version.

## Data and licences

| Data | Used for | Source | Licence |
|---|---|---|---|
| MNIST handwritten digits (train split only, first 55 000 images) | digits 0-9 | Y. LeCun, C. Cortes, C. Burges. Downloaded from `https://storage.googleapis.com/cvdf-datasets/mnist/` with MD5 verification | MNIST has no formal licence text of its own; the widely used copies (Hugging Face, TensorFlow Datasets) list it as CC BY-SA 3.0. It is cited here and in `NOTICE.md`. |
| Hershey vector fonts (`hersh.oc`, USENET distribution by Dr. A. V. Hershey, NBS) | stroke templates for digits, letters, operators and brackets | `https://github.com/russhughes/hershey-scripts` (`hersh.oc`, SHA-256 in `prepare_templates.py` output) | Public domain, see `HERSHEY-README.txt` |
| Own hand-written stroke templates in `prepare_templates.py` (`own` and `variants`) | `x ÷ [ ] { } ± < > ≤ ≥ ≠ √ π ° ∅ :` and the Czech/European digit shapes | written for this project | same as the project (PolyForm Noncommercial 1.0.0) |

No commercial or restrictively licensed dataset is used. No public, permissively licensed set of handwritten
mathematical symbols (for example CROHME) was found that allows this use, so everything except the digits is
synthetic: the templates above, then a strong random augmentation (affine, shear, per-point jitter, wavy
baseline, irregular sampling, variable pen width) in `data.py`.

The official MNIST **test** split (10 000 images) is never opened by `train.py`. It is only used to measure
the final model; a copy lives in `packages/frontend/src/handwriting/__fixtures__/` so the test runs offline.
Hershey families that are not used for training (`heldout.json`: serif "complex" and "triplex" digits)
measure generalisation to unseen letter shapes.

## Reproduce

```bash
cd tools/handwriting
python -m pip install --user -r requirements.txt   # CPU torch: --index-url https://download.pytorch.org/whl/cpu
python prepare_templates.py     # downloads hersh.oc, writes templates.json + heldout.json (only needed to change templates)
python train.py                 # ~30 min on 4 CPU threads: downloads MNIST into .cache/, writes ../../packages/frontend/src/handwriting/model/weights.json
python prepare_evaluation.py    # copies the MNIST test split + writes parity.json (Python vs TypeScript inference check)
cd ../../packages/frontend && npx vitest run src/handwriting
```

`train.py` options: `--epochs 24`, `--synthetic-per-class 1400`, `--threads 4`, `--seed 20261106`.
Re-run `prepare_evaluation.py` after every retraining, otherwise `model.test.ts` fails on stale parity data.

## Model

Conv 5x5x8, max-pool, Conv 3x3x16, max-pool, Dense 64, Dense `len(LABELS)`; about 40 000 parameters
(the 28x28 input follows the MNIST convention: 20x20 box, centre of mass in the middle).
Weights are float32 little-endian, base64 inside `weights.json` (about 160 kB). Inference is hand-written
TypeScript (`model.ts`); there is no TensorFlow, ONNX or other runtime dependency.
