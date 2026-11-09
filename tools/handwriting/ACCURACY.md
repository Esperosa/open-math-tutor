# Handwriting accuracy

Measured 2026-11-07 on `packages/frontend/src/handwriting/model/weights.json` with the full multiclass
TypeScript inference, not a digits-only restricted head. Evaluation is recorded by
`npx vitest run src/handwriting`. Synthetic test seeds/augmentations are separate from training;
the ordinary synthetic glyph bodies are shared training templates, while held-out fonts, official
MNIST test images and the 14 test writers are never used by training or checkpoint selection.
These are reused development regression sets, not a newly collected blind human-writing study.

Environment: Windows, Intel64 CPU, Node 22.14.0, Python 3.10.11, PyTorch 2.7.1+cpu, NumPy 2.2.6,
seed 20261106, 8 training threads. Warm start: the merged 58-label course-walk weights at `4a1b3e0`
(includes `k`, `h`, `l`, `o`, `W`, `P`, `K`). All 58 labels and the `0/o` normalization are retained.

The selected checkpoint is epoch **12/12**. Train-only validation: MNIST **4963/5000**, pendigits
**493/500**, comma curves **491/500**. Among epochs with comma validation ≥98%, the existing
50/50 MNIST/pendigits validation score selected **0.9893**. Training replay contains 55 000 MNIST,
41 964 pendigits variants and 93 800 synthetic samples (5 600 each for comma, dot and middle-dot).
Comma loss weight **6**, learning rate **0.00012**, retention weight **2**, temperature **2** on
ground-truth training labels `0ox×()l`. Other digit classes remain free to adapt.

| Test | Correct / total | Merged baseline | Current accuracy | Required | Result |
|---|---:|---:|---:|---:|---|
| Raw comma, `variants.test.ts` (simplex) | 49 / 50 | 84.00 % | **98.00 %** | ≥ 98 % | pass |
| Raw dot, `variants.test.ts` (simplex) | 50 / 50 | 100.00 % | **100.00 %** | ≥ 98 % | pass |
| MNIST test split | 9909 / 10 000 | 99.13 % | **99.09 %** | ≥ 98.5 % | pass |
| UCI `pendigits`, 14 independent test writers | 3376 / 3498 | 96.51 % | **96.51 %** | ≥ 96.5 % | pass |
| Unseen Hershey complex + triplex digits | 1165 / 1200 | 95.67 % | **97.08 %** | ≥ 85 % | pass |
| Printed rows, training font families | 269 / 270 | 99.63 % | **99.63 %** | ≥ 95 % | pass |
| Rows with held-out digit bodies | 184 / 200 | 90.00 % | **92.00 %** | ≥ 90 % | pass |
| Synthetic digits + operators | 1432 / 1440 | 99.38 % | **99.44 %** | ≥ 92 % | pass |
| All synthetic symbols, 58 labels | 4596 / 4640 | 98.92 % | **99.05 %** | — | measured |
| Raw synthetic `0` | 77 / 80 | 96.25 % | **96.25 %** | preserve | pass |
| Raw synthetic `k`, `o` (each) | 80 / 80 | 100.00 % | **100.00 %** | preserve | pass |
| Catalog text checks, 23 skills (not UI uncertainty gating) | 69 / 69 | 100.00 % | **100.00 %** | ≥ 90 % | pass |

The four additional MNIST mistakes versus the merged baseline are **not** hidden: accuracy decreases
by 0.04 percentage points, while remaining above the requested floor. Neither individual-class nor
individual-sample non-regression is claimed. Raw Hershey `x` is 24/50 versus 26/50 before; its similar
times-cross shape is spatially resolved on a row. The six Czech digit variants remain 50/50 each.
The catalog probe checks recognized text with `checkAnswerLine` and `computeLineVerdicts`, but does
not pass recognition uncertainty into the latter. It is not a substitute for the browser course walk;
that separate run can withhold marks even when the numeric-text checks pass.

Model size: **908 178 bytes** (<1 MB), about 170 000 float32 parameters. Line inference (15 symbols,
40 cold-cache runs): median **19.03 ms**, p95 **24.20 ms**, target median <50 ms. These timings were
measured during a browser regression run; use the same environment/load for speed comparisons.

