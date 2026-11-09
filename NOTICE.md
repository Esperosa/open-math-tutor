# Third-party notices

This project's own code is licensed under the PolyForm Noncommercial License 1.0.0 (see `LICENSE`), Copyright (c) 2026 Jiří Pelikán, https://jirkapelikan.cz. Earlier versions were published under MIT. The pelican logo in `docs/brand/` is not covered by that license (all rights reserved). It uses or depends
on the following third-party components, each under its own license:

| Component | License | Role |
|---|---|---|
| Excalidraw | MIT | Whiteboard canvas |
| SymPy | BSD-3-Clause | Step verification engine |
| KaTeX | MIT | Math typesetting |
| Electron | MIT | Desktop packaging |
| React, Vite, TypeScript | MIT | Frontend tooling |
| pdf.js (`pdfjs-dist`) | Apache-2.0 | Local text extraction from uploaded PDF sources (NotebookLM-style custom courses) |
| MNIST handwritten digits (LeCun, Cortes, Burges) | No formal licence; commonly listed as CC BY-SA 3.0 | Training data (train split) and held-out accuracy test (test split copy in `packages/frontend/src/handwriting/__fixtures__/`) for the local handwriting model |
| UCI Pen-Based Recognition of Handwritten Digits (`pendigits`, F. Alimoglu, E. Alpaydin, Bogazici University) | CC BY 4.0 | Online pen trajectories from 44 writers: 30 for training, 14 unseen writers for the ≥95% accuracy test (`tools/handwriting/pendigits.py`) |
| Google MathWriting (Google Research; arXiv:2404.10690) | CC BY-NC-SA 4.0 | Online handwritten mathematical expressions (stroke trajectories and LaTeX labels) for training and evaluation (`tools/handwriting/data-cache/`) |
| HASYv2 (M. Thoma, Zenodo 259444) | CC BY 4.0 | Human-written math symbols with user IDs (`user_id`) for held-out writer recognition accuracy testing |
| Hershey vector fonts (Dr. A. V. Hershey, U.S. National Bureau of Standards; `hersh.oc`) | Public domain | Stroke templates for synthetic handwriting training data and accuracy tests (`tools/handwriting/`) |
| `codex` CLI (OpenAI) | OpenAI's own terms | Installed separately by the end user; not bundled, not modified |
| `claude` CLI (Anthropic) | Anthropic's own terms | Installed separately by the end user; not bundled, not modified |
| `@diffusionstudio/vits-web` | MIT | Offline Piper speech synthesis in the browser (voice catalog, ONNX inference) |
| `onnxruntime-web` | MIT | ONNX runtime used by the synthesiser |
| `@diffusionstudio/piper-wasm` | MIT | Grapheme-to-phoneme WASM used at synthesis time (loaded from jsDelivr) |
| Piper voice models | Per voice, see below | Offline speech; downloaded by the user on request, never committed to this repository |

### Handwriting training datasets and Share-Alike license considerations (CC BY-NC-SA 4.0 vs. PolyForm Noncommercial)

