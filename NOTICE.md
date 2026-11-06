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
| Hershey vector fonts (Dr. A. V. Hershey, U.S. National Bureau of Standards; `hersh.oc`) | Public domain | Stroke templates for synthetic handwriting training data and accuracy tests (`tools/handwriting/`) |
| `codex` CLI (OpenAI) | OpenAI's own terms | Installed separately by the end user; not bundled, not modified |
| `claude` CLI (Anthropic) | Anthropic's own terms | Installed separately by the end user; not bundled, not modified |

No commercial fonts are bundled or committed to this repository. Any
third-party visual reference used during design work is recorded in
`SOURCES.md` (created as needed).

"OpenMathTutor" is a working project name and is not affiliated with,
endorsed by, or associated with OpenAI or Anthropic. "Claude", "Claude
Code", "Codex", and related marks belong to their respective owners.