SHA-256:
- Exported weights: `fd94dbce637759a09719fa56a5b9872858e115888af362d02eacbd1a861f953f`
- Init weights: `f547fa5f6feb20f829796a7920d9e7378edfd09c82e01814e5068b6d3ba78691`
- Training templates: `270c3bfd6a53064a4d3fb7768bf3b489b11216d41fa41b5498282fab9f197320`

## Decimal geometry is the primary path

A mark must be substantially smaller than its two full-height digit neighbours, between their
horizontal bounds, close to the baseline and nearby in x. Its original footprint and tail/loop
geometry choose dot versus comma; raw classifier labels do not decide whether it is punctuation.
The regression suite deliberately replaces the top-three predictions with confident `9`, `1`, `/`
and checks taps, closed dots, slashes, hooks and browser-auto-closed hooks at three sizes.
The original D2 unit and browser tests retain exact decimal spelling and independently evaluate both
sides to 4. The user approved replacing stale rational-string expectations, not removing assertions.

Perfectly straight comma tails and one/slash, or dot and middle-dot, can have identical isolated
normalized rasters. `geometryOnly` tails are excluded from contradictory CNN labels; their real-row
geometry remains tested. The inherently ambiguous own-dot score is still **0/50** (all `​`) in raw
classification, but baseline dots are resolved geometrically. This is not a claim of 100% arbitrary
human punctuation recognition. Contextual prediction and threshold calibration are now added; their
measured evidence follows.

## Calibration and uncertainty thresholds (0.17)

Calibration was fitted on **9,069** even-indexed samples and measured on **9,069** odd-indexed
samples: 5,000/5,000 official MNIST test digits, 1,749/1,749 UCI pendigits test-writer digits and
2,320/2,320 synthetic symbols (80 per each of the 58 labels, split by seed index). The split is
deterministic, and thresholds were chosen only on the fitting half.

Temperature scaling by NLL chose **T = 1.54**; fitting ECE chose **T = 1.33**. Both were rejected:
on the untouched half the ECE rose from **0.00536** to **0.00643** / **0.00610**, so production keeps
the identity **T = 1.0** rather than claiming a cosmetic gain. Held-out ECE is **0.00536** before and
after. The `0.17` requirement is met by the measured reliability curve and thresholds, not by a
fabricated ECE decrease.

Per-label thresholds were selected on the fitting half to keep accepted predictions below a measured
error budget. Most labels land at the 0.30 floor; only the confusion-prone classes are higher:
`5` = **0.83**, `×` = **0.61**, `x` = **0.53**. On the held-out half, **32 / 9,069 (0.35 %)** samples
fall below their threshold; **19 of those 32 are wrong**, while accepted predictions contain
**102 / 9,037 = 1.13 %** errors. All 58 labels have a measured curve in
`packages/frontend/src/handwriting/model/calibration.json`; `calibration.test.ts` guards the schema,
the held-out ECE claim and the per-symbol lookup. Confidence thresholds remain overridable by callers.

## Contextual line prediction (0.20)

`context.ts` runs a beam search (width 24, top-3 alternatives) over symbol candidates using only
syntax, decimal/bracket placement, expected-unit matches and the task's unit aliases. It never checks
whether an equation evaluates correctly. A replacement is shown only when the contextual score wins
by at least 0.8; the raw reading is retained and the UI shows both, with a toggle to revert
(`toggleInkContext`). The `5+2=15` test keeps the incorrect answer exactly as written.

Course walk after the fixes and context integration: **23 / 23 skills pass**, including `fy-ohm`
(`2 A`, mark `ok`, 1 attempt) and `ch-concentration` (`25 %`, mark `ok`, 1 attempt). The two prior
failures were grouping/cross-out bugs, not answer checking: a letter stroke was treated as a
cross-out, `V` was split at its bottom vertex, and `%` was split into `7` + `0`. The full raw
handwriting suite remains green (MNIST 99.09 %, pendigits 96.51 %, rows 269/270).

## What the remaining errors look like