The handwriting recogniser incorporates training data and validation corpora from several sources:
- **UCI pendigits** (CC BY 4.0)
- **HASYv2** (CC BY 4.0)
- **Google MathWriting** (CC BY-NC-SA 4.0, Google Research, [arXiv:2404.10690](https://arxiv.org/abs/2404.10690))

**Share-Alike analysis:**
Google MathWriting is licensed under **Creative Commons Attribution-NonCommercial-ShareAlike 4.0 International (CC BY-NC-SA 4.0)**.
Under section 3(b) of CC BY-NC-SA 4.0, if an "Adapted Material" (derivative work) is produced and distributed, it must be licensed under the same license (CC BY-NC-SA 4.0) or a compatible license listed by Creative Commons.
If the exported neural network weights (`packages/frontend/src/handwriting/model/weights.json`) are legally construed as an adaptation of the underlying training data trajectories, distributing those weights under a different license would trigger a license incompatibility with the repository's overall **PolyForm Noncommercial License 1.0.0**.

**Proposed compromise / dual-licensing boundary:**
1. The **application source code**, UI, tests, and non-model assets remain strictly under **PolyForm Noncommercial License 1.0.0**.
2. The **neural network weights and checkpoint artifacts** (`weights.json`, `calibration.json`) and the regression test fixture `packages/frontend/src/handwriting/__fixtures__/real-human-lines.json` (30 authentic human handwriting expressions from MathWriting valid/test splits) derived from MathWriting are dual-licensed / explicitly distributed under **CC BY-NC-SA 4.0**.
3. Training scripts and data loaders in `tools/handwriting/` remain under PolyForm Noncommercial 1.0.0 (or permissive CC0 for data extraction logic).
Both PolyForm Noncommercial 1.0.0 and CC BY-NC-SA 4.0 share the common intent and legal restriction: they permit educational, non-commercial, personal, and research use without royalty, while strictly prohibiting commercial exploitation without explicit separate licensing. Separating the weights artifact boundary ensures strict legal compliance with the Share-Alike provision of MathWriting without forcing relicensing of the application code.

### Line-level handwriting model (MathWriting CTC)

`packages/frontend/src/handwriting/model/line-weights.json`,
`model/line-calibration.json`, and the `__fixtures__/line-heldout.json` and
`__fixtures__/line-parity.json` handwriting data are distributed under
[CC BY-NC-SA 4.0](https://creativecommons.org/licenses/by-nc-sa/4.0/),
separately from the application source license. Source: **Google LLC,
MathWriting (2024)**, [dataset and attribution](https://github.com/google-research/google-research/tree/master/mathwriting),
[paper](https://arxiv.org/abs/2404.10690).
Changes: supported LaTeX is converted to linear mathematical transcripts;
trajectories are resampled/augmented; a convolutional bidirectional-GRU CTC
network is trained and exported; confidence is fitted on validation inks.
The test fixtures retain anonymized sample IDs, not writer identities.
The full archive and Python checkpoints are local ignored caches, not bundled.
Commercial use of these artifacts is not granted by the application license.

### Voice models (downloaded on demand)

The four voices offered under Nastavení → Hlas → "High-quality voices
(Piper, offline)" are fetched at runtime from
`huggingface.co/diffusionstudio/piper-voices` (a mirror of the
`rhasspy/piper-voices` layout, MIT for the packaging code), stored in the
browser's origin-private file system and removed by clearing site data.
Nothing is bundled with the application. Licenses come from each model
card:

| Voice | Dataset license | Training |
|---|---|---|
| `cs_CZ-jirka-medium` | CC0 ([NabuCasa/voice-datasets](https://github.com/NabuCasa/voice-datasets)) | Finetuned from `en_US-lessac-medium` |
| `en_US-lessac-medium` | [Lessac / Blizzard 2013 research license](https://www.cstr.ed.ac.uk/projects/blizzard/2013/lessac_blizzard2013/license.html) | Trained from scratch |
| `en_US-amy-medium` | CC BY-SA 4.0 ([MycroftAI/mimic3-voices](https://github.com/MycroftAI/mimic3-voices)) | Finetuned from `en_US-lessac-medium` |
| `en_GB-alba-medium` | CC BY 4.0 ([Edinburgh DataShare](https://datashare.ed.ac.uk/handle/10283/3270)) | Finetuned from `en_US-lessac-medium` |

**Every offered voice is a fine-tune of the Lessac voice**, so the Lessac
license applies to all four on top of their dataset licenses: it is a
research license, it is non-commercial, it asks for manual verification
of the license before use, and it restricts incorporating the output into
voice-synthesis products. This project is itself non-commercial
(PolyForm Noncommercial), which matches that requirement; anyone who needs
the voices for a commercial product must obtain voices under terms that
allow it.

No commercial fonts are bundled or committed to this repository. Any
third-party visual reference used during design work is recorded in
`SOURCES.md` (created as needed).

"OpenMathTutor" is a working project name and is not affiliated with,
endorsed by, or associated with OpenAI or Anthropic. "Claude", "Claude
Code", "Codex", and related marks belong to their respective owners.