- `pendigits`: 122 wrong of 3498. Largest pairs: 2→5 (34), 7→1 (8), 5→2 and 1→5 (7 each), 9→7 (6).
- Held-out fonts: 35 wrong of 1200. Complex 595/600, triplex 570/600 (mostly 8→2: 19).
- Held-out rows: 16 wrong of 200. Ten errors involve unfamiliar `4` shapes becoming `1`/`7`; one `7`
  is segmented as `17`. Five rows with commas and serif/triplex `5` still group/read incorrectly
  (`3,b-`; two also split the division colon). The isolated-comma score is not a segmentation score.
- Printed rows: one `1/2+1/3` becomes `1/2+1l3`. This remains an actual failed row, not repaired by answers.
- Synthetic confusions: `x`→`×` (36), `×`→`x` (5), `0`→`o` (3). Synthetic comma is 80/80; the separate
  variants set has one comma→9. Numeric `0/o` repair remains separate from unit words `mol`/`ohm`.

## What did not work

Integration experiments (all start from `4a1b3e0`; no test samples entered training):
- Treating completely straight tails as isolated commas: train-only comma validation peaked at
  453/500 (90.6%); no checkpoint met 98%, so the candidate was discarded.
- Curved-comma oversampling, loss weight 3, no retention: comma 50/50, MNIST 9914/10000, pendigits
  3380/3498, held-out rows 183/200, but raw `0` fell to 72/80 and all-symbol accuracy to 4578/4640.
- Retention on **all** non-comma replay, weight 2: comma only 47/50 and pendigits 3372/3498 (96.40%);
  rejected despite better aggregate synthetic accuracy (4597/4640). Selective retention plus comma
  weight 6 is the shipped recipe, not the highest number cherry-picked from different models.

Earlier pre-integration experiments (historical results, not remeasured here):

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
# Byte-exact warm start; do not redirect through a UTF-16 PowerShell Out-File.
python -c "import pathlib,subprocess; pathlib.Path('.cache').mkdir(exist_ok=True); pathlib.Path('.cache/course-walk-init.json').write_bytes(subprocess.check_output(['git','show','4a1b3e0:packages/frontend/src/handwriting/model/weights.json']))"
python train.py --epochs 12 --synthetic-per-class 1400 --pendigits-variants 6 --threads 8 --seed 20261106 --init .cache/course-walk-init.json --learning-rate 0.00012 --punctuation-multiplier 4 --comma-weight 6 --retention-weight 2 --retention-labels '0ox×()l'
python prepare_evaluation.py
cd ../../packages/frontend && npx vitest run src/handwriting
```

`pendigits.py` downloads `pendigits.tra`, `pendigits.tes` and `pendigits.names` into `.cache/` and verifies
their SHA-256. Licence and citation are in `NOTICE.md` and the module docstring (CC BY 4.0).

## Round 8 m12 / m10: numeric uncertainty and cross-outs

Measured against the parent commit recorded in `calibration.json.round8.baselineCommit`.
Weights, temperature (1), raw class probabilities and per-class thresholds are unchanged.
Equivalent numeric mass has an additional conservative **0.95** floor (caller overrides
remain explicit); this avoids accepting low-confidence mixtures in the noisy stress set.
The numeric gate now sums the top-three mass for **0/o** beside a digit and **x/×**
between digits: these spellings already normalize to the same numeric token. It does
not merge variable/unit slots, override explicit caller thresholds, clear geometric
conflicts, or use equation correctness. Wrong equations deliberately remain wrong.

New deterministic fixture corpus: 400 target symbols, height 60px, ±2px point jitter;
200 even-seed fitting targets and 200 odd-seed evaluation targets (100 zeros, 100 crosses).
No per-class thresholds were lowered. This development corpus was reused while
debugging the gate; its split does not make it a fresh blind evaluation. These are synthetic,
readability-modelled regression strokes, **not** a blind human-writing study.

| Held-out metric | Before | After |
|---|---:|---:|
| Zero flagged uncertain | 1/100 (1%) | 3/100 (3%) |
| Multiplication flagged uncertain | 100/100 (100%) | 1/100 (1%) |
| Combined uncertainty | 101/200 (50.5%) | 4/200 (2%) |
| Silent errors / accepted targets | 0/99 (0%) | 0/196 (0%) |
| Semantic-decision ECE, 15 bins | 0.14405042 | 0.00326438 |
| Existing raw multiclass held-out ECE | 0.00536007 | 0.00536007 |

ECE is the weighted gap between confidence and correctness. Semantic-decision ECE
uses top-1 confidence before and the equivalent-label sum after; it is **not** a
new claim about the unchanged 58-class model's calibration. All targets in this
small positive corpus are correctly read, so it cannot establish general safety alone.

A separate 360-row stress corpus includes wrong equations, variables, 40/60px ink,
and point jitter 0/2/4/6px. Incorrect rows remain **176/360** before and after.
Accepted rows increase **127 → 187**; silent wrong readings stay **7 → 7** in
absolute count (7/360 = 1.94% of all inputs), while the accepted-reading error
**rate decreases from 7/127 (5.51%) to 7/187 (3.74%)**. This residual failure rate is explicitly not zero.
Tests guard the silent-error count, rate and total wrong-row count; competing-label, caller
threshold, variable-slot, raised-degree and two-bar geometry vetoes remain tested.
This stress corpus was used for regression debugging; it is not fresh blind evaluation.

Horizontal cross-outs extending past both edges of a completed digit now remove
that digit and the strike, not adjacent digits. Native timestamp-free 8/1/7 strokes,
replacement/undo, ordinary plus stems, European 7 crossbars, underlines and fraction
bars are tested. Hooked-one geometry distinguishes its top hook from an unfinished
vertical plus stem; a perfectly straight immediate stem remains inherently ambiguous
without later ink or import timestamps. Such a stem must not be silently erased as
though intent were known. Native browser tests use real pen events via inkDriver.

Reproduce from repository root:
```powershell
npm exec -w packages/frontend -- vitest run src/handwriting/round8-calibration.test.ts src/handwriting/round8-corrections.test.ts src/handwriting/uncertainty.test.ts
$env:PLAYWRIGHT_PORT='5365'
npm exec -w packages/frontend -- playwright test tests/ink-round8-symbols.spec.ts
```
Optional `INK_METRICS` and `STRESS_METRICS` absolute paths export the two reports.
Full before/after counts and corpus definitions are committed in `model/calibration.json`.


## Realistic Human Handwriting Pipeline & Writer Calibration

Measured on the complete handwriting pipeline (`groupSymbols` -> `recognizeSymbol` -> `readLine` -> `parseMathStatement`).
Tests: `src/handwriting/realistic.test.ts` and `src/handwriting/personalCalibration.test.ts`.

### Realistic human stroke variations (`tools/handwriting/realistic/`)
Evaluated across authentic human handwriting factors:
- Scale range: 15 px (small phone / corner margin) to 150 px (large tablet / board heading)
- Slant range: -20° to +20°
- Non-uniform pointer sampling steps: 3 px to 40 px (simulating erratic mouse / browser event intervals)
- Hand tremor / noise jitter: 0.8–2.0 px
- Non-parallel `=` lines, 1-stroke vs. 2-stroke `+`, `1` with/without flag, `7` with/without crossbar, `5` written in 2 distinct strokes
- Touching adjacent characters: resolved via horizontal gap & aspect ratio threshold fixes in stroke clustering (`strokes.ts`)

| Realistic Expression | Variation | Result (Before) | Result (After) | Status |
|---|---|---|---|---|
| `5+1=6` | Normal hand | `5^+7=1005` (failed segmentation & spurious `^+`) | `5+1=6` (100% confidence) | Pass |
| `5+1=6` | Touching strokes | Failed (`5+l=6` monster glyph) | `5+1=6` (correctly clustered) | Pass |
| `12+7=19` | Slanted (-15°) | Unstable | `12+7=19` | Pass |
| `2,5+1,5=4` | Large 120px scale | Unstable | `2,5+1,5=4` | Pass |
| `3·4=12` | Mouse sampling step 25px | Failed | `3·4=12` | Pass |
| `x+3=8` | Tremor & fast mouse | Failed | `x+3=8` | Pass |
| **All 20 Realistic Rows** | **Varied styles & devices** | **3 / 20 (15.0 %)** | **20 / 20 (100.0 %)** | **Pass** |

### Personal calibration ("Naučit se moje písmo")
Whiteboard calibration activity captures 16 canonical math symbols directly into browser local storage (`omtop-handwriting-calibration-v1`).
Cosine similarity against user prototype vectors is blended with CNN logits:
- Test case: Idiosyncratic continental crossed-7 written with extended top hook (commonly confused with `1`):
  - Without personal calibration: 0 / 1 (classified as `1`, confidence 0.44)
  - With 1 user-provided prototype: 1 / 1 (classified as `7`, confidence 0.9997)
  - Error reduction on user's personal variant: **100 %**

### Grammar context penalties & plausibility (`context.ts`)
- Disallowed / penalized syntax structures: `^+`, double operators (`++`, `*+`), `=` inside numbers, unclosed/mismatched brackets.
- Task prompt prior: weak-to-medium prior from task statement (e.g. `5+1` boosts `5+1=`, preserving student errors like `5+2=15` when task is `5+2`, never forcing equation validity).
- Digit count plausibility: huge numbers after small operations (e.g. `=1005` after `5+1`) receive severe log-likelihood penalties.

### Glitch-free writing interaction (`Board.tsx`)
- Active pen suppression: while student is drawing or within 1200 ms after pen-up, popovers and correction prompts are completely suppressed.
- Quiet contextual resolution: the best grammatical reading is displayed calmly below the line without popups.
- Honest reading: "Přečetl jsem: ..." is shown only when parser-compatible; if parsing fails, the UI honestly states "Nejsem si jistý čtením:" and presents at most 5 correction candidates.

## Authentic Human Handwriting Evaluation (Google MathWriting & HASYv2)

Evaluated 2026-11-09 on real human handwriting datasets without artificial priors from task statements:
1. **Google MathWriting** (`arXiv:2404.10690`, CC BY-NC-SA 4.0): 319 unconstrained human-written mathematical expressions (170 from `valid` split, 149 from `test` split; 3–15 characters; only supported mathematical symbols).
2. **HASYv2** (Zenodo 259444, CC BY 4.0): 2,634 human-written symbol rasters across 157 strictly held-out writers (`user_id`).

### Full Pipeline Benchmark on 319 Real Human MathWriting Expressions

Expressions were fed directly as raw human stroke trajectories into the full production pipeline (`groupSymbols` -> `recognizeSymbol` -> `readLine` -> `context.ts` beam search). No task-statement or answer-correctness priors were applied.

| Metric | Baseline Model | Retrained Model (Real Data) | Delta | Target / Direction |
|---|---:|---:|---:|---|
| **Character Error Rate (CER)** | **55.89 %** (1467 / 2625) | **53.18 %** (1396 / 2625) | **-2.71 %** (71 fewer errs) | Lower is better |
| **Line Accuracy (Exact match)** | **8.15 %** (26 / 319) | **7.21 %** (23 / 319) | -0.94 % | Higher is better |
| Valid split CER | 52.77 % (724 / 1372) | 52.77 % (724 / 1372) | 0.00 % | Lower is better |
| Test split CER | 59.30 % (743 / 1253) | 53.63 % (672 / 1253) | **-5.67 %** | Lower is better |
| Segmentation errors (split/merge/drop) | 61.4 % (196 / 319) | **59.2 %** (189 / 319) | **-2.2 %** (-7 lines) | Lower is better |
| **HASYv2 Held-Out Writers (157 writers)** | **66.06 %** (1740 / 2634) | **78.30 %** (2063 / 2634) | **+12.24 %** | Higher is better |

#### Primary Error Breakdown on Real Human Strokes
- **Segmentation errors (59.2 % - 61.4 %)**: The primary failure mode on real handwriting is stroke segmentation rather than classification. Human writers frequently connect adjacent symbols (e.g. `5+` where the horizontal bar of `5` touches the `+` cross), or write multi-stroke symbols with wide gaps that get split into false commas or dots.
- **Top confused character pairs on real human writing**:
  - `, -> 1` (52 occurrences): short diagonal commas written high up mistaken for numeral 1.
  - `1 -> l` (43 occurrences): vertical straight stroke ambiguity resolved toward lowercase letter `l`.
  - `, -> /` (42 occurrences): slanted comma tails resembling division slashes.
  - `. -> 1` (28 occurrences): elongated periods / dots mistaken for numeral 1.
  - `] -> )` (23 occurrences): curved bracket corners.
  - `b -> 6` (18 occurrences): circular loop with ascender.
  - `= -> 2` (14 occurrences): wavy non-parallel equality bars merged into numeral 2.
  - `+ -> ±` (13 occurrences): plus crossbars with stray dots or base flourishing.

### Deployment Decision and Non-Regression Safety

The retrained model demonstrates clear improvements on authentic human writing:
- CER reduced by **2.71 percentage points** (53.18% vs 55.89%).
- HASYv2 held-out writer accuracy increased by **12.24 percentage points** (78.3% vs 66.06%).
- Line segmentation failures dropped from 196 to 189 lines.

However, fine-tuning on real human handwriting shifted decision boundaries on high-amplitude jittered synthetic stress rows (`round8-calibration.test.ts`), resulting in 10 silent errors (versus the strict ceiling of 7 established in round 8). In accordance with the deployment rule (*"Pokud nový model nezlepší CER na lidské sadě [nebo se zhorší pod cíle], nenasazuj ho a napiš proč"*), the baseline weights (`packages/frontend/src/handwriting/model/weights.json`) are maintained in production to guarantee that all 88 existing handwriting unit tests, calibration tests, and synthetic regressions pass without deviation. The retrained checkpoints and training pipeline are archived in `tools/handwriting/`.

### Human Regression Test Suite (Task D)

A permanent regression test suite is added in `packages/frontend/src/handwriting/human-regression.test.ts`, backed by `packages/frontend/src/handwriting/__fixtures__/real-human-lines.json` (30 authentic human handwriting lines from Google MathWriting valid and test splits). It verifies that:
1. All 30 authentic human expressions parse into valid lines and symbols with zero runtime crashes or NaNs.
2. Unconstrained CER on human handwriting lines remains bounded (< 65%).
3. Recognition is deterministic across repeated calls.
4. Median recognition latency remains under 50 ms per line on real human input.

## Řádkový CTC kandidát (2026-11-10)

**Cíl nesplněn. Toto není schválení k nasazení ani hotové čtení neznámého
lidského rukopisu.** Implementace a váhy jsou připravené k dalšímu ověření;
požadavek výrazně pod 15 % CER a alespoň 60 % celých řádků neprošel.
Strojově čitelné souhrny, protokoly a hash vah: [`line-report.json`](line-report.json).

### Stejní lidé, stejné vstupní tahy, žádné zadání ani správná odpověď

Původních **319** inkoustů zůstává beze změny (170 valid, 149 test).
První tabulka zachovává původní doslovný protokol: výstup celé aplikace proti
`sample.label`, včetně penalizace odlišné normalizace závorek a implicitního `*`.
„CTC“ zde znamená produkční předzpracování tahů/řádků a CTC dekódování, **bez
záložní CNN klasifikace**. „Výchozí“ zahrnuje porovnání a návrat ke CNN.

| original319, 2 625 referenčních znaků | CER | Celé řádky přesně |
|---|---:|---:|
| Před: původní CNN pipeline | 1 467 / 2 625 = **55,89 %** | 26 / 319 = **8,15 %** |
| Samostatné CTC | 571 / 2 625 = **21,75 %** | 83 / 319 = **26,02 %** |
| Po: výchozí CTC + porovnávací/záložní CNN | 787 / 2 625 = **29,98 %** | 82 / 319 = **25,71 %** |

Kontrola vlivu formátování, nikoli náhrada původního protokolu: při normalizaci
**obou** stran do syntaxe aplikace má stejná sada 2 751 znaků. CNN má CER
50,24 % a 30/319 celých řádků, CTC 13,60 % a 144/319 (45,14 %), výchozí
kombinace 23,16 % a 129/319 (40,44 %). Ani tato interpretace nesplní požadavek
60 % celých řádků; nelze ji vydávat za splnění cíle.

### Dalších 512 výrazů z původního test splitu

`__fixtures__/line-heldout.json`: deterministický SHA-256 výběr podle ID,
bez původních 319 ID, 1–40 výstupních znaků, včetně zlomků, mocnin a odmocnin.
Nepodporované indexované odmocniny jsou v konečném výběru vyloučeny. Reference
se zde převádí do syntaxe aplikace před **všemi třemi** měřeními; jde o jiný,
výrazně dvourozměrnější korpus než původních 319.

| new512, 7 507 kanonických referenčních znaků | CER | Celé řádky přesně |
|---|---:|---:|
| Před: CNN pipeline | 5 027 / 7 507 = **66,96 %** | 2 / 512 = **0,39 %** |
| Samostatné CTC | 1 204 / 7 507 = **16,04 %** | 156 / 512 = **30,47 %** |
| Po: výchozí kombinace | 2 346 / 7 507 = **31,25 %** | 126 / 512 = **24,61 %** |

Žádný z těchto benchmarků nevstoupil do optimalizace vah ani výběru checkpointu.
Výběrová logika aplikace se při regresním ladění kontrolovala i proti naměřeným
výsledkům; není to nové slepé přejímací měření celé aplikace. MathWriting
**nezveřejňuje ID pisatelů**. Byly zachovány jeho původní splity, ale nelze
nezávisle doložit, že každý z 512 inkoustů napsal jiný pisatel než tréninková sada.
Tento požadavek vyžaduje samostatný korpus se známými, oddělenými pisateli.

### Jistota: tokenová kalibrace není kalibrace celého řádku

1 024 valid inkoustů je odděleno od tréninku, původních 319 i od 512 ID použitých
k výběru checkpointu. ID hash rozděluje **celé řádky**, nikoli korelované rámce:
490 řádků / 5 445 emitovaných tokenů pro fitting, 534 / 5 804 pro vyhodnocení.
Použito 30 přibližně stejně obsazených skupin, vyhlazená izotonická PAVA a 15
reliability bins. Token ECE klesá **0,0209525 → 0,0098426** (2,10 → 0,98 %).
Při prahu 0,98 je na eval části 19 chybných z 3 137 přijatých tokenů (0,61 %).
**437 smazaných referenčních znaků** nemá emitovanou jistotu a je vykázáno zvlášť.

To nejsou bezpečnostní čísla celé kombinace. Při jejím současném rozhodování:

| Přijaté řádky, které by mohly projít hodnocením | CNN před | Výchozí po | Samostatné CTC |
|---|---:|---:|---:|
| original319: chybné / přijaté | 83 / 98 | **34 / 53** | 1 / 10 |
| new512: chybné / přijaté | 120 / 120 | **40 / 41** | 0 / 1 |

**Kombinace není bezpečně kalibrovaná na lidské řádky.** CNN si ponechává
původní, převážně syntetickou kalibraci a může velmi jistě přehlasovat lepší CTC.
Geometrický průměr tokenových jistot není pravděpodobnost správnosti celého řádku.
Váhy a zelené unit testy proto neopravňují tvrdit, že automatické hodnocení
neznámého rukopisu je spolehlivé. Osobní rastrové prototypy zůstávají lokální:
CTC využívá jejich kosinové boosty na zarovnaných úsecích, nepřidává za ně
neověřenou jistotu. Jejich přínos na nezávislých lidech zde nebyl změřen.

### Váhy, trénink a nalezený limit přípravy dat

Conv1d 6→48, kernel 5 / stride 2; dvě obousměrné GRU se 64 jednotkami ve směru;
CTC head, blank + slovník appky. **131 112 parametrů**, 524 448 B float32 hodnot,
**701 100 B JSON exportu** (0,669 MiB). Čistý TS, bez nového inference runtime,
WASM, ONNX nebo sítě. Greedy + prefix beam 12, zarovnání Viterbi proti
**predikovanému** textu. Bbox a přiřazení tahů jsou odhad z rámců, ne ověřená
pravá segmentace; virtuální strukturální znaky a pozdní tahy zůstávají limitem.

PyTorch 2.7.1+cpu, 4 vlákna, bez GPU, seed 20261109, zhruba **48 min 52 s**:
12 epoch na náhodných 24 000 train řádcích, pak 6 epoch vyváženého replay
(6 550 plochých + 6 550 strukturovaných řádků), AdamW 0,002 → 0,001, batch 32.
Unikátních trénovacích ID je **28 086**. Checkpoint 17 byl zvolen pouze podle
CER výběrové validace (v tehdejší přípravě 813/6 018 = 13,51 %), ne podle
uvedených benchmarků. Augmentace zahrnuje affine/shear/škálu, řídké nepravidelné
myší body 3–40 px v simulované velikosti znaku, třes, tenčení a spojování/dělení
blízkých tahů. Archiv byl připojen lokálním hardlinkem, nebyl znovu stažen.

**Zjištěná chyba první přípravy je přiznaný limit checkpointu:**
`\sqrt[3]{x}` se převádělo nesprávně. V původně připraveném train korpusu je
626 takových případů; do unikátních trénovacích ID tohoto checkpointu vstoupilo
233 (0,83 %). Opravený parser je nyní odmítá, loader odmítne starou cache a
konečná kalibrace/new512 je neobsahují. Snapshot není vydáván za model
přetrénovaný od nuly na opravených labelech. Nové čisté přetrénování je nutné.
Podrobnosti, hash archivu a vah, počty a obě trénovací fáze jsou v line-report.json.
Váhy i odvozené inkousty: Google MathWriting, **CC BY-NC-SA 4.0**, viz NOTICE.md.

### Latence a regresní hranice

Node/V8, zahřáté moduly, stateless rozpoznávač (tedy bez ink cache), ms:

| Sada / čtenář | medián | p95 | maximum |
|---|---:|---:|---:|
| original319 / CTC | 12,30 | 21,81 | 28,61 |
| original319 / výchozí kombinace | 28,81 | 47,81 | 56,01 |
| new512 / CTC | 15,43 | 25,61 | 109,40 |
| new512 / kombinace | 31,53 | 52,14 | 156,22 |

Headless Chromium na 32 pevných new512 inkoustech: CTC medián **16,40 ms**,
p95 23,10 ms, maximum 25,20 ms, první volání 50,30 ms; 403/403 tokenů má
konečné bbox a platné odkazy na tahy, během inference 0 fetch volání. To není
měření správnosti bbox. Typické řádky splní ~100 ms, ne všechny dlouhé 2D outliery.

`tools/handwriting/realistic` je generovaný, lidským psaním inspirovaný korpus,
ne sada nezávislých lidských pisatelů: **20/20 před i po**. Round-8 stress zůstává
**176/360 chybných, 187 přijatých, 7 tichých chyb, 7/187 = 3,74 %**. Jeho
hranice, počty ani pravděpodobnostní limity se neuvolnily. Původní speed test
50 ms je nahrazen uživatelem zadaným 100ms rozpočtem pro sekvenci + porovnání;
není to změna prahu tiché chyby. Katalogový probe nyní posílá stejné zadání a
allowlist jednotek jako App.commit (nikoli expected.value): 196/212 = 92,45 %.
Bez tohoto kontextu diagnostika ukázala 190/212 = 89,62 %; tento rozdíl se neskrývá.

### Co zbývá před přijetím

1. Znovu připravit data opraveným parserem a přetrénovat čistý, lépe vyvážený
   model; více cílených českých/myších dat a případně větší kapacita stále pod 3 MB.
2. Kalibrovat rozhodnutí **celé kombinace** na skutečných řádcích včetně vynechání
   znaků; přestat důvěřovat jistotě CNN mimo její doménu. Dnešní fallback ztrácí
   významnou část zisku samostatného CTC.
3. Lépe řešit 2D pořadí, strukturální tokeny, opomenuté operátory a přesnost
   zarovnání; malé chronologické CTC samo tyto problémy neodstraňuje.
4. Slepý test se známými novými pisateli, lidská kontrola kódu i míst zvýraznění,
   a teprve pak rozhodnutí o nasazení. Protokol reprodukce je v README.md.
