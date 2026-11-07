import type { ProblemTemplate, Skill, Topic } from "@openmathtutor/shared";

/**
 * Additional original practice material. Everything here is written for this
 * project against the *publicly documented* exam topics (Cermat specifications,
 * general first-year curricula) — no past exam item is reproduced.
 *
 * Skills with `autoCheck: false` cannot be verified by the local checker or the
 * SymPy verifier (geometry, systems, functions, calculus, ...): the tutor still
 * guides them, but the UI says plainly that steps are not machine-checked.
 * All templates include Czech and English statement templates.
 */
type Ranges = Record<string, [number, number]>;
type Tpl = [statement: string, ranges?: Ranges | null, statementEn?: string];
interface SkillSpec {
  id: string; cs: string; en: string; prereq: string[]; topic: string; levels?: number[];
  auto?: boolean; free?: boolean; kw?: [string[], string[]]; templates: Tpl[];
  /** Per-template expected answer, for skills defined with their own formulas (physics, chemistry). */
  answers?: ([formula: string, unit?: string] | undefined)[];
  drawing?: boolean;
}

/** Expected numeric answers (formula over the generator names, optional unit) for templates that cannot be solved from their statement text. */
const ANSWERS: Record<string, [formula: string, unit?: string]> = {
  "proportion-1": ["{b}/{a}*{c}", "Kč"], "proportion-2": ["{a}*{b}/{c}", "h"], "proportion-3": ["{a}*1000*{b}/100000", "km"],
  "proportion-4": ["{b}/{a}*{c}", "Kč"], "proportion-5": ["{a}*{b}/{c}", "dní"], "proportion-6": ["{b}/{a}*{c}", "m"],
  "proportion-7": ["{a}*{b}/{c}", "h"], "proportion-8": ["{b}/{a}*{c}", "l"],
  "stats-basic-1": ["({a}+{b}+{c}+{d})/4"], "stats-basic-3": ["3*{a}-{b}-{c}"], "stats-basic-4": ["({a}+{b}+{c}+{d}+{e})/5"],
  "stats-basic-6": ["4*{a}-{b}-{c}-{d}"], "stats-basic-8": ["({a}+{b})/2"],
  "pythagoras-1": ["{a}^2+{b}^2", "cm²"], "pythagoras-2": ["{c}^2-{a}^2", "cm²"], "pythagoras-3": ["{a}^2+{b}^2", "cm²"],
  "pythagoras-4": ["{a}^2+{b}^2", "m²"], "pythagoras-5": ["{c}^2-{a}^2", "m²"], "pythagoras-6": ["2*{a}^2", "cm²"],
  "pythagoras-7": ["{a}^2+{b}^2", "cm²"], "pythagoras-8": ["{c}^2-{a}^2", "cm²"],
  "circle-area-1": ["{a}^2", "π cm²"], "circle-area-2": ["{a}/2", "cm"], "circle-area-3": ["{a}", "π m"],
  "circle-area-4": ["2*{a}", "π cm"], "circle-area-5": ["({a}/2)^2", "π m²"], "circle-area-6": ["{a}", "π cm²"],
  "circle-area-7": ["2*{a}", "π m"], "circle-area-8": ["{a}^2", "π m²"],
  "solids-volume-1": ["{a}^3", "cm³"], "solids-volume-2": ["{a}*{b}*{c}", "cm³"], "solids-volume-3": ["{a}^2*{b}", "π cm³"],
  "solids-volume-4": ["6*{a}^2", "cm²"], "solids-volume-5": ["2*({a}*{b}+{b}*{c}+{a}*{c})", "cm²"],
  "solids-volume-6": ["{a}^3", "m³"], "solids-volume-7": ["{a}^2*{b}", "cm³"], "solids-volume-8": ["4/3*{a}^3", "π cm³"],
  "counting-basic-1": ["{a}*({a}-1)*({a}-2)"], "counting-basic-2": ["{a}*{b}"], "counting-basic-3": ["{a}*({a}-1)/2"],
  "counting-basic-4": ["{a}*{b}*{c}"], "counting-basic-5": ["{a}*{a}"], "counting-basic-6": ["{a}*({a}-1)"],
  "counting-basic-7": ["{a}*({a}-1)*({a}-2)/6"], "counting-basic-8": ["2^{a}"],
  "arith-seq-1": ["{a}+9*{b}"], "arith-seq-3": ["{a}/2*(4+({a}-1)*3)"], "arith-seq-4": ["{a}+4*{b}"],
  "arith-seq-5": ["{a}+19*{b}"], "arith-seq-7": ["{a}/2*(2*{b}+({a}-1)*{d})"], "arith-seq-8": ["{b}-{a}"],
  "geom-seq-1": ["{a}*16"], "geom-seq-3": ["2^{a}-1"], "geom-seq-4": ["{a}*8"], "geom-seq-5": ["{a}*3^{b}"],
  "geom-seq-7": ["2"], "geom-seq-8": ["{a}*27"],
  "finance-interest-1": ["{a}*1000*(1+{b}/100)", "Kč"], "finance-interest-2": ["{a}*(1+{b}/100)*(1-{b}/100)", "Kč"],
  "finance-interest-4": ["{a}*1000*{b}/100", "Kč"], "finance-interest-5": ["{a}*500*(1+{b}/100)", "Kč"],
  "finance-interest-7": ["{a}*1000*(1+{b}/100)^2", "Kč"], "finance-interest-8": ["{a}*(1+{b}/100)", "Kč"],
  "comb-formulas-1": ["{a}*({a}-1)/2"], "comb-formulas-2": ["{a}*({a}-1)*({a}-2)*({a}-3)"],
  "comb-formulas-4": ["{a}*({a}-1)*({a}-2)"], "comb-formulas-5": ["{a}*({a}-1)/2"], "comb-formulas-7": ["100000"],
  "probability-basic-1": ["1/6"], "probability-basic-2": ["{a}/({a}+{b})"], "probability-basic-4": ["{b}/({a}+{b})"],
  "probability-basic-5": ["1/2"], "probability-basic-7": ["({a}-1)/36"], "probability-basic-8": ["{a}/10"],
};

/** Model answers for printed test keys where the result is not one number. */
const ANSWER_NOTES: Record<string, string> = {
  "ch-balance-1": "2 H₂ + O₂ → 2 H₂O", "ch-balance-2": "4 Fe + 3 O₂ → 2 Fe₂O₃", "ch-balance-3": "C₃H₈ + 5 O₂ → 3 CO₂ + 4 H₂O",
  "ch-balance-4": "2 CO + O₂ → 2 CO₂", "ch-balance-5": "CH₄ + 2 O₂ → CO₂ + 2 H₂O", "ch-balance-6": "2 Na + 2 H₂O → 2 NaOH + H₂",
  "ch-balance-7": "4 Al + 3 O₂ → 2 Al₂O₃", "ch-balance-8": "N₂ + 3 H₂ → 2 NH₃", "ch-balance-9": "2 Mg + O₂ → 2 MgO",
  "ch-balance-10": "CaCO₃ → CaO + CO₂", "ch-balance-11": "2 KClO₃ → 2 KCl + 3 O₂", "ch-balance-12": "Zn + 2 HCl → ZnCl₂ + H₂",
};

/** Ranges and derived values for tasks whose answer is a division: the numbers are built so the result comes out even. */
const OVERRIDES: Record<string, { ranges: Ranges; derived: Record<string, string> }> = {
  "fy-velocity-1": { ranges: { v: [5, 30], b: [2, 12] }, derived: { a: "{v}*{b}" } },
  "fy-velocity-3": { ranges: { w: [4, 12], k: [2, 10] }, derived: { v: "10*{w}", b: "6*{k}", a: "{v}*{b}/60" } },
  "fy-velocity-4": { ranges: { v: [5, 25], b: [2, 10] }, derived: { a: "{v}*{b}" } },
  "fy-velocity-7": { ranges: { v: [10, 40], b: [2, 8] }, derived: { a: "{v}*{b}" } },
  "fy-force-2": { ranges: { m: [2, 12], b: [2, 5] }, derived: { a: "{m}*{b}" } },
  "fy-force-5": { ranges: { a: [2, 8], b: [2, 6] }, derived: { F: "{a}*{b}" } },
  "fy-work-2": { ranges: { p: [20, 90], b: [2, 10] }, derived: { a: "{p}*{b}" } },
  "fy-work-5": { ranges: { f: [5, 20], s: [2, 10] }, derived: { a: "{f}*{s}" } },
  "fy-density-pressure-1": { ranges: { r: [2, 9], b: [2, 10] }, derived: { a: "{r}*{b}" } },
  "fy-density-pressure-2": { ranges: { p: [50, 400], b: [2, 10] }, derived: { a: "{p}*{b}" } },
  "fy-density-pressure-5": { ranges: { r: [2, 8], v: [2, 10] }, derived: { m: "{r}*{v}" } },
  "fy-ohm-1": { ranges: { i: [1, 5], a: [5, 50] }, derived: { b: "{i}*{a}" } },
  "fy-ohm-2": { ranges: { a: [2, 10], r: [5, 30] }, derived: { b: "{a}*{r}" } },
  "fy-ohm-4": { ranges: { i: [1, 4], r: [5, 25] }, derived: { b: "{i}*{r}" } },
  "fy-resistors-4": { ranges: { a: [10, 50] }, derived: { b: "{a}" } },
  "ch-mole-1": { ranges: { k: [2, 10] }, derived: { a: "18*{k}" } },
  "ch-mole-4": { ranges: { k: [1, 6] }, derived: { a: "44*{k}" } },
  "ch-mole-5": { ranges: { k: [1, 5] }, derived: { a: "40*{k}" } },
  "ch-mole-7": { ranges: { k: [1, 5] }, derived: { a: "98*{k}" } },
  "ch-mole-9": { ranges: { k: [1, 6] }, derived: { a: "100*{k}" } },
  "ch-concentration-1": { ranges: { c: [1, 5], b: [2, 4] }, derived: { a: "{c}*{b}" } },
  "ch-concentration-3": { ranges: { a: [10, 40] }, derived: { b: "100-{a}" } },
  "ch-concentration-4": { ranges: { c: [1, 4], b: [2, 5] }, derived: { a: "{c}*{b}" } },
  "ch-concentration-7": { ranges: { a: [5, 25] }, derived: { b: "100" } },
  "proportion-1": { ranges: { a: [2, 5], c: [6, 10], p: [10, 30] }, derived: { b: "{p}*{a}" } },
  "proportion-2": { ranges: { a: [2, 6], c: [3, 12], k: [2, 6] }, derived: { b: "{c}*{k}" } },
  "proportion-4": { ranges: { a: [2, 5], c: [4, 8], p: [10, 25] }, derived: { b: "{p}*{a}" } },
  "proportion-5": { ranges: { a: [2, 5], c: [2, 10], k: [2, 5] }, derived: { b: "{c}*{k}" } },
  "arith-seq-2": { ranges: { f: [1, 9], d: [2, 7] }, derived: { a: "{f}+2*{d}", b: "{f}+6*{d}" } },
  "geom-seq-2": { ranges: { f: [1, 3], q: [2, 4] }, derived: { a: "{f}*{q}", b: "{f}*{q}^3" } },
  // Quadratic equations generated from roots to guarantee clean integer/rational roots
  "quadratic-eq-1": { ranges: { r1: [1, 6], r2: [1, 6], b: [-12, -2], c: [1, 36] }, derived: { b: "0-{r1}-{r2}", c: "{r1}*{r2}" } },
  "quadratic-eq-2": { ranges: { r1: [2, 6], r2: [1, 5], b: [-5, 5], c: [-36, -1] }, derived: { b: "{r2}-{r1}", c: "0-{r1}*{r2}" } },
  "quadratic-eq-3": { ranges: { r1: [1, 5], r2: [1, 5], b: [2, 10], c: [1, 25] }, derived: { b: "{r1}+{r2}", c: "{r1}*{r2}" } },
  "quadratic-eq-4": { ranges: { k: [2, 9], c: [4, 81] }, derived: { c: "{k}*{k}" } },
  "quadratic-eq-5": { ranges: { r: [2, 9] }, derived: {} },
  "quadratic-eq-6": { ranges: { r: [2, 9] }, derived: {} },
  "quadratic-eq-7": { ranges: { r1: [1, 5], r2: [1, 4], b: [-13, -3], c: [1, 20] }, derived: { b: "0-{r1}-2*{r2}", c: "{r1}*{r2}" } },
  "quadratic-eq-8": { ranges: { r1: [2, 6], r2: [1, 5], b: [-5, 5], c: [2, 30] }, derived: { b: "{r2}-{r1}", c: "{r1}*{r2}" } },
  "quadratic-eq-9": { ranges: { r: [2, 6], b: [-12, -4], c: [4, 36] }, derived: { b: "0-2*{r}", c: "{r}*{r}" } },
  "quadratic-eq-10": { ranges: { k: [1, 5], c: [2, 50] }, derived: { c: "2*{k}*{k}" } },
};

export const extraTopics: Topic[] = [];
export const extraSkills: Skill[] = [];
export const extraTemplates: ProblemTemplate[] = [];

function topic(id: string, cs: string, en: string, specs: SkillSpec[]) {
  extraTopics.push({ id, title: { cs, en }, skillIds: specs.map(s => s.id) });
  for (const s of specs) {
    const levels = s.levels ?? [2, 3, 4];
    const ids = s.templates.map((_, i) => `${s.id}-${i + 1}`);
    extraSkills.push({
      id: s.id, title: { cs: s.cs, en: s.en }, prerequisiteSkillIds: s.prereq, problemTemplateIds: ids,
      ...(s.auto === false ? { autoCheck: false } : {}), ...(s.drawing ? { drawing: true } : {}), ...(s.kw ? { keywords: { cs: s.kw[0], en: s.kw[1] } } : {}),
    });
    s.templates.forEach(([statementTemplate, generatorRanges, statementTemplateEn], i) => extraTemplates.push({
      id: ids[i]!, skillId: s.id, difficultyLevel: levels[i] ?? levels[levels.length - 1] ?? 2, topic: id, statementTemplate,
      statementTemplateEn: statementTemplateEn ?? statementTemplate,
      ...(OVERRIDES[ids[i]!] ? { generatorRanges: OVERRIDES[ids[i]!]!.ranges, derived: OVERRIDES[ids[i]!]!.derived } : generatorRanges && generatorRanges !== null ? { generatorRanges } : {}),
      ...(s.free === false ? {} : s.auto === false ? { freeText: true } : {}),
      ...(ANSWER_NOTES[ids[i]!] ? { answerNote: ANSWER_NOTES[ids[i]!] } : {}),
      ...(ANSWERS[ids[i]!] ? { answerTemplate: ANSWERS[ids[i]!]![0], ...(ANSWERS[ids[i]!]![1] ? { answerUnit: ANSWERS[ids[i]!]![1] } : {}) } : {}),
      ...(s.answers?.[i] ? { answerTemplate: s.answers[i]![0], ...(s.answers[i]![1] ? { answerUnit: s.answers[i]![1] } : {}) } : {}),
    }));
  }
}

topic("mocniny-a-vyrazy", "Mocniny a výrazy", "Powers and expressions", [
  {
    "id": "powers-basic",
    "cs": "Druhé mocniny a mocniny čísel",
    "en": "Squares and powers of numbers",
    "prereq": [],
    "topic": "mocniny-a-vyrazy",
    "kw": [
      [
        "mocnina",
        "na druhou",
        "umocňování"
      ],
      [
        "power",
        "square",
        "exponent"
      ]
    ],
    "levels": [
      1,
      2,
      3
    ],
    "templates": [
      [
        "{a}^2",
        {
          "a": [
            2,
            12
          ]
        },
        "{a}^2"
      ],
      [
        "{a}^2+{b}^2",
        {
          "a": [
            2,
            9
          ],
          "b": [
            2,
            9
          ]
        },
        "{a}^2+{b}^2"
      ],
      [
        "({a}+{b})^2-{c}",
        {
          "a": [
            1,
            6
          ],
          "b": [
            1,
            6
          ],
          "c": [
            1,
            30
          ]
        },
        "({a}+{b})^2-{c}"
      ],
      [
        "{a}^2-{b}^2",
        {
          "a": [
            5,
            12
          ],
          "b": [
            1,
            4
          ]
        },
        "{a}^2-{b}^2"
      ],
      [
        "({a}-{b})^2+{c}",
        {
          "a": [
            4,
            9
          ],
          "b": [
            1,
            3
          ],
          "c": [
            1,
            20
          ]
        },
        "({a}-{b})^2+{c}"
      ],
      [
        "{a}*{b}^2",
        {
          "a": [
            2,
            5
          ],
          "b": [
            2,
            6
          ]
        },
        "{a}*{b}^2"
      ],
      [
        "{a}^2*{b}",
        {
          "a": [
            2,
            6
          ],
          "b": [
            2,
            5
          ]
        },
        "{a}^2*{b}"
      ],
      [
        "({a}+{b})^2",
        {
          "a": [
            2,
            8
          ],
          "b": [
            2,
            8
          ]
        },
        "({a}+{b})^2"
      ]
    ]
  },
  {
    "id": "expression-formulas",
    "cs": "Vzorce (a ± b)² a a² − b²",
    "en": "Formulas (a ± b)² and a² − b²",
    "prereq": [
      "powers-basic"
    ],
    "topic": "mocniny-a-vyrazy",
    "auto": false,
    "kw": [
      [
        "roznásobit",
        "rozklad",
        "součin",
        "vzorec"
      ],
      [
        "expand",
        "factor",
        "identity"
      ]
    ],
    "templates": [
      [
        "Roznásob podle vzorce: (x+{a})^2",
        {
          "a": [
            1,
            9
          ]
        },
        "Expand using the formula: (x+{a})^2"
      ],
      [
        "Rozlož na součin: x^2-{a}^2",
        {
          "a": [
            2,
            12
          ]
        },
        "Factor into a product: x^2-{a}^2"
      ],
      [
        "Zjednoduš: (x+{a})^2-(x-{a})^2",
        {
          "a": [
            1,
            9
          ]
        },
        "Simplify: (x+{a})^2-(x-{a})^2"
      ],
      [
        "Roznásob podle vzorce: (x-{a})^2",
        {
          "a": [
            1,
            9
          ]
        },
        "Expand using the formula: (x-{a})^2"
      ],
      [
        "Rozlož na součin: 4x^2-{a}^2",
        {
          "a": [
            1,
            9
          ]
        },
        "Factor into a product: 4x^2-{a}^2"
      ],
      [
        "Roznásob: (x+{a})(x-{a})",
        {
          "a": [
            2,
            10
          ]
        },
        "Expand: (x+{a})(x-{a})"
      ],
      [
        "Zjednoduš: (2x+{a})^2",
        {
          "a": [
            1,
            6
          ]
        },
        "Simplify: (2x+{a})^2"
      ],
      [
        "Rozlož na součin: x^2+2*{a}x+{a}^2",
        {
          "a": [
            1,
            8
          ]
        },
        "Factor into a product: x^2+2*{a}x+{a}^2"
      ]
    ]
  }
]);

topic("soustavy-rovnic", "Soustavy rovnic", "Systems of equations", [
  {
    "id": "systems-2x2",
    "cs": "Soustava dvou lineárních rovnic",
    "en": "System of two linear equations",
    "prereq": [],
    "topic": "soustavy-rovnic",
    "auto": false,
    "kw": [
      [
        "soustava",
        "dosazovací",
        "sčítací",
        "dvě rovnice"
      ],
      [
        "system",
        "substitution",
        "elimination"
      ]
    ],
    "templates": [
      [
        "Řeš soustavu: x+y={a}, x-y={b}",
        {
          "a": [
            6,
            20
          ],
          "b": [
            2,
            4
          ]
        },
        "Solve the system: x+y={a}, x-y={b}"
      ],
      [
        "Řeš soustavu: 2x+y={a}, x-y={b}",
        {
          "a": [
            8,
            20
          ],
          "b": [
            1,
            4
          ]
        },
        "Solve the system: 2x+y={a}, x-y={b}"
      ],
      [
        "Řeš soustavu: {a}x+2y={b}, x+y={c}",
        {
          "a": [
            3,
            6
          ],
          "b": [
            10,
            30
          ],
          "c": [
            3,
            8
          ]
        },
        "Solve the system: {a}x+2y={b}, x+y={c}"
      ],
      [
        "Řeš soustavu: 3x-y={a}, x+y={b}",
        {
          "a": [
            5,
            15
          ],
          "b": [
            3,
            9
          ]
        },
        "Solve the system: 3x-y={a}, x+y={b}"
      ],
      [
        "Řeš soustavu: x+2y={a}, 2x-y={b}",
        {
          "a": [
            7,
            18
          ],
          "b": [
            2,
            8
          ]
        },
        "Solve the system: x+2y={a}, 2x-y={b}"
      ],
      [
        "Řeš soustavu: 2x+3y={a}, x-y={b}",
        {
          "a": [
            10,
            24
          ],
          "b": [
            1,
            5
          ]
        },
        "Solve the system: 2x+3y={a}, x-y={b}"
      ],
      [
        "Řeš soustavu: 4x-2y={a}, x+y={b}",
        {
          "a": [
            6,
            18
          ],
          "b": [
            3,
            9
          ]
        },
        "Solve the system: 4x-2y={a}, x+y={b}"
      ],
      [
        "Řeš soustavu: x-3y={a}, 2x+y={b}",
        {
          "a": [
            1,
            7
          ],
          "b": [
            8,
            20
          ]
        },
        "Solve the system: x-3y={a}, 2x+y={b}"
      ]
    ]
  }
]);

topic("zavislosti-a-data", "Závislosti a data", "Relations and data", [
  {
    "id": "proportion",
    "cs": "Přímá a nepřímá úměrnost",
    "en": "Direct and inverse proportion",
    "prereq": [
      "fractions-basic"
    ],
    "topic": "zavislosti-a-data",
    "auto": false,
    "kw": [
      [
        "trojčlenka",
        "úměra",
        "úměrnost"
      ],
      [
        "rule of three",
        "proportion"
      ]
    ],
    "levels": [
      1,
      2,
      3
    ],
    "templates": [
      [
        "{a} kg jablek stojí {b} Kč. Kolik stojí {c} kg stejných jablek?",
        {
          "a": [
            2,
            5
          ],
          "b": [
            40,
            120
          ],
          "c": [
            6,
            10
          ]
        },
        "{a} kg of apples costs {b} CZK. How much do {c} kg of the same apples cost?"
      ],
      [
        "{a} dělníků vykope příkop za {b} hodin. Za kolik hodin ho vykope {c} dělníků, pracují-li stejně rychle?",
        {
          "a": [
            2,
            6
          ],
          "b": [
            12,
            24
          ],
          "c": [
            3,
            12
          ]
        },
        "{a} workers dig a trench in {b} hours. In how many hours will {c} workers dig it, working at the same rate?"
      ],
      [
        "Mapa má měřítko 1 : {a}000. Vzdálenost na mapě je {b} cm. Kolik km je to ve skutečnosti?",
        {
          "a": [
            20,
            50
          ],
          "b": [
            3,
            12
          ]
        },
        "A map has a scale of 1 : {a}000. The distance on the map is {b} cm. How many km is that in reality?"
      ],
      [
        "{a} sešitů stojí {b} Kč. Kolik stojí {c} těchto sešitů?",
        {
          "a": [
            2,
            5
          ],
          "b": [
            30,
            90
          ],
          "c": [
            4,
            8
          ]
        },
        "{a} notebooks cost {b} CZK. How much do {c} of these notebooks cost?"
      ],
      [
        "Čerpadlo o výkonu {a} l/s naplní bazén za {b} dní. Za kolik dní ho naplní čerpadlo o výkonu {c} l/s?",
        {
          "a": [
            2,
            5
          ],
          "b": [
            6,
            18
          ],
          "c": [
            2,
            10
          ]
        },
        "A pump running at {a} l/s fills a pool in {b} days. In how many days does a pump running at {c} l/s fill it?"
      ],
      [
        "Z {a} m látky se ušije {b} šatů. Kolik metrů látky je potřeba na {c} šatů?",
        {
          "a": [
            4,
            10
          ],
          "b": [
            2,
            5
          ],
          "c": [
            6,
            15
          ]
        },
        "From {a} m of fabric, {b} dresses are made. How many meters of fabric are needed for {c} dresses?"
      ],
      [
        "Automobil jedoucí rychlostí {a} km/h ujede trasu za {b} h. Za jak dlouho ujede stejnou trasu rychlostí {c} km/h?",
        {
          "a": [
            40,
            80
          ],
          "b": [
            2,
            6
          ],
          "c": [
            50,
            100
          ]
        },
        "A car traveling at {a} km/h completes a route in {b} h. In how much time will it complete the same route at {c} km/h?"
      ],
      [
        "Na upečení {a} koláčů je potřeba {b} l mléka. Kolik mléka je potřeba na {c} koláčů?",
        {
          "a": [
            10,
            30
          ],
          "b": [
            1,
            3
          ],
          "c": [
            20,
            60
          ]
        },
        "To bake {a} pies, {b} l of milk is needed. How much milk is needed for {c} pies?"
      ]
    ]
  },
  {
    "id": "stats-basic",
    "cs": "Aritmetický průměr a medián",
    "en": "Mean and median",
    "prereq": [
      "arithmetic-integers"
    ],
    "topic": "zavislosti-a-data",
    "auto": false,
    "kw": [
      [
        "průměr",
        "medián",
        "statistika",
        "četnost"
      ],
      [
        "average",
        "mean",
        "median",
        "statistics"
      ]
    ],
    "levels": [
      1,
      2,
      3
    ],
    "templates": [
      [
        "Vypočítej aritmetický průměr čísel {a}, {b}, {c}, {d}.",
        {
          "a": [
            1,
            9
          ],
          "b": [
            1,
            9
          ],
          "c": [
            1,
            9
          ],
          "d": [
            1,
            9
          ]
        },
        "Calculate the arithmetic mean of numbers {a}, {b}, {c}, {d}."
      ],
      [
        "Urči medián čísel {a}, {b}, {c}, {d}, {e}.",
        {
          "a": [
            1,
            20
          ],
          "b": [
            1,
            20
          ],
          "c": [
            1,
            20
          ],
          "d": [
            1,
            20
          ],
          "e": [
            1,
            20
          ]
        },
        "Determine the median of numbers {a}, {b}, {c}, {d}, {e}."
      ],
      [
        "Průměr tří čísel je {a}. Dvě z nich jsou {b} a {c}. Jaké je třetí číslo?",
        {
          "a": [
            7,
            12
          ],
          "b": [
            1,
            9
          ],
          "c": [
            1,
            9
          ]
        },
        "The mean of three numbers is {a}. Two of them are {b} and {c}. What is the third number?"
      ],
      [
        "Vypočítej průměr hodnot {a}, {b}, {c}, {d}, {e}.",
        {
          "a": [
            2,
            10
          ],
          "b": [
            2,
            10
          ],
          "c": [
            2,
            10
          ],
          "d": [
            2,
            10
          ],
          "e": [
            2,
            10
          ]
        },
        "Calculate the mean of values {a}, {b}, {c}, {d}, {e}."
      ],
      [
        "Urči modus a medián z hodnot 2, 3, 3, {a}, {b}.",
        {
          "a": [
            4,
            7
          ],
          "b": [
            5,
            9
          ]
        },
        "Find the mode and median of the values 2, 3, 3, {a}, {b}."
      ],
      [
        "Průměr čtyř čísel je {a}. Tři z nich jsou {b}, {c}, {d}. Urči čtvrté číslo.",
        {
          "a": [
            8,
            15
          ],
          "b": [
            4,
            10
          ],
          "c": [
            5,
            12
          ],
          "d": [
            6,
            14
          ]
        },
        "The mean of four numbers is {a}. Three of them are {b}, {c}, {d}. Determine the fourth number."
      ],
      [
        "Urči rozpětí (rozdíl max - min) množiny čísel {a}, {b}, {c}, {d}.",
        {
          "a": [
            2,
            8
          ],
          "b": [
            10,
            18
          ],
          "c": [
            5,
            12
          ],
          "d": [
            1,
            6
          ]
        },
        "Find the range (max - min) of the set of numbers {a}, {b}, {c}, {d}."
      ],
      [
        "Vypočítej průměr známek ze dvou testů: {a} a {b}.",
        {
          "a": [
            1,
            4
          ],
          "b": [
            1,
            5
          ]
        },
        "Calculate the average grade of two tests: {a} and {b}."
      ]
    ]
  }
]);

topic("geometrie", "Geometrie", "Geometry", [
  {
    "id": "pythagoras",
    "cs": "Pythagorova věta",
    "en": "Pythagorean theorem",
    "prereq": [
      "powers-basic"
    ],
    "topic": "geometrie",
    "auto": false,
    "kw": [
      [
        "trojúhelník",
        "přepona",
        "odvěsna",
        "pravoúhlý"
      ],
      [
        "triangle",
        "hypotenuse",
        "right angle"
      ]
    ],
    "templates": [
      [
        "Pravoúhlý trojúhelník má odvěsny {a} cm a {b} cm. Urči druhou mocninu jeho přepony.",
        {
          "a": [
            3,
            9
          ],
          "b": [
            3,
            9
          ]
        },
        "A right triangle has legs of {a} cm and {b} cm. Find the square of its hypotenuse."
      ],
      [
        "Přepona pravoúhlého trojúhelníku měří {c} cm, jedna odvěsna {a} cm. Urči druhou mocninu druhé odvěsny.",
        {
          "a": [
            3,
            8
          ],
          "c": [
            10,
            15
          ]
        },
        "The hypotenuse of a right triangle is {c} cm, one leg is {a} cm. Find the square of the other leg."
      ],
      [
        "Obdélník má strany {a} cm a {b} cm. Urči druhou mocninu jeho úhlopříčky.",
        {
          "a": [
            4,
            12
          ],
          "b": [
            4,
            12
          ]
        },
        "A rectangle has sides of {a} cm and {b} cm. Find the square of its diagonal."
      ],
      [
        "Odvěsny pravoúhlého trojúhelníku měří {a} m a {b} m. Urči druhou mocninu přepony.",
        {
          "a": [
            2,
            8
          ],
          "b": [
            2,
            8
          ]
        },
        "The legs of a right triangle measure {a} m and {b} m. Find the square of the hypotenuse."
      ],
      [
        "Přepona měří {c} m, jedna odvěsna {a} m. Urči druhou mocninu druhé odvěsny.",
        {
          "a": [
            3,
            7
          ],
          "c": [
            8,
            14
          ]
        },
        "The hypotenuse measures {c} m, one leg {a} m. Find the square of the other leg."
      ],
      [
        "Čtverec má stranu {a} cm. Urči druhou mocninu délky jeho úhlopříčky.",
        {
          "a": [
            3,
            10
          ]
        },
        "A square has side {a} cm. Find the square of its diagonal."
      ],
      [
        "Kosočtverec má úhlopříčky délek 2*{a} cm a 2*{b} cm. Urči druhou mocninu délky jeho strany.",
        {
          "a": [
            2,
            7
          ],
          "b": [
            2,
            7
          ]
        },
        "A rhombus has diagonals of lengths 2*{a} cm and 2*{b} cm. Find the square of its side length."
      ],
      [
        "Žebřík délky {c} m dosahuje do výšky {a} m. Urči druhou mocninu vzdálenosti paty žebříku od zdi.",
        {
          "a": [
            3,
            8
          ],
          "c": [
            9,
            15
          ]
        },
        "A ladder of length {c} m reaches a height of {a} m. Find the square of the distance from the foot of the ladder to the wall."
      ]
    ]
  },
  {
    "id": "circle-area",
    "cs": "Obvod a obsah kruhu",
    "en": "Circumference and area of a circle",
    "prereq": [
      "powers-basic"
    ],
    "topic": "geometrie",
    "auto": false,
    "kw": [
      [
        "kruh",
        "kružnice",
        "pí",
        "poloměr"
      ],
      [
        "circle",
        "pi",
        "radius",
        "area"
      ]
    ],
    "levels": [
      1,
      2,
      3
    ],
    "templates": [
      [
        "Kruh má poloměr {a} cm. Urči jeho obsah (výsledek v násobcích π).",
        {
          "a": [
            2,
            12
          ]
        },
        "A circle has radius {a} cm. Find its area (result in multiples of π)."
      ],
      [
        "Kružnice má obvod {a}π cm. Urči její poloměr.",
        {
          "a": [
            4,
            20
          ]
        },
        "A circle has circumference {a}π cm. Find its radius."
      ],
      [
        "Kruhová zahrada má průměr {a} m. Kolik metrů plotu je potřeba na její obvod (v násobcích π)?",
        {
          "a": [
            6,
            30
          ]
        },
        "A circular garden has diameter {a} m. How many meters of fence are needed for its boundary (in multiples of π)?"
      ],
      [
        "Kružnice má poloměr {a} cm. Urči její obvod (v násobcích π).",
        {
          "a": [
            3,
            15
          ]
        },
        "A circle has radius {a} cm. Find its circumference (in multiples of π)."
      ],
      [
        "Kruh má průměr {a} m. Urči jeho obsah (v násobcích π).",
        {
          "a": [
            4,
            16
          ]
        },
        "A circle has diameter {a} m. Find its area (in multiples of π)."
      ],
      [
        "Kruhový výsek má úhel 180° a poloměr odmocnina z {a} cm. Urči obsah celého kruhu (v násobcích π).",
        {
          "a": [
            4,
            25
          ]
        },
        "A circular sector has angle 180° and radius sqrt({a}) cm. Find the area of the whole circle (in multiples of π)."
      ],
      [
        "Kruhový objezd má poloměr {a} m. Jaký je jeho obvod (v násobcích π)?",
        {
          "a": [
            5,
            25
          ]
        },
        "A roundabout has radius {a} m. What is its circumference (in multiples of π)?"
      ],
      [
        "Urči obsah kruhu o poloměru {a} m (v násobcích π).",
        {
          "a": [
            3,
            11
          ]
        },
        "Find the area of a circle with radius {a} m (in multiples of π)."
      ]
    ]
  },
  {
    "id": "solids-volume",
    "cs": "Objem a povrch těles",
    "en": "Volume and surface area of solids",
    "prereq": [
      "circle-area"
    ],
    "topic": "geometrie",
    "auto": false,
    "kw": [
      [
        "krychle",
        "kvádr",
        "válec",
        "jehlan",
        "objem",
        "povrch"
      ],
      [
        "cube",
        "cylinder",
        "pyramid",
        "volume",
        "surface"
      ]
    ],
    "templates": [
      [
        "Krychle má hranu {a} cm. Urči její objem.",
        {
          "a": [
            2,
            9
          ]
        },
        "A cube has edge {a} cm. Find its volume."
      ],
      [
        "Kvádr má rozměry {a} cm, {b} cm a {c} cm. Urči jeho objem.",
        {
          "a": [
            2,
            9
          ],
          "b": [
            3,
            10
          ],
          "c": [
            4,
            12
          ]
        },
        "A rectangular prism has dimensions {a} cm, {b} cm, and {c} cm. Find its volume."
      ],
      [
        "Válec má poloměr podstavy {a} cm a výšku {b} cm. Urči jeho objem (v násobcích π).",
        {
          "a": [
            2,
            8
          ],
          "b": [
            3,
            12
          ]
        },
        "A cylinder has base radius {a} cm and height {b} cm. Find its volume (in multiples of π)."
      ],
      [
        "Krychle má hranu {a} cm. Urči její povrch.",
        {
          "a": [
            2,
            8
          ]
        },
        "A cube has edge {a} cm. Find its surface area."
      ],
      [
        "Kvádr má rozměry {a} cm, {b} cm a {c} cm. Urči jeho povrch.",
        {
          "a": [
            2,
            6
          ],
          "b": [
            3,
            8
          ],
          "c": [
            2,
            5
          ]
        },
        "A rectangular prism has dimensions {a} cm, {b} cm, and {c} cm. Find its surface area."
      ],
      [
        "Nádrž ve tvaru krychle má hranu {a} m. Kolik m³ vody pojme?",
        {
          "a": [
            2,
            7
          ]
        },
        "A cube-shaped tank has edge {a} m. How many m³ of water does it hold?"
      ],
      [
        "Hranol má obsah podstavy {a} cm² a výšku {b} cm. Urči jeho objem.",
        {
          "a": [
            10,
            40
          ],
          "b": [
            3,
            10
          ]
        },
        "A prism has base area {a} cm² and height {b} cm. Find its volume."
      ],
      [
        "Koule má poloměr {a} cm. Urči její objem (v násobcích π).",
        {
          "a": [
            3,
            9
          ]
        },
        "A sphere has radius {a} cm. Find its volume (in multiples of π)."
      ]
    ]
  }
]);

topic("nestandardni-ulohy", "Logika a nestandardní úlohy", "Logic and non-standard problems", [
  {
    "id": "counting-basic",
    "cs": "Jednoduchá kombinatorika",
    "en": "Simple counting",
    "prereq": [],
    "topic": "nestandardni-ulohy",
    "auto": false,
    "kw": [
      [
        "kombinatorika",
        "kolika způsoby",
        "pořadí",
        "možnosti"
      ],
      [
        "counting",
        "arrangements",
        "ways"
      ]
    ],
    "levels": [
      1,
      2,
      3
    ],
    "templates": [
      [
        "Máš polici s {a} různými knihami. Kolika způsoby lze vybrat trojici knih na cesty s určeným pořadím?",
        {
          "a": [
            4,
            8
          ]
        },
        "You have a shelf with {a} different books. In how many ways can you choose an ordered triple of books for a trip?"
      ],
      [
        "Máš {a} druhů polévek a {b} druhů hlavních jídel. Kolik různých obědů (polévka + hlavní jídlo) můžeš složit?",
        {
          "a": [
            2,
            6
          ],
          "b": [
            3,
            8
          ]
        },
        "You have {a} kinds of soup and {b} kinds of main dish. How many different lunches (soup + main dish) can you create?"
      ],
      [
        "Ve třídě je {a} žáků. Kolika způsoby lze vybrat dvojici, která bude dělat službu?",
        {
          "a": [
            5,
            12
          ]
        },
        "There are {a} students in a class. In how many ways can a pair be chosen on duty?"
      ],
      [
        "Z {a} triček, {b} kalhot a {c} čepic vyber jeden outfit. Kolik je možností?",
        {
          "a": [
            2,
            5
          ],
          "b": [
            2,
            4
          ],
          "c": [
            2,
            4
          ]
        },
        "From {a} shirts, {b} pants, and {c} hats, choose one outfit. How many options are there?"
      ],
      [
        "Kolik je možných PIN kódů délky 2 sestavených z číslic 1 až {a}?",
        {
          "a": [
            4,
            9
          ]
        },
        "How many 2-digit PIN codes can be formed using digits 1 to {a}?"
      ],
      [
        "Turnaj hraje {a} hráčů každý s každým jeden zápas doma a jeden venku. Kolik je to zápasů?",
        {
          "a": [
            4,
            10
          ]
        },
        "A tournament is played by {a} players where each plays every other once at home and once away. How many matches is that?"
      ],
      [
        "Kolika způsoby lze vybrat trojici z {a} kandidátů?",
        {
          "a": [
            5,
            9
          ]
        },
        "In how many ways can a triple be selected from {a} candidates?"
      ],
      [
        "Kolik různých podmnožin má množina o {a} prvcích?",
        {
          "a": [
            3,
            7
          ]
        },
        "How many different subsets does a set with {a} elements have?"
      ]
    ]
  }
]);

topic("funkce", "Funkce a rovnice", "Functions and equations", [
  {
    "id": "quadratic-eq",
    "cs": "Kvadratické rovnice",
    "en": "Quadratic equations",
    "prereq": [],
    "topic": "funkce",
    "auto": false,
    "free": false,
    "kw": [
      [
        "diskriminant",
        "kvadratická",
        "parabola",
        "kořeny"
      ],
      [
        "discriminant",
        "quadratic",
        "roots"
      ]
    ],
    "levels": [
      2,
      3,
      4
    ],
    "templates": [
      [
        "x^2+{b}x+{c}=0",
        {
          "r1": [
            1,
            6
          ],
          "r2": [
            1,
            6
          ],
          "b": [
            -12,
            -2
          ],
          "c": [
            1,
            36
          ]
        },
        "x^2+{b}x+{c}=0"
      ],
      [
        "x^2+{b}x+{c}=0",
        {
          "r1": [
            2,
            6
          ],
          "r2": [
            1,
            5
          ],
          "b": [
            -5,
            5
          ],
          "c": [
            -36,
            -1
          ]
        },
        "x^2+{b}x+{c}=0"
      ],
      [
        "x^2+{b}x+{c}=0",
        {
          "r1": [
            1,
            5
          ],
          "r2": [
            1,
            5
          ],
          "b": [
            2,
            10
          ],
          "c": [
            1,
            25
          ]
        },
        "x^2+{b}x+{c}=0"
      ],
      [
        "x^2-{c}=0",
        {
          "k": [
            2,
            9
          ],
          "c": [
            4,
            81
          ]
        },
        "x^2-{c}=0"
      ],
      [
        "x^2-{r}x=0",
        {
          "r": [
            2,
            9
          ]
        },
        "x^2-{r}x=0"
      ],
      [
        "x^2+{r}x=0",
        {
          "r": [
            2,
            9
          ]
        },
        "x^2+{r}x=0"
      ],
      [
        "2x^2+{b}x+{c}=0",
        {
          "r1": [
            1,
            5
          ],
          "r2": [
            1,
            4
          ],
          "b": [
            -13,
            -3
          ],
          "c": [
            1,
            20
          ]
        },
        "2x^2+{b}x+{c}=0"
      ],
      [
        "x^2+{b}x={c}",
        {
          "r1": [
            2,
            6
          ],
          "r2": [
            1,
            5
          ],
          "b": [
            -5,
            5
          ],
          "c": [
            2,
            30
          ]
        },
        "x^2+{b}x={c}"
      ],
      [
        "x^2+{b}x+{c}=0",
        {
          "r": [
            2,
            6
          ],
          "b": [
            -12,
            -4
          ],
          "c": [
            4,
            36
          ]
        },
        "x^2+{b}x+{c}=0"
      ],
      [
        "2x^2-{c}=0",
        {
          "k": [
            1,
            5
          ],
          "c": [
            2,
            50
          ]
        },
        "2x^2-{c}=0"
      ]
    ]
  },
  {
    "id": "inequalities-linear",
    "cs": "Lineární nerovnice",
    "en": "Linear inequalities",
    "prereq": [
      "quadratic-eq"
    ],
    "topic": "funkce",
    "auto": false,
    "free": false,
    "kw": [
      [
        "nerovnost",
        "interval",
        "záporné číslo"
      ],
      [
        "inequality",
        "interval"
      ]
    ],
    "templates": [
      [
        "{a}x+{b}<{c}",
        {
          "a": [
            2,
            7
          ],
          "b": [
            1,
            9
          ],
          "c": [
            12,
            40
          ]
        },
        "{a}x+{b}<{c}"
      ],
      [
        "{a}-{b}x>={c}",
        {
          "a": [
            10,
            30
          ],
          "b": [
            2,
            5
          ],
          "c": [
            -8,
            4
          ]
        },
        "{a}-{b}x>={c}"
      ],
      [
        "{a}(x-{b})<={c}",
        {
          "a": [
            2,
            6
          ],
          "b": [
            1,
            6
          ],
          "c": [
            4,
            30
          ]
        },
        "{a}(x-{b})<={c}"
      ],
      [
        "{a}x-{b}>{c}",
        {
          "a": [
            2,
            8
          ],
          "b": [
            2,
            10
          ],
          "c": [
            10,
            30
          ]
        },
        "{a}x-{b}>{c}"
      ],
      [
        "{b}x+{c}<={a}x",
        {
          "a": [
            5,
            9
          ],
          "b": [
            2,
            4
          ],
          "c": [
            10,
            25
          ]
        },
        "{b}x+{c}<={a}x"
      ],
      [
        "(x+{a})/{b}>{c}",
        {
          "a": [
            1,
            8
          ],
          "b": [
            2,
            6
          ],
          "c": [
            2,
            7
          ]
        },
        "(x+{a})/{b}>{c}"
      ],
      [
        "{a}(x+{b})>{c}(x-1)",
        {
          "a": [
            4,
            7
          ],
          "b": [
            1,
            4
          ],
          "c": [
            2,
            3
          ]
        },
        "{a}(x+{b})>{c}(x-1)"
      ],
      [
        "{a}-x<{b}",
        {
          "a": [
            5,
            15
          ],
          "b": [
            10,
            25
          ]
        },
        "{a}-x<{b}"
      ]
    ]
  },
  {
    "id": "abs-equations",
    "cs": "Rovnice s absolutní hodnotou",
    "en": "Equations with absolute value",
    "prereq": [
      "quadratic-eq"
    ],
    "topic": "funkce",
    "auto": false,
    "kw": [
      [
        "absolutní hodnota",
        "modul"
      ],
      [
        "absolute value",
        "modulus"
      ]
    ],
    "templates": [
      [
        "Řeš rovnici s absolutní hodnotou: |x-{a}|={b}",
        {
          "a": [
            1,
            9
          ],
          "b": [
            1,
            8
          ]
        },
        "Solve the equation with absolute value: |x-{a}|={b}"
      ],
      [
        "Řeš: |{a}x+{b}|={c}",
        {
          "a": [
            2,
            4
          ],
          "b": [
            1,
            6
          ],
          "c": [
            3,
            12
          ]
        },
        "Solve: |{a}x+{b}|={c}"
      ],
      [
        "Řeš nerovnici: |x+{a}|<{b}",
        {
          "a": [
            1,
            6
          ],
          "b": [
            2,
            9
          ]
        },
        "Solve the inequality: |x+{a}|<{b}"
      ],
      [
        "Řeš: |x-{a}|={b}x",
        {
          "a": [
            2,
            8
          ],
          "b": [
            2,
            4
          ]
        },
        "Solve: |x-{a}|={b}x"
      ],
      [
        "Řeš nerovnici: |x-{a}|>={b}",
        {
          "a": [
            1,
            8
          ],
          "b": [
            2,
            6
          ]
        },
        "Solve the inequality: |x-{a}|>={b}"
      ],
      [
        "Řeš: |2x-{a}|={b}",
        {
          "a": [
            2,
            8
          ],
          "b": [
            4,
            12
          ]
        },
        "Solve: |2x-{a}|={b}"
      ],
      [
        "Urči všechna x splňující: |x|={a}",
        {
          "a": [
            3,
            15
          ]
        },
        "Find all x satisfying: |x|={a}"
      ],
      [
        "Řeš: |x+{a}|+|x-{b}|={c}",
        {
          "a": [
            1,
            3
          ],
          "b": [
            2,
            5
          ],
          "c": [
            8,
            14
          ]
        },
        "Solve: |x+{a}|+|x-{b}|={c}"
      ]
    ]
  },
  {
    "id": "functions-graphs",
    "cs": "Funkce, definiční obor a graf",
    "en": "Functions, domain and graph",
    "prereq": [
      "quadratic-eq"
    ],
    "topic": "funkce",
    "auto": false,
    "kw": [
      [
        "lineární funkce",
        "graf",
        "definiční obor",
        "obor hodnot"
      ],
      [
        "function",
        "graph",
        "domain",
        "range"
      ]
    ],
    "templates": [
      [
        "Lineární funkce má rovnici y={a}x+{b}. Najdi průsečíky grafu s osami.",
        {
          "a": [
            1,
            6
          ],
          "b": [
            -8,
            8
          ]
        },
        "A linear function has equation y={a}x+{b}. Find the intercepts with coordinate axes."
      ],
      [
        "Urči definiční obor funkce f(x)=1/(x-{a}).",
        {
          "a": [
            1,
            9
          ]
        },
        "Find the domain of function f(x)=1/(x-{a})."
      ],
      [
        "Funkce f(x)=x^2-{a}. Urči f({b}) a nuly funkce.",
        {
          "a": [
            1,
            16
          ],
          "b": [
            1,
            6
          ]
        },
        "Function f(x)=x^2-{a}. Find f({b}) and the zeros of the function."
      ],
      [
        "Urči definiční obor funkce f(x)=odmocnina(x-{a}).",
        {
          "a": [
            1,
            10
          ]
        },
        "Find the domain of function f(x)=sqrt(x-{a})."
      ],
      [
        "Lineární funkce prochází body (0, {a}) a (1, {b}). Urči její směrnici.",
        {
          "a": [
            1,
            5
          ],
          "b": [
            6,
            12
          ]
        },
        "A linear function passes through (0, {a}) and (1, {b}). Find its slope."
      ],
      [
        "Najdi vrchol paraboly y=(x-{a})^2+{b}.",
        {
          "a": [
            1,
            5
          ],
          "b": [
            -5,
            5
          ]
        },
        "Find the vertex of parabola y=(x-{a})^2+{b}."
      ],
      [
        "Urči definiční obor funkce f(x)=1/(x^2-{a}).",
        {
          "a": [
            4,
            25
          ]
        },
        "Find the domain of function f(x)=1/(x^2-{a})."
      ],
      [
        "Rozhodni, zda je funkce f(x)={a}x sudá nebo lichá.",
        {
          "a": [
            2,
            8
          ]
        },
        "Determine whether function f(x)={a}x is even or odd."
      ]
    ]
  }
]);

topic("posloupnosti-a-finance", "Posloupnosti a finanční matematika", "Sequences and finance", [
  {
    "id": "arith-seq",
    "cs": "Aritmetická posloupnost",
    "en": "Arithmetic sequence",
    "prereq": [],
    "topic": "posloupnosti-a-finance",
    "auto": false,
    "kw": [
      [
        "posloupnost",
        "diference",
        "člen"
      ],
      [
        "sequence",
        "difference"
      ]
    ],
    "levels": [
      2,
      3,
      4
    ],
    "templates": [
      [
        "Aritmetická posloupnost má první člen {a} a diferenci {b}. Urči desátý člen.",
        {
          "a": [
            1,
            9
          ],
          "b": [
            2,
            7
          ]
        },
        "An arithmetic sequence has first term {a} and difference {b}. Find the tenth term."
      ],
      [
        "V aritmetické posloupnosti je a_3={a} a a_7={b}. Urči diferenci a první člen.",
        {
          "a": [
            5,
            15
          ],
          "b": [
            25,
            45
          ]
        },
        "In an arithmetic sequence, a_3={a} and a_7={b}. Find the difference and the first term."
      ],
      [
        "Urči součet prvních {a} členů aritmetické posloupnosti 2, 5, 8, …",
        {
          "a": [
            6,
            20
          ]
        },
        "Find the sum of the first {a} terms of the arithmetic sequence 2, 5, 8, …"
      ],
      [
        "Aritmetická posloupnost má a_1={a} a d={b}. Urči pátý člen.",
        {
          "a": [
            2,
            10
          ],
          "b": [
            3,
            8
          ]
        },
        "An arithmetic sequence has a_1={a} and d={b}. Find the fifth term."
      ],
      [
        "V posloupnosti s a_1={a} a d={b} urči dvacátý člen.",
        {
          "a": [
            1,
            5
          ],
          "b": [
            2,
            6
          ]
        },
        "In a sequence with a_1={a} and d={b}, find the twentieth term."
      ],
      [
        "Který člen aritmetické posloupnosti 3, 7, 11, … je roven {a}?",
        {
          "a": [
            35,
            75
          ]
        },
        "Which term of the arithmetic sequence 3, 7, 11, … is equal to {a}?"
      ],
      [
        "Urči součet prvních {a} členů posloupnosti s a_1={b} a d={d}.",
        {
          "a": [
            5,
            12
          ],
          "b": [
            1,
            5
          ],
          "d": [
            2,
            5
          ]
        },
        "Find the sum of the first {a} terms of a sequence with a_1={b} and d={d}."
      ],
      [
        "Urči diferenci posloupnosti, kde a_1={a} a a_2={b}.",
        {
          "a": [
            3,
            9
          ],
          "b": [
            12,
            20
          ]
        },
        "Find the difference of a sequence where a_1={a} and a_2={b}."
      ]
    ]
  },
  {
    "id": "geom-seq",
    "cs": "Geometrická posloupnost",
    "en": "Geometric sequence",
    "prereq": [
      "arith-seq"
    ],
    "topic": "posloupnosti-a-finance",
    "auto": false,
    "kw": [
      [
        "kvocient",
        "geometrická"
      ],
      [
        "ratio",
        "geometric"
      ]
    ],
    "templates": [
      [
        "Geometrická posloupnost má první člen {a} a kvocient 2. Urči pátý člen.",
        {
          "a": [
            1,
            6
          ]
        },
        "A geometric sequence has first term {a} and common ratio 2. Find the fifth term."
      ],
      [
        "V geometrické posloupnosti je a_2={a} a a_4={b}. Urči kvocient (kladný).",
        {
          "a": [
            2,
            6
          ],
          "b": [
            32,
            96
          ]
        },
        "In a geometric sequence, a_2={a} and a_4={b}. Find the common ratio (positive)."
      ],
      [
        "Urči součet prvních {a} členů posloupnosti 1, 2, 4, 8, …",
        {
          "a": [
            4,
            9
          ]
        },
        "Find the sum of the first {a} terms of the sequence 1, 2, 4, 8, …"
      ],
      [
        "Geometrická posloupnost má a_1={a} a q=2. Urči čtvrtý člen.",
        {
          "a": [
            2,
            8
          ]
        },
        "A geometric sequence has a_1={a} and q=2. Find the fourth term."
      ],
      [
        "Urči člen a_3 posloupnosti s a_1={a} a q=3.",
        {
          "a": [
            1,
            5
          ],
          "b": [
            2,
            2
          ]
        },
        "Find term a_3 of a sequence with a_1={a} and q=3."
      ],
      [
        "Posloupnost {a}, {b}, … je geometrická. Urči kvocient q.",
        {
          "a": [
            2,
            6
          ],
          "b": [
            8,
            24
          ]
        },
        "The sequence {a}, {b}, … is geometric. Find the common ratio q."
      ],
      [
        "Urči součet geometrické řady 1 + 1/2 + 1/4 + …",
        null,
        "Find the sum of the infinite geometric series 1 + 1/2 + 1/4 + …"
      ],
      [
        "Urči čtvrtý člen geometrické posloupnosti s a_1={a} a q=3.",
        {
          "a": [
            1,
            4
          ]
        },
        "Find the fourth term of a geometric sequence with a_1={a} and q=3."
      ]
    ]
  },
  {
    "id": "finance-interest",
    "cs": "Úroky a spoření",
    "en": "Interest and savings",
    "prereq": [
      "arith-seq"
    ],
    "topic": "posloupnosti-a-finance",
    "auto": false,
    "kw": [
      [
        "úrok",
        "spoření",
        "půjčka",
        "složené úročení"
      ],
      [
        "interest",
        "savings",
        "loan",
        "compound"
      ]
    ],
    "templates": [
      [
        "Na účet vložíš {a}000 Kč s ročním úrokem {b} %. Kolik budeš mít po roce (bez zdanění)?",
        {
          "a": [
            5,
            50
          ],
          "b": [
            2,
            6
          ]
        },
        "You deposit {a}000 CZK at an annual interest rate of {b} %. How much will you have after one year (before tax)?"
      ],
      [
        "Cena zboží {a} Kč se zvýšila o {b} % a pak snížila o {b} %. Jaká je nová cena?",
        {
          "a": [
            200,
            900
          ],
          "b": [
            10,
            30
          ]
        },
        "The price of goods {a} CZK increased by {b} % and then decreased by {b} %. What is the new price?"
      ],
      [
        "Vklad {a}000 Kč se {b} roky úročí ročně {c} % složeně. Napiš výraz pro konečnou částku.",
        {
          "a": [
            10,
            40
          ],
          "b": [
            2,
            4
          ],
          "c": [
            2,
            5
          ]
        },
        "A deposit of {a}000 CZK earns compound interest at {c} % annually for {b} years. Write an expression for the final amount."
      ],
      [
        "Jaký je roční úrok v Kč z vkladu {a}000 Kč při sazbě {b} % p.a.?",
        {
          "a": [
            10,
            60
          ],
          "b": [
            2,
            5
          ]
        },
        "What is the annual interest in CZK on a deposit of {a}000 CZK at rate {b} % p.a.?"
      ],
      [
        "Půjčka {a}000 Kč má úrok {b} % p.a. Kolik činí úrok za půl roku?",
        {
          "a": [
            10,
            50
          ],
          "b": [
            4,
            10
          ]
        },
        "A loan of {a}000 CZK has interest rate {b} % p.a. How much is the interest for half a year?"
      ],
      [
        "Investice vzrostla z {a}000 Kč na {b}000 Kč. O kolik procent vzrostla?",
        {
          "a": [
            10,
            20
          ],
          "b": [
            25,
            40
          ]
        },
        "An investment grew from {a}000 CZK to {b}000 CZK. By what percentage did it grow?"
      ],
      [
        "Spoření s vkladem {a}000 Kč po 2 letech při {b} % složeném úroku přinese kolik Kč celkem?",
        {
          "a": [
            10,
            50
          ],
          "b": [
            3,
            8
          ]
        },
        "A savings deposit of {a}000 CZK after 2 years at {b} % compound interest yields what total in CZK?"
      ],
      [
        "Výrobek stojí {a} Kč bez DPH. Kolik stojí s DPH {b} %?",
        {
          "a": [
            100,
            800
          ],
          "b": [
            12,
            21
          ]
        },
        "A product costs {a} CZK without VAT. What is its cost with {b} % VAT?"
      ]
    ]
  }
]);

topic("goniometrie", "Goniometrie a trigonometrie", "Trigonometry", [
  {
    "id": "trig-right-triangle",
    "cs": "Funkce sin, cos, tg v pravoúhlém trojúhelníku",
    "en": "Sine, cosine, tangent in a right triangle",
    "prereq": [],
    "topic": "goniometrie",
    "auto": false,
    "kw": [
      [
        "sinus",
        "kosinus",
        "tangens",
        "goniometrie"
      ],
      [
        "sine",
        "cosine",
        "tangent",
        "trigonometry"
      ]
    ],
    "templates": [
      [
        "V pravoúhlém trojúhelníku je přepona {a} cm a úhel α={b}°. Urči protilehlou odvěsnu.",
        {
          "a": [
            6,
            20
          ],
          "b": [
            20,
            70
          ]
        },
        "In a right triangle, the hypotenuse is {a} cm and angle α={b}°. Find the opposite leg."
      ],
      [
        "Žebřík dlouhý {a} m je opřen o zeď pod úhlem {b}° k zemi. Do jaké výšky sahá?",
        {
          "a": [
            3,
            8
          ],
          "b": [
            55,
            75
          ]
        },
        "A ladder {a} m long leans against a wall at angle {b}° to the ground. What height does it reach?"
      ],
      [
        "Odvěsny pravoúhlého trojúhelníku jsou {a} cm a {b} cm. Urči velikost většího ostrého úhlu.",
        {
          "a": [
            3,
            9
          ],
          "b": [
            10,
            20
          ]
        },
        "The legs of a right triangle are {a} cm and {b} cm. Determine the larger acute angle."
      ],
      [
        "V pravoúhlém trojúhelníku s přeponou {a} cm a úhlem 30° urči protilehlou odvěsnu.",
        {
          "a": [
            6,
            24
          ]
        },
        "In a right triangle with hypotenuse {a} cm and angle 30°, find the opposite leg."
      ],
      [
        "Urči hodnotu tg(45°) + sin(90°) + {a}.",
        {
          "a": [
            1,
            8
          ]
        },
        "Find the value of tan(45°) + sin(90°) + {a}."
      ],
      [
        "V pravoúhlém trojúhelníku je přilehlá odvěsna {a} cm a přepona {b} cm. Urči cos(α).",
        {
          "a": [
            3,
            8
          ],
          "b": [
            9,
            15
          ]
        },
        "In a right triangle, the adjacent leg is {a} cm and hypotenuse is {b} cm. Find cos(α)."
      ],
      [
        "Stožár vrhá stín délky {a} m při úhlu slunce {b}° nad obzorem. Jak je stožár vysoký?",
        {
          "a": [
            5,
            20
          ],
          "b": [
            30,
            60
          ]
        },
        "A pole casts a shadow of length {a} m when the sun is at {b}° above the horizon. How tall is the pole?"
      ],
      [
        "Vypočítej délku přepony, je-li protilehlá odvěsna {a} cm a sin(α)=0,5.",
        {
          "a": [
            4,
            12
          ]
        },
        "Calculate the hypotenuse length if opposite leg is {a} cm and sin(α)=0.5."
      ]
    ]
  },
  {
    "id": "trig-equations",
    "cs": "Goniometrické rovnice a vzorce",
    "en": "Trigonometric equations and identities",
    "prereq": [
      "trig-right-triangle"
    ],
    "topic": "goniometrie",
    "auto": false,
    "kw": [
      [
        "jednotková kružnice",
        "radián"
      ],
      [
        "unit circle",
        "radian"
      ]
    ],
    "templates": [
      [
        "Řeš v intervalu <0°; 360°): sin x = 1/2",
        null,
        "Solve in interval [0°, 360°): sin x = 1/2"
      ],
      [
        "Převeď {a}° na radiány.",
        {
          "a": [
            30,
            330
          ]
        },
        "Convert {a}° to radians."
      ],
      [
        "Zjednoduš výraz: sin^2 x + cos^2 x + {a}",
        {
          "a": [
            1,
            9
          ]
        },
        "Simplify the expression: sin^2 x + cos^2 x + {a}"
      ],
      [
        "Řeš v intervalu <0°; 360°): cos x = 1/2",
        null,
        "Solve in interval [0°, 360°): cos x = 1/2"
      ],
      [
        "Převeď úhel π/{a} rad na stupně.",
        {
          "a": [
            2,
            6
          ]
        },
        "Convert angle π/{a} rad to degrees."
      ],
      [
        "Zjednoduš: 2*sin(x)*cos(x) podle vzorce.",
        null,
        "Simplify: 2*sin(x)*cos(x) using identity."
      ],
      [
        "Urči hodnotu cos(0) + sin(π/2) + {a}.",
        {
          "a": [
            1,
            6
          ]
        },
        "Find value of cos(0) + sin(π/2) + {a}."
      ],
      [
        "Řeš v intervalu <0; 2π): tg x = 1",
        null,
        "Solve in interval [0, 2π): tan x = 1"
      ]
    ]
  }
]);

topic("kombinatorika-pravdepodobnost", "Kombinatorika a pravděpodobnost", "Combinatorics and probability", [
  {
    "id": "comb-formulas",
    "cs": "Variace, permutace a kombinace",
    "en": "Permutations and combinations",
    "prereq": [],
    "topic": "kombinatorika-pravdepodobnost",
    "auto": false,
    "kw": [
      [
        "variace",
        "kombinační číslo",
        "faktoriál"
      ],
      [
        "permutation",
        "combination",
        "factorial"
      ]
    ],
    "templates": [
      [
        "Kolika způsoby lze z {a} lidí vybrat dvoučlenný výbor?",
        {
          "a": [
            6,
            12
          ]
        },
        "In how many ways can a committee of 2 be chosen from {a} people?"
      ],
      [
        "Kolik různých čtyřciferných čísel lze složit z číslic 1–{a}, když se číslice neopakují?",
        {
          "a": [
            5,
            9
          ]
        },
        "How many different 4-digit numbers can be formed from digits 1–{a} without repetition?"
      ],
      [
        "Vypočítej kombinační číslo C({a}, {b}).",
        {
          "a": [
            6,
            10
          ],
          "b": [
            2,
            4
          ]
        },
        "Compute the combination number C({a}, {b})."
      ],
      [
        "Kolika způsoby lze seřadit {a} běžců na startu?",
        {
          "a": [
            3,
            6
          ]
        },
        "In how many ways can {a} runners be lined up at the start?"
      ],
      [
        "Vypočítej hodnotu {a}! / ({a}-2)!.",
        {
          "a": [
            4,
            9
          ]
        },
        "Compute the value of {a}! / ({a}-2)!."
      ],
      [
        "Kolika způsoby lze vybrat kytici 3 květin z {a} různých druhů?",
        {
          "a": [
            5,
            10
          ]
        },
        "In how many ways can a bouquet of 3 flowers be chosen from {a} different types?"
      ],
      [
        "Kolik různých pěticiferných kódů lze sestavit z číslic 0-9 s opakováním?",
        null,
        "How many different 5-digit codes can be formed from digits 0-9 with repetition?"
      ],
      [
        "Vypočítej C({a}, 2) + C({a}, 1).",
        {
          "a": [
            4,
            8
          ]
        },
        "Calculate C({a}, 2) + C({a}, 1)."
      ]
    ]
  },
  {
    "id": "probability-basic",
    "cs": "Klasická pravděpodobnost",
    "en": "Classical probability",
    "prereq": [
      "comb-formulas"
    ],
    "topic": "kombinatorika-pravdepodobnost",
    "auto": false,
    "kw": [
      [
        "pravděpodobnost",
        "náhoda",
        "kostka",
        "mince"
      ],
      [
        "probability",
        "dice",
        "coin"
      ]
    ],
    "templates": [
      [
        "Házíš standardní šestistěnnou kostkou. Jaká je pravděpodobnost, že padne číslo {a}?",
        {
          "a": [
            1,
            6
          ]
        },
        "You roll a standard 6-sided die. What is the probability of rolling {a}?"
      ],
      [
        "V pytlíku je {a} červených a {b} modrých kuliček. Jaká je pravděpodobnost, že náhodně vytažená je červená?",
        {
          "a": [
            2,
            9
          ],
          "b": [
            2,
            9
          ]
        },
        "A bag contains {a} red and {b} blue marbles. What is the probability of randomly drawing a red one?"
      ],
      [
        "Hodíš třikrát mincí. Jaká je pravděpodobnost, že padne právě {a} panna?",
        {
          "a": [
            1,
            3
          ]
        },
        "You flip a coin three times. What is the probability of getting exactly {a} heads?"
      ],
      [
        "V osudí je {a} bílých a {b} černých lístků. Jaká je pravděpodobnost vytažení černého lístku?",
        {
          "a": [
            3,
            8
          ],
          "b": [
            2,
            6
          ]
        },
        "An urn contains {a} white and {b} black tickets. What is the probability of drawing a black ticket?"
      ],
      [
        "Jaká je pravděpodobnost, že při hodu kostkou padne sudé číslo?",
        null,
        "What is the probability of rolling an even number on a die?"
      ],
      [
        "Z balíčku 32 karet náhodně vytáhneš jednu kartu. Jaká je pravděpodobnost, že je to eso?",
        null,
        "From a deck of 32 cards, you draw one card at random. What is the probability that it is an ace?"
      ],
      [
        "Při hodu dvěma kostkami jaká je pravděpodobnost, že součet bude {a}?",
        {
          "a": [
            3,
            9
          ]
        },
        "When rolling two dice, what is the probability that the sum is {a}?"
      ],
      [
        "V tombole je 10 lístků a z toho {a} vyhrává. Jaká je pravděpodobnost výhry při koupi 1 lístku?",
        {
          "a": [
            1,
            5
          ]
        },
        "A raffle has 10 tickets, of which {a} win. What is the probability of winning with 1 ticket?"
      ]
    ]
  }
]);

topic("va-limity", "Limity a spojitost", "Limits and continuity", [
  {
    "id": "limit-sequence",
    "cs": "Limita posloupnosti",
    "en": "Limit of a sequence",
    "prereq": [],
    "topic": "va-limity",
    "auto": false,
    "kw": [
      [
        "limita",
        "konvergence",
        "posloupnost"
      ],
      [
        "limit",
        "convergence",
        "sequence"
      ]
    ],
    "templates": [
      [
        "Vypočítej limitu posloupnosti lim (n→∞) ({a}n+{b})/(n+{c}).",
        {
          "a": [
            1,
            6
          ],
          "b": [
            1,
            9
          ],
          "c": [
            1,
            9
          ]
        },
        "Compute the limit of the sequence lim (n->inf) ({a}n+{b})/(n+{c})."
      ],
      [
        "Vypočítej lim (n→∞) (n^2+{a})/({b}n^2+n).",
        {
          "a": [
            1,
            9
          ],
          "b": [
            1,
            5
          ]
        },
        "Compute lim (n->inf) (n^2+{a})/({b}n^2+n)."
      ],
      [
        "Rozhodni, zda posloupnost a_n = (-1)^n + 1/n konverguje, a zdůvodni.",
        null,
        "Determine whether the sequence a_n = (-1)^n + 1/n converges and justify."
      ],
      [
        "Vypočítej lim (n→∞) ({a}n^3-1)/(2n^3+{b}).",
        {
          "a": [
            2,
            8
          ],
          "b": [
            1,
            6
          ]
        },
        "Compute lim (n->inf) ({a}n^3-1)/(2n^3+{b})."
      ],
      [
        "Vypočítej lim (n→∞) (1 + {a}/n)^n.",
        {
          "a": [
            1,
            5
          ]
        },
        "Compute lim (n->inf) (1 + {a}/n)^n."
      ],
      [
        "Urči limitu lim (n→∞) (sqrt(n+{a}) - sqrt(n)).",
        {
          "a": [
            1,
            6
          ]
        },
        "Determine the limit lim (n->inf) (sqrt(n+{a}) - sqrt(n))."
      ],
      [
        "Vypočítej lim (n→∞) ({a}^n + 1)/({a}^n - 1).",
        {
          "a": [
            2,
            5
          ]
        },
        "Compute lim (n->inf) ({a}^n + 1)/({a}^n - 1)."
      ],
      [
        "Rozhodni o konvergenci posloupnosti a_n = (n+{a})/(n^2+1).",
        {
          "a": [
            1,
            8
          ]
        },
        "Determine convergence of sequence a_n = (n+{a})/(n^2+1)."
      ]
    ]
  },
  {
    "id": "limit-function",
    "cs": "Limita funkce",
    "en": "Limit of a function",
    "prereq": [
      "limit-sequence"
    ],
    "topic": "va-limity",
    "auto": false,
    "kw": [
      [
        "limita funkce",
        "neurčitý výraz",
        "l'hospital"
      ],
      [
        "limit of a function",
        "indeterminate",
        "l'hospital"
      ]
    ],
    "templates": [
      [
        "Vypočítej lim (x→{a}) (x^2-{a}^2)/(x-{a}).",
        {
          "a": [
            1,
            9
          ]
        },
        "Compute lim (x->{a}) (x^2-{a}^2)/(x-{a})."
      ],
      [
        "Vypočítej lim (x→0) sin({a}x)/x.",
        {
          "a": [
            2,
            7
          ]
        },
        "Compute lim (x->0) sin({a}x)/x."
      ],
      [
        "Vypočítej lim (x→∞) (x^2+{a}x)/(2x^2-{b}).",
        {
          "a": [
            1,
            9
          ],
          "b": [
            1,
            9
          ]
        },
        "Compute lim (x->inf) (x^2+{a}x)/(2x^2-{b})."
      ],
      [
        "Vypočítej lim (x→0) (e^{a}x - 1)/x.",
        {
          "a": [
            2,
            6
          ]
        },
        "Compute lim (x->0) (e^{a}x - 1)/x."
      ],
      [
        "Vypočítej lim (x→{a}) (x-{a})/(sqrt(x) - sqrt({a})).",
        {
          "a": [
            1,
            9
          ]
        },
        "Compute lim (x->{a}) (x-{a})/(sqrt(x) - sqrt({a}))."
      ],
      [
        "Vypočítej lim (x→0) (1 - cos({a}x))/x^2.",
        {
          "a": [
            1,
            4
          ]
        },
        "Compute lim (x->0) (1 - cos({a}x))/x^2."
      ],
      [
        "Vypočítej lim (x→∞) ({a}x+1)/({b}x-3).",
        {
          "a": [
            2,
            8
          ],
          "b": [
            2,
            6
          ]
        },
        "Compute lim (x->inf) ({a}x+1)/({b}x-3)."
      ],
      [
        "Vypočítej jednostrannou limitu lim (x→{a}+) 1/(x-{a}).",
        {
          "a": [
            1,
            5
          ]
        },
        "Compute one-sided limit lim (x->{a}+) 1/(x-{a})."
      ]
    ]
  }
]);

topic("va-derivace", "Derivace", "Derivatives", [
  {
    "id": "derivative-basic",
    "cs": "Derivace elementárních funkcí",
    "en": "Derivatives of elementary functions",
    "prereq": [
      "limit-function"
    ],
    "topic": "va-derivace",
    "auto": false,
    "kw": [
      [
        "derivace",
        "derivovat",
        "tečna"
      ],
      [
        "derivative",
        "differentiate",
        "tangent"
      ]
    ],
    "templates": [
      [
        "Zderivuj funkci f(x)=x^{a}+{b}x.",
        {
          "a": [
            2,
            7
          ],
          "b": [
            1,
            9
          ]
        },
        "Differentiate the function f(x)=x^{a}+{b}x."
      ],
      [
        "Zderivuj f(x)={a}e^x+sin x.",
        {
          "a": [
            2,
            9
          ]
        },
        "Differentiate f(x)={a}e^x+sin x."
      ],
      [
        "Najdi rovnici tečny ke grafu f(x)=x^2 v bodě x={a}.",
        {
          "a": [
            1,
            6
          ]
        },
        "Find the equation of the tangent line to f(x)=x^2 at x={a}."
      ],
      [
        "Zderivuj funkci f(x)=cos(x) - {a}x^3.",
        {
          "a": [
            2,
            6
          ]
        },
        "Differentiate f(x)=cos(x) - {a}x^3."
      ],
      [
        "Zderivuj f(x)=ln(x) + {a}x.",
        {
          "a": [
            1,
            8
          ]
        },
        "Differentiate f(x)=ln(x) + {a}x."
      ],
      [
        "Vypočítej derivaci f'(1) pro f(x)=x^4 + {a}x^2.",
        {
          "a": [
            1,
            5
          ]
        },
        "Calculate derivative f'(1) for f(x)=x^4 + {a}x^2."
      ],
      [
        "Zderivuj funkci f(x)=1/x + {a}x.",
        {
          "a": [
            2,
            7
          ]
        },
        "Differentiate function f(x)=1/x + {a}x."
      ],
      [
        "Zderivuj f(x)=sqrt(x) + {a}e^x.",
        {
          "a": [
            1,
            5
          ]
        },
        "Differentiate f(x)=sqrt(x) + {a}e^x."
      ]
    ]
  },
  {
    "id": "derivative-rules",
    "cs": "Pravidla derivování (součin, podíl, složená funkce)",
    "en": "Differentiation rules",
    "prereq": [
      "derivative-basic"
    ],
    "topic": "va-derivace",
    "auto": false,
    "kw": [
      [
        "řetízkové pravidlo",
        "součin",
        "podíl"
      ],
      [
        "chain rule",
        "product rule",
        "quotient rule"
      ]
    ],
    "templates": [
      [
        "Zderivuj f(x)=x^{a}·e^x.",
        {
          "a": [
            2,
            5
          ]
        },
        "Differentiate f(x)=x^{a}*e^x."
      ],
      [
        "Zderivuj f(x)=(x^2+{a})/(x-1).",
        {
          "a": [
            1,
            9
          ]
        },
        "Differentiate f(x)=(x^2+{a})/(x-1)."
      ],
      [
        "Zderivuj f(x)=sin({a}x^2).",
        {
          "a": [
            2,
            6
          ]
        },
        "Differentiate f(x)=sin({a}x^2)."
      ],
      [
        "Zderivuj f(x)=e^{{a}x}·cos(x).",
        {
          "a": [
            2,
            5
          ]
        },
        "Differentiate f(x)=e^({a}x)*cos(x)."
      ],
      [
        "Zderivuj f(x)=ln(x^2 + {a}).",
        {
          "a": [
            1,
            8
          ]
        },
        "Differentiate f(x)=ln(x^2 + {a})."
      ],
      [
        "Zderivuj f(x)=(x+{a})/(x+{b}).",
        {
          "a": [
            1,
            5
          ],
          "b": [
            6,
            10
          ]
        },
        "Differentiate f(x)=(x+{a})/(x+{b})."
      ],
      [
        "Zderivuj f(x)=(x^3 + {a})^{b}.",
        {
          "a": [
            1,
            4
          ],
          "b": [
            2,
            4
          ]
        },
        "Differentiate f(x)=(x^3 + {a})^{b}."
      ],
      [
        "Zderivuj f(x)=x·ln(x).",
        null,
        "Differentiate f(x)=x*ln(x)."
      ]
    ]
  },
  {
    "id": "derivative-apps",
    "cs": "Extrémy a průběh funkce",
    "en": "Extrema and curve sketching",
    "prereq": [
      "derivative-rules"
    ],
    "topic": "va-derivace",
    "auto": false,
    "kw": [
      [
        "extrém",
        "monotonie",
        "konvexita",
        "inflexní bod"
      ],
      [
        "extremum",
        "monotonic",
        "convex",
        "inflection"
      ]
    ],
    "templates": [
      [
        "Najdi lokální extrémy funkce f(x)=x^3-{a}x.",
        {
          "a": [
            3,
            12
          ]
        },
        "Find local extrema of the function f(x)=x^3-{a}x."
      ],
      [
        "Najdi intervaly monotonie funkce f(x)=x^2-{a}x+{b}.",
        {
          "a": [
            2,
            8
          ],
          "b": [
            1,
            9
          ]
        },
        "Find intervals of monotonicity for f(x)=x^2-{a}x+{b}."
      ],
      [
        "Z drátu délky {a} m ohneme obdélník. Jaké rozměry dají největší obsah?",
        {
          "a": [
            20,
            60
          ]
        },
        "From a wire of length {a} m we form a rectangle. What dimensions yield maximum area?"
      ],
      [
        "Najdi stacionární body funkce f(x)=x^3 - 3x + {a}.",
        {
          "a": [
            1,
            8
          ]
        },
        "Find stationary points of function f(x)=x^3 - 3x + {a}."
      ],
      [
        "Urči intervaly konvexity funkce f(x)=x^3 + {a}x.",
        {
          "a": [
            1,
            6
          ]
        },
        "Find intervals of convexity for f(x)=x^3 + {a}x."
      ],
      [
        "Najdi inflexní body funkce f(x)=x^3 - {a}x^2.",
        {
          "a": [
            3,
            9
          ]
        },
        "Find inflection points of function f(x)=x^3 - {a}x^2."
      ],
      [
        "Urči globální maximum funkce f(x)=-x^2 + {a}x na intervalu [0, {a}].",
        {
          "a": [
            4,
            10
          ]
        },
        "Find global maximum of f(x)=-x^2 + {a}x on interval [0, {a}]."
      ],
      [
        "Urči asymptoty se směrnicí pro funkci f(x)=(x^2+{a})/x.",
        {
          "a": [
            1,
            5
          ]
        },
        "Find oblique asymptotes for function f(x)=(x^2+{a})/x."
      ]
    ]
  }
]);

topic("va-integraly", "Integrály", "Integrals", [
  {
    "id": "integral-basic",
    "cs": "Neurčitý integrál",
    "en": "Indefinite integral",
    "prereq": [
      "derivative-basic"
    ],
    "topic": "va-integraly",
    "auto": false,
    "kw": [
      [
        "integrál",
        "primitivní funkce",
        "integrovat"
      ],
      [
        "integral",
        "antiderivative",
        "integrate"
      ]
    ],
    "templates": [
      [
        "Vypočítej ∫ (x^{a}+{b}) dx.",
        {
          "a": [
            2,
            6
          ],
          "b": [
            1,
            9
          ]
        },
        "Compute ∫ (x^{a}+{b}) dx."
      ],
      [
        "Vypočítej ∫ {a}e^x dx.",
        {
          "a": [
            2,
            9
          ]
        },
        "Compute ∫ {a}e^x dx."
      ],
      [
        "Vypočítej ∫ (1/x + {a}cos x) dx.",
        {
          "a": [
            1,
            9
          ]
        },
        "Compute ∫ (1/x + {a}cos x) dx."
      ],
      [
        "Vypočítej ∫ ({a}x^2 - {b}x + 1) dx.",
        {
          "a": [
            3,
            9
          ],
          "b": [
            2,
            6
          ]
        },
        "Compute ∫ ({a}x^2 - {b}x + 1) dx."
      ],
      [
        "Vypočítej ∫ sin({a}x) dx.",
        {
          "a": [
            2,
            6
          ]
        },
        "Compute ∫ sin({a}x) dx."
      ],
      [
        "Vypočítej ∫ 1/(x + {a}) dx.",
        {
          "a": [
            1,
            8
          ]
        },
        "Compute ∫ 1/(x + {a}) dx."
      ],
      [
        "Vypočítej ∫ ({a}/x^2) dx.",
        {
          "a": [
            2,
            8
          ]
        },
        "Compute ∫ ({a}/x^2) dx."
      ],
      [
        "Vypočítej ∫ e^{{a}x} dx.",
        {
          "a": [
            2,
            7
          ]
        },
        "Compute ∫ e^{{a}x} dx."
      ]
    ]
  },
  {
    "id": "integral-methods",
    "cs": "Per partes a substituce",
    "en": "Integration by parts and substitution",
    "prereq": [
      "integral-basic",
      "derivative-rules"
    ],
    "topic": "va-integraly",
    "auto": false,
    "kw": [
      [
        "per partes",
        "substituce"
      ],
      [
        "integration by parts",
        "substitution"
      ]
    ],
    "templates": [
      [
        "Vypočítej ∫ x·e^x dx metodou per partes.",
        null,
        "Compute ∫ x*e^x dx by parts."
      ],
      [
        "Vypočítej ∫ {a}x·(x^2+1)^{b} dx substitucí.",
        {
          "a": [
            1,
            6
          ],
          "b": [
            2,
            4
          ]
        },
        "Compute ∫ {a}x*(x^2+1)^{b} dx by substitution."
      ],
      [
        "Vypočítej ∫ x·sin x dx.",
        null,
        "Compute ∫ x*sin x dx."
      ],
      [
        "Vypočítej ∫ ln(x) dx metodou per partes.",
        null,
        "Compute ∫ ln(x) dx by parts."
      ],
      [
        "Vypočítej ∫ x/(x^2 + {a}) dx.",
        {
          "a": [
            1,
            9
          ]
        },
        "Compute ∫ x/(x^2 + {a}) dx."
      ],
      [
        "Vypočítej ∫ x·cos(x) dx metodou per partes.",
        null,
        "Compute ∫ x*cos(x) dx by parts."
      ],
      [
        "Vypočítej ∫ e^{x^2}·2x dx substitucí.",
        null,
        "Compute ∫ e^{x^2}*2x dx by substitution."
      ],
      [
        "Vypočítej ∫ x^2·ln(x) dx per partes.",
        null,
        "Compute ∫ x^2*ln(x) dx by parts."
      ]
    ]
  },
  {
    "id": "integral-definite",
    "cs": "Určitý integrál a plocha",
    "en": "Definite integral and area",
    "prereq": [
      "integral-basic"
    ],
    "topic": "va-integraly",
    "auto": false,
    "kw": [
      [
        "určitý integrál",
        "obsah",
        "plocha pod grafem"
      ],
      [
        "definite integral",
        "area under curve"
      ]
    ],
    "templates": [
      [
        "Vypočítej ∫ od 0 do {a} z x^2 dx.",
        {
          "a": [
            1,
            6
          ]
        },
        "Compute ∫ from 0 to {a} of x^2 dx."
      ],
      [
        "Urči obsah obrazce ohraničeného grafem y=x^2 a přímkou y={a}.",
        {
          "a": [
            1,
            9
          ]
        },
        "Find the area bounded by y=x^2 and the line y={a}."
      ],
      [
        "Vypočítej ∫ od 1 do {a} z (1/x) dx.",
        {
          "a": [
            2,
            9
          ]
        },
        "Compute ∫ from 1 to {a} of (1/x) dx."
      ],
      [
        "Vypočítej ∫ od 0 do 1 z ({a}x + {b}) dx.",
        {
          "a": [
            2,
            8
          ],
          "b": [
            1,
            6
          ]
        },
        "Compute ∫ from 0 to 1 of ({a}x + {b}) dx."
      ],
      [
        "Vypočítej ∫ od 0 do π z sin(x) dx.",
        null,
        "Compute ∫ from 0 to pi of sin(x) dx."
      ],
      [
        "Urči plochu pod křivkou y=x^3 na intervalu [0, {a}].",
        {
          "a": [
            1,
            4
          ]
        },
        "Find area under curve y=x^3 on [0, {a}]."
      ],
      [
        "Vypočítej ∫ od 0 do {a} z e^x dx.",
        {
          "a": [
            1,
            3
          ]
        },
        "Compute ∫ from 0 to {a} of e^x dx."
      ],
      [
        "Urči obsah plochy mezi křivkami y=x a y=x^2.",
        null,
        "Find the area between curves y=x and y=x^2."
      ]
    ]
  }
]);

topic("la-soustavy-matice", "Soustavy a matice", "Systems and matrices", [
  {
    "id": "gauss",
    "cs": "Gaussova eliminace",
    "en": "Gaussian elimination",
    "prereq": [],
    "topic": "la-soustavy-matice",
    "auto": false,
    "kw": [
      [
        "soustava rovnic",
        "gauss",
        "eliminace",
        "hodnost"
      ],
      [
        "linear system",
        "gauss",
        "elimination",
        "rank"
      ]
    ],
    "templates": [
      [
        "Vyřeš soustavu Gaussovou eliminací: x+y+z={a}, x-y+z={b}, 2x+y-z={c}.",
        {
          "a": [
            4,
            12
          ],
          "b": [
            0,
            6
          ],
          "c": [
            0,
            8
          ]
        },
        "Solve by Gaussian elimination: x+y+z={a}, x-y+z={b}, 2x+y-z={c}."
      ],
      [
        "Urči hodnost matice (1 2 3 | 2 4 6 | 1 0 {a}).",
        {
          "a": [
            1,
            6
          ]
        },
        "Find the rank of the matrix (1 2 3 | 2 4 6 | 1 0 {a})."
      ],
      [
        "Pro které t má soustava x+y=1, x+ty=2 právě jedno řešení?",
        null,
        "For which t does the system x+y=1, x+ty=2 have a unique solution?"
      ],
      [
        "Vyřeš soustavu: x+2y=3, 2x+4y={a}.",
        {
          "a": [
            4,
            8
          ]
        },
        "Solve the system: x+2y=3, 2x+4y={a}."
      ],
      [
        "Urči počet řešení soustavy: x+y+z=1, 2x+2y+2z={a}.",
        {
          "a": [
            2,
            5
          ]
        },
        "Find number of solutions: x+y+z=1, 2x+2y+2z={a}."
      ],
      [
        "Urči hodnost matice 2x2: ({a} 2 | 4 8).",
        {
          "a": [
            1,
            5
          ]
        },
        "Find the rank of the 2x2 matrix: ({a} 2 | 4 8)."
      ],
      [
        "Převeď matici (1 2 | 3 {a}) do odstupňovaného tvaru.",
        {
          "a": [
            4,
            10
          ]
        },
        "Transform matrix (1 2 | 3 {a}) to row echelon form."
      ],
      [
        "Vyřeš soustavu s parametrem p: px + y = 1, x + py = 1.",
        null,
        "Solve system with parameter p: px + y = 1, x + py = 1."
      ]
    ]
  },
  {
    "id": "matrix-ops",
    "cs": "Operace s maticemi",
    "en": "Matrix operations",
    "prereq": [
      "gauss"
    ],
    "topic": "la-soustavy-matice",
    "auto": false,
    "kw": [
      [
        "násobení matic",
        "transpozice",
        "matice"
      ],
      [
        "matrix multiplication",
        "transpose",
        "matrix"
      ]
    ],
    "templates": [
      [
        "Vypočítej součin matic (1 {a} | 0 1)·(1 {b} | 0 1).",
        {
          "a": [
            1,
            5
          ],
          "b": [
            1,
            5
          ]
        },
        "Compute product of matrices (1 {a} | 0 1)*(1 {b} | 0 1)."
      ],
      [
        "Je násobení matic komutativní? Najdi A, B 2×2 s AB≠BA.",
        null,
        "Is matrix multiplication commutative? Find 2x2 A, B with AB!=BA."
      ],
      [
        "Vypočítej (1 2 | 3 4)^2 − {a}·(1 2 | 3 4).",
        {
          "a": [
            1,
            9
          ]
        },
        "Compute (1 2 | 3 4)^2 - {a}*(1 2 | 3 4)."
      ],
      [
        "Vypočítej součet matic ({a} 1 | 0 2) + (2 {b} | 1 3).",
        {
          "a": [
            1,
            6
          ],
          "b": [
            1,
            6
          ]
        },
        "Compute sum of matrices ({a} 1 | 0 2) + (2 {b} | 1 3)."
      ],
      [
        "Urči transponovanou matici k ({a} 2 | 3 {b}).",
        {
          "a": [
            1,
            7
          ],
          "b": [
            1,
            7
          ]
        },
        "Find transpose of ({a} 2 | 3 {b})."
      ],
      [
        "Vypočítej 2·(1 {a} | 2 3) - ({b} 0 | 1 1).",
        {
          "a": [
            1,
            5
          ],
          "b": [
            1,
            5
          ]
        },
        "Compute 2*(1 {a} | 2 3) - ({b} 0 | 1 1)."
      ],
      [
        "Vynásob matici (2 0 | 1 3) vektorem ({a}, {b})^T.",
        {
          "a": [
            1,
            4
          ],
          "b": [
            1,
            4
          ]
        },
        "Multiply matrix (2 0 | 1 3) by vector ({a}, {b})^T."
      ],
      [
        "Vypočítej stopu (trace) matice ({a} 2 | 5 {b}).",
        {
          "a": [
            1,
            8
          ],
          "b": [
            1,
            8
          ]
        },
        "Compute trace of matrix ({a} 2 | 5 {b})."
      ]
    ]
  },
  {
    "id": "determinant",
    "cs": "Determinant",
    "en": "Determinant",
    "prereq": [
      "matrix-ops"
    ],
    "topic": "la-soustavy-matice",
    "auto": false,
    "kw": [
      [
        "determinant",
        "sarrus",
        "laplace"
      ],
      [
        "determinant",
        "sarrus",
        "laplace"
      ]
    ],
    "templates": [
      [
        "Vypočítej determinant matice (2 {a} | 1 3).",
        {
          "a": [
            1,
            7
          ]
        },
        "Calculate determinant of matrix (2 {a} | 1 3)."
      ],
      [
        "Vypočítej determinant (1 2 3 | 0 {a} 1 | 1 0 2) Sarrusovým pravidlem.",
        {
          "a": [
            1,
            6
          ]
        },
        "Calculate determinant (1 2 3 | 0 {a} 1 | 1 0 2) using Sarrus rule."
      ],
      [
        "Pro které x je matice (x 2 | 3 x) singulární?",
        null,
        "For which x is matrix (x 2 | 3 x) singular?"
      ],
      [
        "Vypočítej determinant matice ({a} 4 | 2 {b}).",
        {
          "a": [
            2,
            6
          ],
          "b": [
            2,
            6
          ]
        },
        "Calculate determinant of matrix ({a} 4 | 2 {b})."
      ],
      [
        "Urči det(A^T), jestliže det(A)={a}.",
        {
          "a": [
            2,
            9
          ]
        },
        "Find det(A^T) if det(A)={a}."
      ],
      [
        "Urči det(2A) pro čtvercovou matici A řádu 2 s det(A)={a}.",
        {
          "a": [
            2,
            8
          ]
        },
        "Find det(2A) for a 2x2 matrix with det(A)={a}."
      ],
      [
        "Vypočítej determinant trojúhelníkové matice ({a} 2 3 | 0 {b} 4 | 0 0 {c}).",
        {
          "a": [
            1,
            4
          ],
          "b": [
            1,
            4
          ],
          "c": [
            1,
            4
          ]
        },
        "Compute determinant of triangular matrix ({a} 2 3 | 0 {b} 4 | 0 0 {c})."
      ],
      [
        "Vypočítej determinant matice (cos x  -sin x | sin x  cos x).",
        null,
        "Compute determinant of matrix (cos x  -sin x | sin x  cos x)."
      ]
    ]
  },
  {
    "id": "inverse-matrix",
    "cs": "Inverzní matice",
    "en": "Inverse matrix",
    "prereq": [
      "determinant"
    ],
    "topic": "la-soustavy-matice",
    "auto": false,
    "kw": [
      [
        "inverze",
        "regulární matice"
      ],
      [
        "inverse",
        "invertible"
      ]
    ],
    "templates": [
      [
        "Najdi inverzní matici k (1 {a} | 0 1).",
        {
          "a": [
            1,
            6
          ]
        },
        "Find inverse matrix to (1 {a} | 0 1)."
      ],
      [
        "Najdi inverzní matici k (2 1 | {a} 1), pokud existuje.",
        {
          "a": [
            0,
            5
          ]
        },
        "Find inverse matrix to (2 1 | {a} 1), if it exists."
      ],
      [
        "Pomocí inverzní matice vyřeš soustavu 2x+y={a}, x+y={b}.",
        {
          "a": [
            3,
            12
          ],
          "b": [
            2,
            8
          ]
        },
        "Using the inverse matrix solve 2x+y={a}, x+y={b}."
      ],
      [
        "Rozhodni, zda má matice ({a} 2 | 3 1) inverzi.",
        {
          "a": [
            1,
            8
          ]
        },
        "Determine whether ({a} 2 | 3 1) has an inverse."
      ],
      [
        "Vypočítej inverzní matici k diagonální matici ({a} 0 | 0 {b}).",
        {
          "a": [
            2,
            5
          ],
          "b": [
            2,
            5
          ]
        },
        "Find inverse of diagonal matrix ({a} 0 | 0 {b})."
      ],
      [
        "Urči inverzi k matici (1 1 | 0 1).",
        null,
        "Find inverse of matrix (1 1 | 0 1)."
      ],
      [
        "Platí (AB)^(-1) = B^(-1) A^(-1)? Zdůvodni.",
        null,
        "Does (AB)^(-1) = B^(-1) A^(-1) hold? Justify."
      ],
      [
        "Najdi inverzní matici k (3 5 | 1 2).",
        null,
        "Find inverse of matrix (3 5 | 1 2)."
      ]
    ]
  }
]);

topic("la-prostory", "Vektorové prostory a zobrazení", "Vector spaces and maps", [
  {
    "id": "span-basis",
    "cs": "Lineární nezávislost a báze",
    "en": "Linear independence and basis",
    "prereq": [
      "gauss"
    ],
    "topic": "la-prostory",
    "auto": false,
    "kw": [
      [
        "báze",
        "dimenze",
        "lineární obal",
        "nezávislost"
      ],
      [
        "basis",
        "dimension",
        "span",
        "independence"
      ]
    ],
    "templates": [
      [
        "Jsou vektory (1,2,3), (2,4,{a}), (0,1,1) lineárně nezávislé?",
        {
          "a": [
            5,
            8
          ]
        },
        "Are vectors (1,2,3), (2,4,{a}), (0,1,1) linearly independent?"
      ],
      [
        "Najdi bázi a dimenzi podprostoru generovaného (1,1,0), (2,2,0), (0,1,{a}).",
        {
          "a": [
            1,
            5
          ]
        },
        "Find a basis and dimension of span((1,1,0), (2,2,0), (0,1,{a}))."
      ],
      [
        "Doplň (1,{a},0) na bázi R^3.",
        {
          "a": [
            1,
            5
          ]
        },
        "Extend (1,{a},0) to a basis of R^3."
      ],
      [
        "Rozhodni, zda jsou vektory ({a}, 1) a (2, {b}) lineárně závislé.",
        {
          "a": [
            1,
            6
          ],
          "b": [
            1,
            6
          ]
        },
        "Determine if ({a}, 1) and (2, {b}) are linearly dependent."
      ],
      [
        "Urči dimenzi vektorového prostoru polynomů stupně nejvýše {a}.",
        {
          "a": [
            2,
            5
          ]
        },
        "Find dimension of vector space of polynomials of degree at most {a}."
      ],
      [
        "Tvoří vektory (1,0), (0,1), (1,1) bázi R^2? Zdůvodni.",
        null,
        "Do vectors (1,0), (0,1), (1,1) form a basis of R^2? Justify."
      ],
      [
        "Najdi souřadnice vektoru (3, {a}) v kanonické bázi R^2.",
        {
          "a": [
            1,
            8
          ]
        },
        "Find coordinates of vector (3, {a}) in standard basis of R^2."
      ],
      [
        "Generují vektory (1,0,0) a (0,1,0) celý prostor R^3?",
        null,
        "Do vectors (1,0,0) and (0,1,0) span all of R^3?"
      ]
    ]
  },
  {
    "id": "linear-maps",
    "cs": "Lineární zobrazení, jádro a obraz",
    "en": "Linear maps, kernel and image",
    "prereq": [
      "span-basis",
      "matrix-ops"
    ],
    "topic": "la-prostory",
    "auto": false,
    "kw": [
      [
        "jádro",
        "obraz",
        "lineární zobrazení"
      ],
      [
        "kernel",
        "image",
        "linear map"
      ]
    ],
    "templates": [
      [
        "Zobrazení f(x,y)=(x+{a}y, 2x) – napiš matici a urči jádro.",
        {
          "a": [
            1,
            5
          ]
        },
        "Linear map f(x,y)=(x+{a}y, 2x) - write its matrix and find kernel."
      ],
      [
        "Urči dimenzi jádra a obrazu zobrazení dané maticí (1 2 | 2 4).",
        null,
        "Find dimension of kernel and image for matrix (1 2 | 2 4)."
      ],
      [
        "Je f(x,y)=(x+1, y) lineární? Zdůvodni.",
        null,
        "Is f(x,y)=(x+1, y) linear? Justify."
      ],
      [
        "Najdi obraz vektoru (1, 2) při zobrazení s maticí ({a} 0 | 1 2).",
        {
          "a": [
            1,
            5
          ]
        },
        "Find image of vector (1, 2) under map with matrix ({a} 0 | 1 2)."
      ],
      [
        "Urči jádro zobrazení f(x,y)=x - {a}y.",
        {
          "a": [
            2,
            6
          ]
        },
        "Find kernel of linear map f(x,y)=x - {a}y."
      ],
      [
        "Platí věta o dimenzi jádra a obrazu: dim Ker(f) + dim Im(f) = dim V? Uveď příklad.",
        null,
        "State rank-nullity theorem: dim Ker(f) + dim Im(f) = dim V with an example."
      ],
      [
        "Urči matici projekce na osu x v R^2.",
        null,
        "Write the matrix of projection onto x-axis in R^2."
      ],
      [
        "Rozhodni, zda zobrazení dané maticí (1 {a} | 2 {b}) je prosté.",
        {
          "a": [
            1,
            4
          ],
          "b": [
            5,
            9
          ]
        },
        "Determine whether map given by (1 {a} | 2 {b}) is injective."
      ]
    ]
  },
  {
    "id": "eigen",
    "cs": "Vlastní čísla a vlastní vektory",
    "en": "Eigenvalues and eigenvectors",
    "prereq": [
      "determinant",
      "linear-maps"
    ],
    "topic": "la-prostory",
    "auto": false,
    "kw": [
      [
        "vlastní číslo",
        "charakteristický polynom",
        "diagonalizace"
      ],
      [
        "eigenvalue",
        "characteristic polynomial",
        "diagonalization"
      ]
    ],
    "templates": [
      [
        "Najdi vlastní čísla matice (2 {a} | 0 3).",
        {
          "a": [
            0,
            5
          ]
        },
        "Find eigenvalues of matrix (2 {a} | 0 3)."
      ],
      [
        "Najdi vlastní čísla a vektory matice (1 2 | 2 1).",
        null,
        "Find eigenvalues and eigenvectors of (1 2 | 2 1)."
      ],
      [
        "Je matice (1 1 | 0 1) diagonalizovatelná? Zdůvodni.",
        null,
        "Is matrix (1 1 | 0 1) diagonalizable? Justify."
      ],
      [
        "Urči charakteristický polynom matice ({a} 0 | 1 {b}).",
        {
          "a": [
            1,
            5
          ],
          "b": [
            2,
            6
          ]
        },
        "Write characteristic polynomial of ({a} 0 | 1 {b})."
      ],
      [
        "Urči vlastní čísla diagonální matice ({a} 0 | 0 {b}).",
        {
          "a": [
            2,
            6
          ],
          "b": [
            3,
            7
          ]
        },
        "Find eigenvalues of diagonal matrix ({a} 0 | 0 {b})."
      ],
      [
        "Je vektor (1, 1) vlastním vektorem matice (2 1 | 1 2)?",
        null,
        "Is vector (1, 1) an eigenvector of matrix (2 1 | 1 2)?"
      ],
      [
        "Urči součet vlastních čísel matice ({a} 1 | 2 3).",
        {
          "a": [
            1,
            6
          ]
        },
        "Sum of eigenvalues equals trace. Verify for ({a} 1 | 2 3)."
      ],
      [
        "Urči součin vlastních čísel matice (2 {a} | 1 4).",
        {
          "a": [
            1,
            5
          ]
        },
        "Product of eigenvalues equals determinant. Verify for (2 {a} | 1 4)."
      ]
    ]
  }
]);

topic("dm-logika-mnoziny", "Logika, množiny a důkazy", "Logic, sets and proofs", [
  {
    "id": "prop-logic",
    "cs": "Výroková logika",
    "en": "Propositional logic",
    "prereq": [],
    "topic": "dm-logika-mnoziny",
    "auto": false,
    "kw": [
      [
        "výrok",
        "implikace",
        "negace",
        "tabulka pravdivosti"
      ],
      [
        "proposition",
        "implication",
        "truth table"
      ]
    ],
    "templates": [
      [
        "Sestav tabulku pravdivosti pro výrok (A ⇒ B) ∧ (B ⇒ A).",
        null,
        "Construct truth table for (A => B) and (B => A)."
      ],
      [
        "Zneguj výrok: pro každé x existuje y takové, že x + y = {a}.",
        {
          "a": [
            1,
            9
          ]
        },
        "Negate statement: for all x there exists y such that x + y = {a}."
      ],
      [
        "Je (A ∨ B) ⇒ C ekvivalentní s (A ⇒ C) ∧ (B ⇒ C)? Dokaž.",
        null,
        "Is (A or B) => C equivalent to (A => C) and (B => C)? Prove."
      ],
      [
        "Zneguj výrok: A ⇒ B.",
        null,
        "Negate the proposition: A => B."
      ],
      [
        "Rozhodni, zda výrok A ∨ ¬A je tautologie.",
        null,
        "Determine whether A or not A is a tautology."
      ],
      [
        "Formuluj de Morganovy zákony pro výrokovou logiku.",
        null,
        "State de Morgan's laws for propositional logic."
      ],
      [
        "Sestav tabulku pravdivosti pro výrok ¬(A ∧ B).",
        null,
        "Construct truth table for not(A and B)."
      ],
      [
        "Rozhodni, zda A ∧ (A ⇒ B) implikuje B (modus ponens).",
        null,
        "Determine whether A and (A => B) implies B (modus ponens)."
      ]
    ]
  },
  {
    "id": "sets-relations",
    "cs": "Množiny a relace",
    "en": "Sets and relations",
    "prereq": [
      "prop-logic"
    ],
    "topic": "dm-logika-mnoziny",
    "auto": false,
    "kw": [
      [
        "množina",
        "relace",
        "ekvivalence",
        "uspořádání"
      ],
      [
        "set",
        "relation",
        "equivalence",
        "order"
      ]
    ],
    "templates": [
      [
        "Kolik prvků má potenční množina množiny o {a} prvcích?",
        {
          "a": [
            3,
            8
          ]
        },
        "How many elements does power set of a set with {a} elements have?"
      ],
      [
        "Je relace „a−b je dělitelné {a}“ na Z ekvivalence? Dokaž.",
        {
          "a": [
            2,
            7
          ]
        },
        "Is relation 'a-b is divisible by {a}' on Z an equivalence? Prove."
      ],
      [
        "Je dělitelnost uspořádání na množině {1,…,{a}}? Nakresli Hasseův diagram.",
        {
          "a": [
            6,
            12
          ]
        },
        "Is divisibility a partial order on {1,...,{a}}? Draw Hasse diagram."
      ],
      [
        "Urči průnik a sjednocení množin A={1, 2, {a}} a B={2, {a}, 5}.",
        {
          "a": [
            3,
            4
          ]
        },
        "Find intersection and union of A={1, 2, {a}} and B={2, {a}, 5}."
      ],
      [
        "Kolik různých relací existuje na množině o {a} prvcích?",
        {
          "a": [
            2,
            3
          ]
        },
        "How many different relations exist on a set with {a} elements?"
      ],
      [
        "Je relace rovnosti na reálných číslech ekvivalencí?",
        null,
        "Is the equality relation on real numbers an equivalence relation?"
      ],
      [
        "Urči třídy ekvivalence relace kongruence modulo {a} na Z.",
        {
          "a": [
            2,
            5
          ]
        },
        "Find equivalence classes of congruence modulo {a} on Z."
      ],
      [
        "Urči definici pro reflexivní, symetrickou a tranzitivní relaci.",
        null,
        "Define reflexive, symmetric, and transitive relations."
      ]
    ]
  },
  {
    "id": "induction",
    "cs": "Matematická indukce",
    "en": "Mathematical induction",
    "prereq": [
      "prop-logic"
    ],
    "topic": "dm-logika-mnoziny",
    "auto": false,
    "kw": [
      [
        "indukce",
        "důkaz"
      ],
      [
        "induction",
        "proof"
      ]
    ],
    "templates": [
      [
        "Dokaž indukcí: 1+2+…+n = n(n+1)/2.",
        null,
        "Prove by induction: 1+2+...+n = n(n+1)/2."
      ],
      [
        "Dokaž indukcí, že {a}^n − 1 je dělitelné {b} pro všechna n≥1.",
        {
          "a": [
            4,
            7
          ],
          "b": [
            3,
            6
          ]
        },
        "Prove by induction that {a}^n - 1 is divisible by {b} for all n>=1."
      ],
      [
        "Dokaž indukcí, že 2^n > n pro všechna n≥1.",
        null,
        "Prove by induction that 2^n > n for all n>=1."
      ],
      [
        "Dokaž indukcí vzorec pro součet čtverců: 1^2+…+n^2 = n(n+1)(2n+1)/6.",
        null,
        "Prove by induction: 1^2+...+n^2 = n(n+1)(2n+1)/6."
      ],
      [
        "Dokaž indukcí: 1+3+5+…+(2n-1) = n^2.",
        null,
        "Prove by induction: 1+3+5+...+(2n-1) = n^2."
      ],
      [
        "Dokaž indukcí, že n^3 - n je dělitelné 6 pro všechna přirozená n.",
        null,
        "Prove by induction that n^3 - n is divisible by 6 for natural n."
      ],
      [
        "Dokaž indukcí: součet geometrické řady 1+q+…+q^n = (q^{n+1}-1)/(q-1).",
        null,
        "Prove by induction: 1+q+...+q^n = (q^{n+1}-1)/(q-1)."
      ],
      [
        "Dokaž nebo vysvětli základní krok a indukční krok matematické indukce.",
        null,
        "Explain base step and inductive step in mathematical induction."
      ]
    ]
  }
]);

topic("dm-kombinatorika-grafy", "Kombinatorika a grafy", "Combinatorics and graphs", [
  {
    "id": "comb-counting",
    "cs": "Kombinatorické počítání",
    "en": "Counting methods",
    "prereq": [],
    "topic": "dm-kombinatorika-grafy",
    "auto": false,
    "kw": [
      [
        "binomická věta",
        "variace s opakováním",
        "kombinace"
      ],
      [
        "binomial theorem",
        "combinations"
      ]
    ],
    "templates": [
      [
        "Kolika způsoby lze rozdělit {a} různých kuliček do 3 různých krabic?",
        {
          "a": [
            3,
            7
          ]
        },
        "In how many ways can {a} distinct balls be distributed into 3 distinct boxes?"
      ],
      [
        "Najdi koeficient u x^{a} v rozvoji (1+x)^{b}.",
        {
          "a": [
            2,
            4
          ],
          "b": [
            6,
            9
          ]
        },
        "Find coefficient of x^{a} in expansion of (1+x)^{b}."
      ],
      [
        "Kolik je binárních řetězců délky {a} bez dvou po sobě jdoucích jedniček?",
        {
          "a": [
            4,
            8
          ]
        },
        "How many binary strings of length {a} contain no two consecutive ones?"
      ],
      [
        "Kolika způsoby lze vybrat {a} prvků z {b} s opakováním?",
        {
          "a": [
            2,
            4
          ],
          "b": [
            4,
            7
          ]
        },
        "How many combinations with repetition of {a} elements from {b}?"
      ],
      [
        "Rozviň (x + y)^{a} podle binomické věty.",
        {
          "a": [
            3,
            5
          ]
        },
        "Expand (x + y)^{a} using binomial theorem."
      ],
      [
        "Kolik přesmyček má slovo délky {a} se všemi písmeny různými?",
        {
          "a": [
            4,
            7
          ]
        },
        "How many anagrams does a word of length {a} with distinct letters have?"
      ],
      [
        "Kolika způsoby lze posadit {a} lidí ke kulatému stolu?",
        {
          "a": [
            4,
            8
          ]
        },
        "In how many ways can {a} people sit at a round table?"
      ],
      [
        "Vypočítej součet kombinačních čísel sum C({a}, k) pro k=0 až {a}.",
        {
          "a": [
            3,
            8
          ]
        },
        "Compute sum of combinations sum C({a}, k) for k=0 to {a}."
      ]
    ]
  },
  {
    "id": "inclusion-exclusion",
    "cs": "Princip inkluze a exkluze",
    "en": "Inclusion–exclusion",
    "prereq": [
      "comb-counting"
    ],
    "topic": "dm-kombinatorika-grafy",
    "auto": false,
    "kw": [
      [
        "inkluze",
        "exkluze",
        "dělitelnost"
      ],
      [
        "inclusion",
        "exclusion"
      ]
    ],
    "templates": [
      [
        "Kolik čísel z {1,…,{a}} je dělitelných 2 nebo 3?",
        {
          "a": [
            30,
            100
          ]
        },
        "How many numbers from {1,...,{a}} are divisible by 2 or 3?"
      ],
      [
        "Kolik permutací množiny {1,…,{a}} nemá žádný pevný bod?",
        {
          "a": [
            3,
            6
          ]
        },
        "How many derangements of {1,...,{a}} have no fixed points?"
      ],
      [
        "V třídě {a} žáků hraje fotbal, {b} basket, {c} oba. Kolik nehraje ani jedno, je-li ve třídě 30 žáků?",
        {
          "a": [
            12,
            20
          ],
          "b": [
            10,
            18
          ],
          "c": [
            3,
            8
          ]
        },
        "In a class of 30, {a} play soccer, {b} basketball, {c} both. How many play neither?"
      ],
      [
        "Kolik čísel z 1 až {a} je dělitelných 3 nebo 5?",
        {
          "a": [
            50,
            150
          ]
        },
        "How many numbers from 1 to {a} are divisible by 3 or 5?"
      ],
      [
        "Formuluj princip inkluze a exkluze pro tři množiny |A ∪ B ∪ C|.",
        null,
        "State inclusion-exclusion principle for three sets |A u B u C|."
      ],
      [
        "Kolik čísel z 1 až 100 není dělitelných ani 2 ani 5?",
        null,
        "How many numbers from 1 to 100 are divisible by neither 2 nor 5?"
      ],
      [
        "Ze {a} studentů se {b} učí anglicky, {c} německy a 5 oba jazyky. Kolik se učí alespoň jeden?",
        {
          "a": [
            40,
            60
          ],
          "b": [
            25,
            35
          ],
          "c": [
            15,
            25
          ]
        },
        "Of {a} students, {b} study English, {c} German, 5 both. How many study at least one?"
      ],
      [
        "Kolik je čísel v rozmezí 1 až {a} nesoudělných s 10?",
        {
          "a": [
            30,
            90
          ]
        },
        "How many numbers between 1 and {a} are coprime to 10?"
      ]
    ]
  },
  {
    "id": "graphs-basic",
    "cs": "Grafy, stupně vrcholů a cesty",
    "en": "Graphs, degrees and paths",
    "prereq": [
      "sets-relations"
    ],
    "topic": "dm-kombinatorika-grafy",
    "auto": false,
    "kw": [
      [
        "graf",
        "vrchol",
        "hrana",
        "stupeň"
      ],
      [
        "graph",
        "vertex",
        "edge",
        "degree"
      ]
    ],
    "templates": [
      [
        "Kolik hran má úplný graf K_{a}?",
        {
          "a": [
            4,
            12
          ]
        },
        "How many edges does complete graph K_{a} have?"
      ],
      [
        "Existuje graf se stupni vrcholů 3, 3, 3, {a}? Zdůvodni.",
        {
          "a": [
            1,
            3
          ]
        },
        "Does a graph with degree sequence 3, 3, 3, {a} exist? Justify."
      ],
      [
        "Kolik hran má strom na {a} vrcholech?",
        {
          "a": [
            5,
            30
          ]
        },
        "How many edges does a tree on {a} vertices have?"
      ],
      [
        "Dokaž nebo vysvětli princip větvení (handshaking lemma) pro grafy.",
        null,
        "Explain handshaking lemma for graphs."
      ],
      [
        "Kolik vrcholů má graf s {a} hranami, kde každý vrchol má stupeň 2?",
        {
          "a": [
            4,
            12
          ]
        },
        "How many vertices in a 2-regular graph with {a} edges?"
      ],
      [
        "Je graf K_{a} eulerovský? Zdůvodni.",
        {
          "a": [
            3,
            7
          ]
        },
        "Is complete graph K_{a} Eulerian? Justify."
      ],
      [
        "Urči počet hran v úplném bipartitním grafu K_{a},{b}.",
        {
          "a": [
            2,
            5
          ],
          "b": [
            3,
            6
          ]
        },
        "Find number of edges in complete bipartite graph K_{a},{b}."
      ],
      [
        "Urči definici pro cestu a cyklus v grafu.",
        null,
        "Define path and cycle in a graph."
      ]
    ]
  },
  {
    "id": "trees-connectivity",
    "cs": "Stromy a souvislost",
    "en": "Trees and connectivity",
    "prereq": [
      "graphs-basic"
    ],
    "topic": "dm-kombinatorika-grafy",
    "auto": false,
    "kw": [
      [
        "strom",
        "kostra",
        "souvislý"
      ],
      [
        "tree",
        "spanning tree",
        "connected"
      ]
    ],
    "templates": [
      [
        "Kolik koster má cyklus C_{a}?",
        {
          "a": [
            3,
            8
          ]
        },
        "How many spanning trees does cycle C_{a} have?"
      ],
      [
        "Dokaž, že každý strom s alespoň 2 vrcholy má aspoň 2 listy.",
        null,
        "Prove that every tree with at least 2 vertices has at least 2 leaves."
      ],
      [
        "Je graf se {a} vrcholy a {b} hranami nutně souvislý? Zdůvodni.",
        {
          "a": [
            6,
            10
          ],
          "b": [
            8,
            12
          ]
        },
        "Is a graph with {a} vertices and {b} edges necessarily connected? Justify."
      ],
      [
        "Kolik koster má úplný graf K_4 podle Cayleyho formule?",
        null,
        "How many spanning trees does K_4 have according to Cayley formula?"
      ],
      [
        "Urči nutnou a postačující podmínku, aby byl graf stromem.",
        null,
        "State necessary and sufficient condition for a graph to be a tree."
      ],
      [
        "Jaký je minimální počet hran potřebný k souvislosti grafu o {a} vrcholech?",
        {
          "a": [
            5,
            20
          ]
        },
        "What is minimum edges needed for connectivity of a graph on {a} vertices?"
      ],
      [
        "Urči postup algoritmu pro nalezení minimální kostry grafu (Kruskal nebo Jarník).",
        null,
        "Describe minimum spanning tree algorithm (Kruskal or Prim)."
      ],
      [
        "Strom má {a} vrcholů. Kolik má listů, jestliže všechny ostatní vrcholy mají stupeň 3?",
        {
          "a": [
            6,
            14
          ]
        },
        "A tree has {a} vertices. How many leaves if all other vertices have degree 3?"
      ]
    ]
  }
]);

topic("st-pravdepodobnost", "Pravděpodobnost", "Probability", [
  {
    "id": "prob-conditional",
    "cs": "Podmíněná pravděpodobnost a nezávislost",
    "en": "Conditional probability and independence",
    "prereq": [],
    "topic": "st-pravdepodobnost",
    "auto": false,
    "kw": [
      [
        "podmíněná pravděpodobnost",
        "nezávislé jevy",
        "bayes"
      ],
      [
        "conditional probability",
        "independent events",
        "bayes"
      ]
    ],
    "templates": [
      [
        "Z balíčku 32 karet táhneš dvě bez vracení. Jaká je pravděpodobnost, že obě jsou esa?",
        null,
        "From 32 cards you draw two without replacement. Probability both are aces?"
      ],
      [
        "P(A)=0,{a}, P(B)=0,4, A a B nezávislé. Urči P(A∪B).",
        {
          "a": [
            2,
            7
          ]
        },
        "P(A)=0.{a}, P(B)=0.4, A and B independent. Find P(A u B)."
      ],
      [
        "Test má citlivost 95 % a specificitu 90 %, nemoc má {a} % lidí. Jaká je P(nemoc | pozitivní test)?",
        {
          "a": [
            1,
            10
          ]
        },
        "Test has 95% sensitivity and 90% specificity, disease prevalence {a}%. Find P(disease | positive test)."
      ],
      [
        "Urči znění Bayesovy věty a její význam.",
        null,
        "Explain Bayes theorem and its significance."
      ],
      [
        "Jsou jevy A a B nezávislé, jestliže P(A)=0,5, P(B)=0,{a} a P(A∩B)=0,2?",
        {
          "a": [
            3,
            6
          ]
        },
        "Are events A, B independent if P(A)=0.5, P(B)=0.{a}, P(A n B)=0.2?"
      ],
      [
        "Urči podmíněnou pravděpodobnost P(A|B), jestliže P(A∩B)=0,{a} a P(B)=0,5.",
        {
          "a": [
            1,
            4
          ]
        },
        "Find conditional probability P(A|B) if P(A n B)=0.{a} and P(B)=0.5."
      ],
      [
        "Dva střelci střílejí nezávisle na cíl s pravděpodobnostmi 0,7 a 0,{a}. Jaká je P, že cíl zasáhnou oba?",
        {
          "a": [
            6,
            9
          ]
        },
        "Two shooters shoot independently with probabilities 0.7 and 0.{a}. Probability both hit target?"
      ],
      [
        "Urči rozdíl mezi neslučitelnými a nezávislými jevy.",
        null,
        "Explain difference between mutually exclusive and independent events."
      ]
    ]
  },
  {
    "id": "random-variables",
    "cs": "Náhodné veličiny a střední hodnota",
    "en": "Random variables and expectation",
    "prereq": [
      "prob-conditional"
    ],
    "topic": "st-pravdepodobnost",
    "auto": false,
    "kw": [
      [
        "rozdělení",
        "střední hodnota",
        "rozptyl",
        "binomické"
      ],
      [
        "distribution",
        "expected value",
        "variance",
        "binomial"
      ]
    ],
    "templates": [
      [
        "Urči střední hodnotu a rozptyl hodu kostkou.",
        null,
        "Determine expected value and variance of a fair die roll."
      ],
      [
        "X~Bin({a}; 0,5). Urči E(X) a Var(X).",
        {
          "a": [
            6,
            20
          ]
        },
        "X~Bin({a}; 0.5). Find E(X) and Var(X)."
      ],
      [
        "Hodíš {a}krát mincí. Jaká je pravděpodobnost, že padne přesně polovina orlů?",
        {
          "a": [
            4,
            10
          ]
        },
        "Flip coin {a} times. Probability of getting exactly half heads?"
      ],
      [
        "Náhodná veličina nabývá hodnot 0 s P=0,4 a {a} s P=0,6. Urči E(X).",
        {
          "a": [
            5,
            15
          ]
        },
        "Random variable takes value 0 with P=0.4 and {a} with P=0.6. Find E(X)."
      ],
      [
        "Vypočítej střední hodnotu rovnoměrného diskrétního rozdělení na {1, 2, …, {a}}.",
        {
          "a": [
            5,
            11
          ]
        },
        "Compute expected value of uniform discrete distribution on {1, 2, ..., {a}}."
      ],
      [
        "Veličina má rozptyl {a}. Jaká je její směrodatná odchylka?",
        {
          "a": [
            4,
            25
          ]
        },
        "Variable has variance {a}. What is its standard deviation?"
      ],
      [
        "Platí pro střední hodnotu E(aX + b) = a·E(X) + b? Uveď vlastnosti.",
        null,
        "Does linearity of expectation E(aX + b) = a*E(X) + b hold? State properties."
      ],
      [
        "X~Poiss({a}). Jaká je střední hodnota a rozptyl Poissonova rozdělení?",
        {
          "a": [
            2,
            6
          ]
        },
        "X~Poiss({a}). What are mean and variance of Poisson distribution?"
      ]
    ]
  },
  {
    "id": "normal-distribution",
    "cs": "Normální rozdělení",
    "en": "Normal distribution",
    "prereq": [
      "random-variables"
    ],
    "topic": "st-pravdepodobnost",
    "auto": false,
    "kw": [
      [
        "gauss",
        "zvonovitá křivka",
        "standardizace"
      ],
      [
        "gaussian",
        "bell curve",
        "standardization"
      ]
    ],
    "templates": [
      [
        "X~N(100; 15²). Převeď P(X<{a}) na standardní normální rozdělení.",
        {
          "a": [
            85,
            130
          ]
        },
        "X~N(100; 15^2). Standardize P(X<{a}) to standard normal distribution."
      ],
      [
        "Jaká část hodnot leží v rozmezí μ ± 2σ u normálního rozdělení?",
        null,
        "What proportion of values lie within mu +- 2sigma in normal distribution?"
      ],
      [
        "Výška mužů ~ N(180; 7²). Jaká je pravděpodobnost, že náhodný muž měří víc než {a} cm?",
        {
          "a": [
            185,
            200
          ]
        },
        "Men's height ~ N(180; 7^2). Probability a random man is taller than {a} cm?"
      ],
      [
        "Vysvětli standardizaci náhodné veličiny Z = (X - μ) / σ.",
        null,
        "Explain standardization of random variable Z = (X - mu) / sigma."
      ],
      [
        "Jaká část hodnot leží v rozmezí μ ± 1σ u normálního rozdělení?",
        null,
        "What proportion of values lie within mu +- 1sigma in normal distribution?"
      ],
      [
        "Pro standardní normální rozdělení Z~N(0, 1) urči P(Z > 0).",
        null,
        "For standard normal Z~N(0, 1), determine P(Z > 0)."
      ],
      [
        "X~N({a}; 4). Urči medián a modus tohoto rozdělení.",
        {
          "a": [
            20,
            80
          ]
        },
        "X~N({a}; 4). Determine median and mode of this distribution."
      ],
      [
        "Formuluj centrální limitní větu a její význam pro statistiku.",
        null,
        "State Central Limit Theorem and its importance for statistics."
      ]
    ]
  }
]);

topic("st-statistika", "Statistika", "Statistics", [
  {
    "id": "estimation",
    "cs": "Odhady a intervaly spolehlivosti",
    "en": "Estimation and confidence intervals",
    "prereq": [
      "normal-distribution"
    ],
    "topic": "st-statistika",
    "auto": false,
    "kw": [
      [
        "odhad",
        "interval spolehlivosti",
        "výběrový průměr"
      ],
      [
        "estimate",
        "confidence interval",
        "sample mean"
      ]
    ],
    "templates": [
      [
        "Výběr n={a} má průměr 50 a směrodatnou odchylku 8. Sestav 95% interval spolehlivosti pro střední hodnotu.",
        {
          "a": [
            25,
            100
          ]
        },
        "A sample of n={a} has mean 50 and std dev 8. Construct 95% confidence interval for the mean."
      ],
      [
        "Jak se změní šířka intervalu spolehlivosti, když zvětšíš výběr {a}krát?",
        {
          "a": [
            2,
            9
          ]
        },
        "How does confidence interval width change when sample size increases {a} times?"
      ],
      [
        "V průzkumu z {a} lidí odpovědělo 60 % ano. Najdi 95% interval pro podíl.",
        {
          "a": [
            100,
            500
          ]
        },
        "In a survey of {a} people, 60% answered yes. Find 95% confidence interval for proportion."
      ],
      [
        "Rozhodni, zda výběrový průměr je nestranným odhadem střední hodnoty.",
        null,
        "Determine whether sample mean is an unbiased estimator of population mean."
      ],
      [
        "Vypočítej standardní chybu průměru pro výběr n={a} a σ=10.",
        {
          "a": [
            25,
            100
          ]
        },
        "Calculate standard error of the mean for sample n={a} and sigma=10."
      ],
      [
        "Jaký kvantil standardního normálního rozdělení se používá pro 95% interval spolehlivosti?",
        null,
        "Which quantile of standard normal is used for a 95% confidence interval?"
      ],
      [
        "Jaký je rozdíl mezi bodovým a intervalovým odhadem?",
        null,
        "What is the difference between point estimate and confidence interval?"
      ],
      [
        "Výběr n={a} má průměr 100 a známou směrodatnou odchylku σ=15. Urči mezní chybu pro 95 %.",
        {
          "a": [
            36,
            100
          ]
        },
        "Sample n={a} has mean 100 and known sigma=15. Determine margin of error for 95%."
      ]
    ]
  },
  {
    "id": "hypothesis-testing",
    "cs": "Testování hypotéz",
    "en": "Hypothesis testing",
    "prereq": [
      "estimation"
    ],
    "topic": "st-statistika",
    "auto": false,
    "kw": [
      [
        "hypotéza",
        "p-hodnota",
        "t-test",
        "hladina významnosti"
      ],
      [
        "hypothesis",
        "p-value",
        "t-test",
        "significance"
      ]
    ],
    "templates": [
      [
        "Formuluj H0 a H1 pro tvrzení, že mince je spravedlivá, a vysvětli chybu 1. druhu.",
        null,
        "Formulate H0 and H1 for coin fairness and explain Type I error."
      ],
      [
        "Z {a} měření vyšel průměr 102 a s=6. Otestuj H0: μ=100 na hladině 5 %.",
        {
          "a": [
            16,
            40
          ]
        },
        "From {a} measurements mean is 102 and s=6. Test H0: mu=100 at 5% significance level."
      ],
      [
        "Co znamená p-hodnota 0,0{a}? Zamítneš H0 na hladině 5 %?",
        {
          "a": [
            1,
            9
          ]
        },
        "What does p-value 0.0{a} mean? Do you reject H0 at 5% level?"
      ],
      [
        "Urči rozdíl mezi chybou 1. druhu (alfa) a chybou 2. druhu (beta).",
        null,
        "Explain difference between Type I error (alpha) and Type II error (beta)."
      ],
      [
        "Kdy se místo Z-testu použije Studentův t-test?",
        null,
        "When is Student's t-test used instead of Z-test?"
      ],
      [
        "Pokud je p-hodnota rovna 0,1{a}, zamítáme H0 na hladině 0,05?",
        {
          "a": [
            1,
            8
          ]
        },
        "If p-value is 0.1{a}, do we reject H0 at level 0.05?"
      ],
      [
        "Co je to kritický obor testu a jak souvisí s hladinou významnosti?",
        null,
        "What is critical region of a test and how does it relate to significance level?"
      ],
      [
        "Formuluj nulovou a alternativní hypotézu pro test rovnosti průměrů dvou nezávislých výběrů.",
        null,
        "State null and alternative hypothesis for two-sample test of equality of means."
      ]
    ]
  }
]);

topic("fy-mechanika", "Mechanika", "Mechanics", [
  {
    "id": "fy-velocity",
    "cs": "Rychlost, dráha a čas",
    "en": "Speed, distance and time",
    "prereq": [],
    "topic": "fy-mechanika",
    "auto": false,
    "levels": [
      1,
      2,
      3
    ],
    "kw": [
      [
        "rychlost",
        "dráha",
        "pohyb",
        "v = s/t"
      ],
      [
        "speed",
        "velocity",
        "distance"
      ]
    ],
    "templates": [
      [
        "Auto ujede {a} m za {b} s. Jakou má průměrnou rychlost (v m/s)?",
        {
          "a": [
            30,
            300
          ],
          "b": [
            2,
            12
          ]
        },
        "A car travels {a} m in {b} s. What is its average speed (in m/s)?"
      ],
      [
        "Cyklista jede rychlostí {a} km/h po dobu {b} h. Jakou dráhu ujede (v km)?",
        {
          "a": [
            10,
            30
          ],
          "b": [
            2,
            5
          ]
        },
        "A cyclist rides at {a} km/h for {b} h. What distance does he travel (in km)?"
      ],
      [
        "Vlak ujede {a} km za {b} min. Urči jeho rychlost v km/h.",
        {
          "a": [
            20,
            90
          ],
          "b": [
            10,
            45
          ]
        },
        "A train travels {a} km in {b} min. Find its speed in km/h."
      ],
      [
        "Běžec běží rychlostí {v} m/s po dobu {b} s. Jakou dráhu uběhne (v m)?",
        {
          "v": [
            5,
            25
          ],
          "b": [
            2,
            10
          ]
        },
        "A runner runs at {v} m/s for {b} s. What distance does he cover (in m)?"
      ],
      [
        "Chodec jde rychlostí {a} km/h po dobu {b} h. Kolik km ujde?",
        {
          "a": [
            3,
            6
          ],
          "b": [
            2,
            5
          ]
        },
        "A pedestrian walks at {a} km/h for {b} h. How many km does he walk?"
      ],
      [
        "Letadlo letí rychlostí {a} km/h po dobu {b} h. Jakou vzdálenost překoná (v km)?",
        {
          "a": [
            400,
            800
          ],
          "b": [
            2,
            5
          ]
        },
        "An airplane flies at {a} km/h for {b} h. What distance does it cover (in km)?"
      ],
      [
        "Střela urazí dráhu {a} m za {b} s. Jaká je její rychlost (v m/s)?",
        {
          "a": [
            200,
            800
          ],
          "b": [
            2,
            8
          ]
        },
        "A projectile travels {a} m in {b} s. What is its speed (in m/s)?"
      ],
      [
        "Zvuk se šíří rychlostí 340 m/s. Za kolik sekund urazí {a} m?",
        {
          "a": [
            680,
            3400
          ]
        },
        "Sound travels at 340 m/s. In how many seconds does it cover {a} m?"
      ]
    ],
    "answers": [
      [
        "{a}/{b}",
        "m/s"
      ],
      [
        "{a}*{b}",
        "km"
      ],
      [
        "{a}/({b}/60)",
        "km/h"
      ],
      [
        "{v}*{b}",
        "m"
      ],
      [
        "{a}*{b}",
        "km"
      ],
      [
        "{a}*{b}",
        "km"
      ],
      [
        "{a}/{b}",
        "m/s"
      ],
      [
        "{a}/340",
        "s"
      ]
    ]
  },
  {
    "id": "fy-force",
    "cs": "Síla a zrychlení (F = m · a)",
    "en": "Force and acceleration (F = m · a)",
    "prereq": [
      "fy-velocity"
    ],
    "topic": "fy-mechanika",
    "auto": false,
    "levels": [
      1,
      2,
      3
    ],
    "kw": [
      [
        "síla",
        "newton",
        "zrychlení",
        "tíha"
      ],
      [
        "force",
        "newton",
        "acceleration",
        "weight"
      ]
    ],
    "templates": [
      [
        "Těleso o hmotnosti {a} kg zrychluje o {b} m/s². Jaká síla na něj působí (v N)?",
        {
          "a": [
            2,
            20
          ],
          "b": [
            2,
            9
          ]
        },
        "A body of mass {a} kg accelerates at {b} m/s^2. What force acts on it (in N)?"
      ],
      [
        "Síla {a} N uděluje tělesu zrychlení {b} m/s². Jaká je jeho hmotnost (v kg)?",
        {
          "a": [
            20,
            60
          ],
          "b": [
            2,
            5
          ]
        },
        "A force of {a} N gives a body an acceleration of {b} m/s^2. What is its mass (in kg)?"
      ],
      [
        "Jakou tíhovou sílu má těleso o hmotnosti {a} kg? (g = 10 m/s²)",
        {
          "a": [
            2,
            80
          ]
        },
        "What is gravitational force on a body of mass {a} kg? (g = 10 m/s^2)"
      ],
      [
        "Těleso o hmotnosti {a} kg působí tíhovou silou na podložku. Urči tíhu (g = 10 m/s²; v N).",
        {
          "a": [
            5,
            50
          ]
        },
        "A body of mass {a} kg rests on surface. Find weight (g = 10 m/s^2; in N)."
      ],
      [
        "Síla {F} N působí na těleso hmotnosti {a} kg. Jaké je zrychlení (v m/s²)?",
        {
          "a": [
            2,
            8
          ],
          "b": [
            2,
            6
          ]
        },
        "A force of {F} N acts on body of mass {a} kg. What is acceleration (in m/s^2)?"
      ],
      [
        "Vozík hmotnosti {a} kg je tažen silou s výsledným zrychlením {b} m/s². Jaká je tažná síla (v N)?",
        {
          "a": [
            10,
            40
          ],
          "b": [
            2,
            5
          ]
        },
        "A cart of mass {a} kg is pulled with acceleration {b} m/s^2. What is pulling force (in N)?"
      ],
      [
        "Těleso o hmotnosti {a} kg má tíhu {a}0 N na Zemi. Jaká by byla tíha při tíhovém zrychlení {b} m/s²?",
        {
          "a": [
            5,
            20
          ],
          "b": [
            2,
            6
          ]
        },
        "Body of mass {a} kg has weight {a}0 N on Earth. What weight at gravity {b} m/s^2?"
      ],
      [
        "Síla {a} N působí na hmotnost 2 kg. Jaké je zrychlení (v m/s²)?",
        {
          "a": [
            4,
            30
          ]
        },
        "Force of {a} N acts on mass 2 kg. What is acceleration (in m/s^2)?"
      ]
    ],
    "answers": [
      [
        "{a}*{b}",
        "N"
      ],
      [
        "{a}/{b}",
        "kg"
      ],
      [
        "{a}*10",
        "N"
      ],
      [
        "{a}*10",
        "N"
      ],
      [
        "{F}/{a}",
        "m/s²"
      ],
      [
        "{a}*{b}",
        "N"
      ],
      [
        "{a}*{b}",
        "N"
      ],
      [
        "{a}/2",
        "m/s²"
      ]
    ]
  },
  {
    "id": "fy-work",
    "cs": "Práce, výkon a energie",
    "en": "Work, power and energy",
    "prereq": [
      "fy-force"
    ],
    "topic": "fy-mechanika",
    "auto": false,
    "levels": [
      2,
      3,
      3
    ],
    "kw": [
      [
        "práce",
        "výkon",
        "joule",
        "watt",
        "energie"
      ],
      [
        "work",
        "power",
        "joule",
        "watt",
        "energy"
      ]
    ],
    "templates": [
      [
        "Síla {a} N posune těleso o {b} m ve směru síly. Jakou práci vykoná (v J)?",
        {
          "a": [
            10,
            80
          ],
          "b": [
            2,
            15
          ]
        },
        "A force of {a} N moves a body {b} m in direction of force. What work is done (in J)?"
      ],
      [
        "Stroj vykoná práci {a} J za {b} s. Jaký je jeho výkon (ve W)?",
        {
          "a": [
            200,
            900
          ],
          "b": [
            2,
            10
          ]
        },
        "A machine does work of {a} J in {b} s. What is its power (in W)?"
      ],
      [
        "Žárovka o příkonu {a} W svítí {b} h. Kolik kWh spotřebuje?",
        {
          "a": [
            40,
            100
          ],
          "b": [
            2,
            10
          ]
        },
        "A light bulb of power {a} W shines for {b} h. How many kWh does it consume?"
      ],
      [
        "Motor o výkonu {a} W běží {b} s. Jakou práci vykoná (v J)?",
        {
          "a": [
            50,
            200
          ],
          "b": [
            5,
            20
          ]
        },
        "A motor of power {a} W runs for {b} s. What work does it do (in J)?"
      ],
      [
        "Síla {f} N vykoná práci {a} J. Jakou dráhu přitom těleso urazilo (v m)?",
        {
          "f": [
            5,
            20
          ],
          "s": [
            2,
            10
          ]
        },
        "A force of {f} N does work of {a} J. What distance did it cover (in m)?"
      ],
      [
        "Zvedneme břemeno o tíze {a} N do výšky {b} m. Jakou vykonáme práci (v J)?",
        {
          "a": [
            50,
            300
          ],
          "b": [
            2,
            8
          ]
        },
        "We lift a load of weight {a} N to height {b} m. What work do we perform (in J)?"
      ],
      [
        "Čerpadlo vykoná práci {a} J za {b} s. Jaký je výkon čerpadla (ve W)?",
        {
          "a": [
            300,
            1200
          ],
          "b": [
            3,
            10
          ]
        },
        "A pump does work of {a} J in {b} s. What is pump power (in W)?"
      ],
      [
        "Těleso má kinetickou energii E_k = m*v^2 / 2. Pro m=2 kg a v={a} m/s urči energii (v J).",
        {
          "a": [
            3,
            10
          ]
        },
        "A body has kinetic energy E_k = m*v^2 / 2. For m=2 kg and v={a} m/s find energy (in J)."
      ]
    ],
    "answers": [
      [
        "{a}*{b}",
        "J"
      ],
      [
        "{a}/{b}",
        "W"
      ],
      [
        "{a}*{b}/1000",
        "kWh"
      ],
      [
        "{a}*{b}",
        "J"
      ],
      [
        "{a}/{f}",
        "m"
      ],
      [
        "{a}*{b}",
        "J"
      ],
      [
        "{a}/{b}",
        "W"
      ],
      [
        "{a}^2",
        "J"
      ]
    ]
  },
  {
    "id": "fy-density-pressure",
    "cs": "Hustota a tlak",
    "en": "Density and pressure",
    "prereq": [
      "fy-force"
    ],
    "topic": "fy-mechanika",
    "auto": false,
    "levels": [
      2,
      3,
      4
    ],
    "kw": [
      [
        "hustota",
        "tlak",
        "pascal",
        "hydrostatický"
      ],
      [
        "density",
        "pressure",
        "pascal",
        "hydrostatic"
      ]
    ],
    "templates": [
      [
        "Těleso má hmotnost {a} g a objem {b} cm³. Jaká je jeho hustota (v g/cm³)?",
        {
          "a": [
            20,
            90
          ],
          "b": [
            2,
            10
          ]
        },
        "A body has mass {a} g and volume {b} cm^3. What is its density (in g/cm^3)?"
      ],
      [
        "Síla {a} N působí kolmo na plochu {b} m². Jaký je tlak (v Pa)?",
        {
          "a": [
            100,
            900
          ],
          "b": [
            2,
            10
          ]
        },
        "A force of {a} N acts perpendicularly on area {b} m^2. What is pressure (in Pa)?"
      ],
      [
        "Jaký je hydrostatický tlak ve vodě v hloubce {a} m? (ρ = 1000 kg/m³, g = 10 m/s²; výsledek v kPa)",
        {
          "a": [
            2,
            20
          ]
        },
        "What is hydrostatic pressure in water at depth {a} m? (rho = 1000 kg/m^3, g = 10 m/s^2; in kPa)"
      ],
      [
        "Látka má hustotu {a} g/cm³ a objem {b} cm³. Jaká je její hmotnost (v g)?",
        {
          "a": [
            2,
            8
          ],
          "b": [
            5,
            20
          ]
        },
        "Substance has density {a} g/cm^3 and volume {b} cm^3. What is mass (in g)?"
      ],
      [
        "Těleso má hustotu {r} g/cm³ a hmotnost {m} g. Jaký je jeho objem (v cm³)?",
        {
          "r": [
            2,
            8
          ],
          "v": [
            2,
            10
          ]
        },
        "Body has density {r} g/cm^3 and mass {m} g. What is volume (in cm^3)?"
      ],
      [
        "Na plochu {b} m² působí tlak {a} Pa. Jaká síla na ni působí (v N)?",
        {
          "a": [
            10,
            50
          ],
          "b": [
            2,
            6
          ]
        },
        "Pressure of {a} Pa acts on area {b} m^2. What force acts on it (in N)?"
      ],
      [
        "Hustota oleje je 900 kg/m³. Jaká je hmotnost {a} m³ oleje (v kg)?",
        {
          "a": [
            2,
            6
          ]
        },
        "Density of oil is 900 kg/m^3. What is mass of {a} m^3 of oil (in kg)?"
      ],
      [
        "Hydrostatický tlak v kapalině o hustotě {a}00 kg/m³ v hloubce 10 m je kolik kPa? (g = 10 m/s²)",
        {
          "a": [
            8,
            12
          ]
        },
        "Hydrostatic pressure in liquid of density {a}00 kg/m^3 at depth 10 m is how many kPa? (g = 10 m/s^2)"
      ]
    ],
    "answers": [
      [
        "{a}/{b}",
        "g/cm³"
      ],
      [
        "{a}/{b}",
        "Pa"
      ],
      [
        "1000*10*{a}/1000",
        "kPa"
      ],
      [
        "{a}*{b}",
        "g"
      ],
      [
        "{m}/{r}",
        "cm³"
      ],
      [
        "{a}*{b}",
        "N"
      ],
      [
        "900*{a}",
        "kg"
      ],
      [
        "{a}00*10*10/1000",
        "kPa"
      ]
    ]
  },
  {
    "id": "fy-draw-forces",
    "cs": "Nakresli síly (kresba)",
    "en": "Draw the forces (drawing)",
    "prereq": [
      "fy-force"
    ],
    "topic": "fy-mechanika",
    "auto": false,
    "drawing": true,
    "kw": [
      [
        "kresba",
        "vektor",
        "síly",
        "nakloněná rovina"
      ],
      [
        "drawing",
        "vector",
        "forces",
        "inclined plane"
      ]
    ],
    "templates": [
      [
        "Nakresli těleso ležící na stole a všechny síly, které na něj působí.",
        null,
        "Draw an object resting on a table and all forces acting upon it."
      ],
      [
        "Nakresli těleso na nakloněné rovině a rozlož tíhovou sílu na dvě složky.",
        null,
        "Draw an object on an inclined plane and decompose gravity into two components."
      ],
      [
        "Nakresli síly působící na závaží zavěšené na pružině.",
        null,
        "Draw forces acting on a weight suspended from a spring."
      ],
      [
        "Nakresli padák s parašutistou a vyznač tíhovou sílu a odpor vzduchu.",
        null,
        "Draw a parachute with skydiver and label gravity and air resistance."
      ],
      [
        "Nakresli loďku plovoucí na hladině a vyznač tíhovou sílu a vztlakovou sílu.",
        null,
        "Draw a boat floating on water and label gravity and buoyant force."
      ],
      [
        "Nakresli dvě přitahující se magnetky a vyznač magnetické síly.",
        null,
        "Draw two attracting magnets and indicate magnetic forces."
      ],
      [
        "Nakresli páku se dvěma závažími v rovnováze a vyznač působící síly.",
        null,
        "Draw a lever with two weights in balance and indicate acting forces."
      ],
      [
        "Nakresli těleso tažené po vodorovné podložce a vyznač třecí sílu.",
        null,
        "Draw an object pulled across a horizontal surface and indicate friction force."
      ]
    ]
  }
]);

topic("fy-elektrina", "Elektřina", "Electricity", [
  {
    "id": "fy-ohm",
    "cs": "Ohmův zákon",
    "en": "Ohm's law",
    "prereq": [],
    "topic": "fy-elektrina",
    "auto": false,
    "levels": [
      1,
      2,
      2
    ],
    "kw": [
      [
        "napětí",
        "proud",
        "odpor",
        "ohm"
      ],
      [
        "voltage",
        "current",
        "resistance",
        "ohm"
      ]
    ],
    "templates": [
      [
        "Rezistor {a} Ω je připojen na napětí {b} V. Jaký proud jím protéká (v A)?",
        {
          "a": [
            5,
            50
          ],
          "b": [
            10,
            100
          ]
        },
        "A resistor of {a} ohm is connected to voltage {b} V. What current flows through it (in A)?"
      ],
      [
        "Obvodem protéká proud {a} A při napětí {b} V. Jaký je odpor (v Ω)?",
        {
          "a": [
            2,
            10
          ],
          "b": [
            20,
            120
          ]
        },
        "A current of {a} A flows at voltage {b} V. What is resistance (in ohm)?"
      ],
      [
        "Rezistorem o odporu {b} Ω protéká proud {a} A. Jaké je napětí (ve V)?",
        {
          "a": [
            2,
            10
          ],
          "b": [
            5,
            50
          ]
        },
        "A current of {a} A flows through resistance {b} ohm. What is voltage (in V)?"
      ],
      [
        "Spotřebič s odporem {r} Ω je napájen napětím {b} V. Jaký proud odebírá (v A)?",
        {
          "r": [
            5,
            25
          ],
          "b": [
            10,
            50
          ]
        },
        "An appliance with resistance {r} ohm is powered by {b} V. What current does it draw (in A)?"
      ],
      [
        "Při napětí {b} V protéká proud 2 A. Jaký je odpor obvodu (v Ω)?",
        {
          "b": [
            10,
            80
          ]
        },
        "At voltage {b} V, a current of 2 A flows. What is circuit resistance (in ohm)?"
      ],
      [
        "Rezistor má odpor {a} Ω a protéká jím proud {b} A. Urči napětí na rezistoru (ve V).",
        {
          "a": [
            10,
            40
          ],
          "b": [
            1,
            4
          ]
        },
        "A resistor has resistance {a} ohm and current {b} A flows through it. Find voltage (in V)."
      ],
      [
        "Žárovka o odporu 100 Ω je připojena k síti {a}0 V. Jaký proud jí protéká (v A)?",
        {
          "a": [
            12,
            23
          ]
        },
        "A 100 ohm bulb is connected to {a}0 V mains. What current flows through it (in A)?"
      ],
      [
        "Jaké napětí je potřeba, aby rezistorem 50 Ω tekl proud {a} A (ve V)?",
        {
          "a": [
            1,
            6
          ]
        },
        "What voltage is needed to push current of {a} A through a 50 ohm resistor (in V)?"
      ]
    ],
    "answers": [
      [
        "{b}/{a}",
        "A"
      ],
      [
        "{b}/{a}",
        "Ω"
      ],
      [
        "{a}*{b}",
        "V"
      ],
      [
        "{b}/{r}",
        "A"
      ],
      [
        "{b}/2",
        "Ω"
      ],
      [
        "{a}*{b}",
        "V"
      ],
      [
        "{a}0/100",
        "A"
      ],
      [
        "50*{a}",
        "V"
      ]
    ]
  },
  {
    "id": "fy-resistors",
    "cs": "Sériové a paralelní zapojení",
    "en": "Series and parallel circuits",
    "prereq": [
      "fy-ohm"
    ],
    "topic": "fy-elektrina",
    "auto": false,
    "levels": [
      2,
      3,
      4
    ],
    "kw": [
      [
        "rezistory",
        "sériově",
        "paralelně",
        "celkový odpor"
      ],
      [
        "resistors",
        "series",
        "parallel",
        "total resistance"
      ]
    ],
    "templates": [
      [
        "Dva rezistory {a} Ω a {b} Ω jsou zapojeny sériově. Jaký je celkový odpor (v Ω)?",
        {
          "a": [
            10,
            60
          ],
          "b": [
            10,
            60
          ]
        },
        "Two resistors {a} ohm and {b} ohm are connected in series. What is total resistance (in ohm)?"
      ],
      [
        "Dva rezistory {a} Ω a {b} Ω jsou zapojeny paralelně. Jaký je celkový odpor (v Ω)?",
        {
          "a": [
            10,
            60
          ],
          "b": [
            10,
            60
          ]
        },
        "Two resistors {a} ohm and {b} ohm are connected in parallel. What is total resistance (in ohm)?"
      ],
      [
        "Dva stejné rezistory {a} Ω zapojíš paralelně a sériově k nim připojíš rezistor {b} Ω. Jaký je celkový odpor (v Ω)?",
        {
          "a": [
            10,
            60
          ],
          "b": [
            5,
            40
          ]
        },
        "Two equal {a} ohm resistors are in parallel, in series with {b} ohm resistor. What is total resistance (in ohm)?"
      ],
      [
        "Tři stejné rezistory {a} Ω zapojíš sériově. Jaký je celkový odpor (v Ω)?",
        {
          "a": [
            10,
            50
          ]
        },
        "Three equal {a} ohm resistors are connected in series. What is total resistance (in ohm)?"
      ],
      [
        "Dva stejné rezistory {a} Ω zapojíš paralelně. Jaký je výsledný odpor (v Ω)?",
        {
          "a": [
            10,
            80
          ]
        },
        "Two identical {a} ohm resistors are connected in parallel. What is resulting resistance (in ohm)?"
      ],
      [
        "Rezistory {a} Ω, {b} Ω a 10 Ω jsou v sérii. Jaký je celkový odpor (v Ω)?",
        {
          "a": [
            10,
            30
          ],
          "b": [
            10,
            30
          ]
        },
        "Resistors {a} ohm, {b} ohm, and 10 ohm are in series. What is total resistance (in ohm)?"
      ],
      [
        "Čtyři stejné rezistory {a} Ω jsou zapojeny v sérii. Urči celkový odpor (v Ω).",
        {
          "a": [
            5,
            25
          ]
        },
        "Four identical {a} ohm resistors are in series. Find total resistance (in ohm)?"
      ],
      [
        "Paralelní kombinace dvou rezistorů 20 Ω a 20 Ω má jaký odpor (v Ω)?",
        null,
        "What is resistance of parallel combination of two 20 ohm resistors (in ohm)?"
      ]
    ],
    "answers": [
      [
        "{a}+{b}",
        "Ω"
      ],
      [
        "1/(1/{a}+1/{b})",
        "Ω"
      ],
      [
        "{a}/2+{b}",
        "Ω"
      ],
      [
        "3*{a}",
        "Ω"
      ],
      [
        "{a}/2",
        "Ω"
      ],
      [
        "{a}+{b}+10",
        "Ω"
      ],
      [
        "4*{a}",
        "Ω"
      ],
      [
        "10",
        "Ω"
      ]
    ]
  },
  {
    "id": "fy-electric-power",
    "cs": "Elektrický příkon a energie",
    "en": "Electric power and energy",
    "prereq": [
      "fy-ohm"
    ],
    "topic": "fy-elektrina",
    "auto": false,
    "levels": [
      2,
      3,
      3
    ],
    "kw": [
      [
        "příkon",
        "spotřeba",
        "kwh",
        "cena elektřiny"
      ],
      [
        "power",
        "energy use",
        "kwh",
        "electricity cost"
      ]
    ],
    "templates": [
      [
        "Spotřebič je připojen na napětí {a} V a protéká jím proud {b} A. Jaký je příkon (ve W)?",
        {
          "a": [
            12,
            230
          ],
          "b": [
            1,
            9
          ]
        },
        "An appliance is connected to {a} V and current {b} A flows. What is power (in W)?"
      ],
      [
        "Žehlička s příkonem 2000 W je zapnutá {a} h. Kolik kWh spotřebuje?",
        {
          "a": [
            1,
            6
          ]
        },
        "An iron with power 2000 W is on for {a} h. How many kWh does it consume?"
      ],
      [
        "Elektřina stojí {a} Kč za kWh. Spotřebič s příkonem 1,5 kW běží {b} h. Kolik zaplatíš (v Kč)?",
        {
          "a": [
            5,
            9
          ],
          "b": [
            2,
            8
          ]
        },
        "Electricity costs {a} CZK per kWh. A 1.5 kW appliance runs for {b} h. How much do you pay (in CZK)?"
      ],
      [
        "Topné těleso o příkonu {a} W je zapnuto {b} h. Kolik Wh energie spotřebuje?",
        {
          "a": [
            100,
            500
          ],
          "b": [
            2,
            6
          ]
        },
        "A heater of {a} W is on for {b} h. How many Wh of energy does it consume?"
      ],
      [
        "Spotřebič odebírá proud {b} A při napětí 230 V. Jaký je příkon (ve W)?",
        {
          "b": [
            2,
            10
          ]
        },
        "An appliance draws {b} A at 230 V. What is its power (in W)?"
      ],
      [
        "Přístroj s příkonem {a} W běží 10 hodin. Kolik kWh spotřebuje?",
        {
          "a": [
            100,
            900
          ]
        },
        "A device with power {a} W runs for 10 hours. How many kWh does it consume?"
      ],
      [
        "Při napětí 12 V a příkonu {a} W jaký proud protéká obvodem (v A)?",
        {
          "a": [
            24,
            72
          ]
        },
        "At voltage 12 V and power {a} W, what current flows through circuit (in A)?"
      ],
      [
        "LED žárovka má příkon 10 W a svítí {a}0 hodin. Kolik kWh spotřebuje?",
        {
          "a": [
            1,
            5
          ]
        },
        "A 10 W LED bulb shines for {a}0 hours. How many kWh does it consume?"
      ]
    ],
    "answers": [
      [
        "{a}*{b}",
        "W"
      ],
      [
        "2*{a}",
        "kWh"
      ],
      [
        "{a}*1.5*{b}",
        "Kč"
      ],
      [
        "{a}*{b}",
        "Wh"
      ],
      [
        "230*{b}",
        "W"
      ],
      [
        "{a}*10/1000",
        "kWh"
      ],
      [
        "{a}/12",
        "A"
      ],
      [
        "10*{a}0/1000",
        "kWh"
      ]
    ]
  },
  {
    "id": "fy-draw-circuit",
    "cs": "Nakresli schéma obvodu (kresba)",
    "en": "Draw a circuit diagram (drawing)",
    "prereq": [
      "fy-ohm"
    ],
    "topic": "fy-elektrina",
    "auto": false,
    "drawing": true,
    "kw": [
      [
        "schéma",
        "obvod",
        "žárovka",
        "baterie",
        "ampérmetr"
      ],
      [
        "circuit diagram",
        "bulb",
        "battery",
        "ammeter"
      ]
    ],
    "templates": [
      [
        "Nakresli schéma obvodu: baterie, vypínač a žárovka zapojené za sebou.",
        null,
        "Draw a circuit diagram: battery, switch, and lamp in series."
      ],
      [
        "Nakresli obvod se dvěma žárovkami zapojenými vedle sebe (paralelně) k jedné baterii.",
        null,
        "Draw a circuit with two lamps connected in parallel to one battery."
      ],
      [
        "Nakresli obvod s ampérmetrem a voltmetrem u žárovky a vyznač, jak se zapojují.",
        null,
        "Draw a circuit with ammeter and voltmeter measuring a lamp and indicate connection."
      ],
      [
        "Nakresli obvod se dvěma bateriemi v sérii, spínačem a rezistorem.",
        null,
        "Draw a circuit with two batteries in series, switch, and resistor."
      ],
      [
        "Nakresli obvod s rezistorem a reostatem (nastavitelným odporem).",
        null,
        "Draw a circuit with a resistor and rheostat (variable resistor)."
      ],
      [
        "Nakresli obvod se střídavým zdrojem, diodou a žárovkou.",
        null,
        "Draw a circuit with an AC source, diode, and lamp."
      ],
      [
        "Nakresli schéma děliče napětí se dvěma sériovými rezistory.",
        null,
        "Draw a schematic of a voltage divider with two resistors in series."
      ],
      [
        "Nakresli obvod s uzlem, kde se proud dělí do dvou paralelních větví.",
        null,
        "Draw a circuit showing a junction where current splits into two branches."
      ]
    ]
  }
]);

topic("ch-latkove-mnozstvi", "Látkové množství a roztoky", "Amount of substance and solutions", [
  {
    "id": "ch-molar-mass",
    "cs": "Molární hmotnost",
    "en": "Molar mass",
    "prereq": [],
    "topic": "ch-latkove-mnozstvi",
    "auto": false,
    "levels": [
      1,
      2,
      3
    ],
    "kw": [
      [
        "molární hmotnost",
        "relativní atomová hmotnost",
        "vzorec"
      ],
      [
        "molar mass",
        "atomic mass",
        "formula"
      ]
    ],
    "templates": [
      [
        "Vypočítej molární hmotnost vody H₂O v g/mol (Ar: H = 1, O = 16).",
        null,
        "Calculate molar mass of water H2O in g/mol (Ar: H = 1, O = 16)."
      ],
      [
        "Vypočítej molární hmotnost oxidu uhličitého CO₂ v g/mol (Ar: C = 12, O = 16).",
        null,
        "Calculate molar mass of carbon dioxide CO2 in g/mol (Ar: C = 12, O = 16)."
      ],
      [
        "Vypočítej molární hmotnost kyseliny sírové H₂SO₄ v g/mol (Ar: H = 1, S = 32, O = 16).",
        null,
        "Calculate molar mass of sulfuric acid H2SO4 in g/mol (Ar: H = 1, S = 32, O = 16)."
      ],
      [
        "Vypočítej molární hmotnost chloridu sodného NaCl v g/mol (Ar: Na = 23, Cl = 35.5).",
        null,
        "Calculate molar mass of sodium chloride NaCl in g/mol (Ar: Na = 23, Cl = 35.5)."
      ],
      [
        "Vypočítej molární hmotnost hydroxidu sodného NaOH v g/mol (Ar: Na = 23, O = 16, H = 1).",
        null,
        "Calculate molar mass of sodium hydroxide NaOH in g/mol (Ar: Na = 23, O = 16, H = 1)."
      ],
      [
        "Vypočítej molární hmotnost kyseliny chlorovodíkové HCl v g/mol (Ar: H = 1, Cl = 35.5).",
        null,
        "Calculate molar mass of hydrochloric acid HCl in g/mol (Ar: H = 1, Cl = 35.5)."
      ],
      [
        "Vypočítej molární hmotnost uhličitanu vápenatého CaCO₃ v g/mol (Ar: Ca = 40, C = 12, O = 16).",
        null,
        "Calculate molar mass of calcium carbonate CaCO3 in g/mol (Ar: Ca = 40, C = 12, O = 16)."
      ],
      [
        "Vypočítej molární hmotnost amoniaku NH₃ v g/mol (Ar: N = 14, H = 1).",
        null,
        "Calculate molar mass of ammonia NH3 in g/mol (Ar: N = 14, H = 1)."
      ],
      [
        "Vypočítej molární hmotnost methanu CH₄ v g/mol (Ar: C = 12, H = 1).",
        null,
        "Calculate molar mass of methane CH4 in g/mol (Ar: C = 12, H = 1)."
      ],
      [
        "Vypočítej molární hmotnost glukózy C₆H₁₂O₆ v g/mol (Ar: C = 12, H = 1, O = 16).",
        null,
        "Calculate molar mass of glucose C6H12O6 in g/mol (Ar: C = 12, H = 1, O = 16)."
      ],
      [
        "Vypočítej molární hmotnost oxidu vápenatého CaO v g/mol (Ar: Ca = 40, O = 16).",
        null,
        "Calculate molar mass of calcium oxide CaO in g/mol (Ar: Ca = 40, O = 16)."
      ],
      [
        "Vypočítej molární hmotnost dusičnanu draselného KNO₃ v g/mol (Ar: K = 39, N = 14, O = 16).",
        null,
        "Calculate molar mass of potassium nitrate KNO3 in g/mol (Ar: K = 39, N = 14, O = 16)."
      ]
    ],
    "answers": [
      [
        "2*1+16",
        "g/mol"
      ],
      [
        "12+2*16",
        "g/mol"
      ],
      [
        "2*1+32+4*16",
        "g/mol"
      ],
      [
        "23+35.5",
        "g/mol"
      ],
      [
        "23+16+1",
        "g/mol"
      ],
      [
        "1+35.5",
        "g/mol"
      ],
      [
        "40+12+3*16",
        "g/mol"
      ],
      [
        "14+3*1",
        "g/mol"
      ],
      [
        "12+4*1",
        "g/mol"
      ],
      [
        "6*12+12*1+6*16",
        "g/mol"
      ],
      [
        "40+16",
        "g/mol"
      ],
      [
        "39+14+3*16",
        "g/mol"
      ]
    ]
  },
  {
    "id": "ch-mole",
    "cs": "Látkové množství (n = m / M)",
    "en": "Amount of substance (n = m / M)",
    "prereq": [
      "ch-molar-mass"
    ],
    "topic": "ch-latkove-mnozstvi",
    "auto": false,
    "levels": [
      2,
      3,
      4
    ],
    "kw": [
      [
        "mol",
        "látkové množství",
        "avogadro"
      ],
      [
        "mole",
        "amount of substance",
        "avogadro"
      ]
    ],
    "templates": [
      [
        "Kolik molů je {a} g vody? (M = 18 g/mol)",
        {
          "a": [
            36,
            180
          ]
        },
        "How many moles is {a} g of water? (M = 18 g/mol)"
      ],
      [
        "Kolik gramů má {a} mol chloridu sodného NaCl? (M = 58,5 g/mol)",
        {
          "a": [
            2,
            6
          ]
        },
        "How many grams is {a} mol of sodium chloride NaCl? (M = 58.5 g/mol)"
      ],
      [
        "Kolik částic je v {a} mol látky? (N_A = 6,02·10^23 /mol; výsledek zapiš jako číslo, třeba 1,2·10^24)",
        {
          "a": [
            2,
            5
          ]
        },
        "How many particles in {a} mol of substance? (N_A = 6.02*10^23 /mol)"
      ],
      [
        "Kolik molů je {a} g oxidu uhličitého CO₂? (M = 44 g/mol)",
        {
          "a": [
            44,
            264
          ]
        },
        "How many moles is {a} g of carbon dioxide CO2? (M = 44 g/mol)"
      ],
      [
        "Kolik molů je {a} g hydroxidu sodného NaOH? (M = 40 g/mol)",
        {
          "a": [
            40,
            200
          ]
        },
        "How many moles is {a} g of sodium hydroxide NaOH? (M = 40 g/mol)"
      ],
      [
        "Kolik gramů má {a} mol oxidu vápenatého CaO? (M = 56 g/mol)",
        {
          "a": [
            1,
            5
          ]
        },
        "How many grams is {a} mol of calcium oxide CaO? (M = 56 g/mol)"
      ],
      [
        "Kolik molů je {a} g kyseliny sírové H₂SO₄? (M = 98 g/mol)",
        {
          "a": [
            98,
            490
          ]
        },
        "How many moles is {a} g of sulfuric acid H2SO4? (M = 98 g/mol)"
      ],
      [
        "Kolik gramů má {a} mol amoniaku NH₃? (M = 17 g/mol)",
        {
          "a": [
            2,
            8
          ]
        },
        "How many grams is {a} mol of ammonia NH3? (M = 17 g/mol)"
      ],
      [
        "Kolik molů je {a} g uhličitanu vápenatého CaCO₃? (M = 100 g/mol)",
        {
          "a": [
            100,
            600
          ]
        },
        "How many moles is {a} g of calcium carbonate CaCO3? (M = 100 g/mol)"
      ]
    ],
    "answers": [
      [
        "{a}/18",
        "mol"
      ],
      [
        "{a}*58.5",
        "g"
      ],
      [
        "{a}*6.02*10^23"
      ],
      [
        "{a}/44",
        "mol"
      ],
      [
        "{a}/40",
        "mol"
      ],
      [
        "{a}*56",
        "g"
      ],
      [
        "{a}/98",
        "mol"
      ],
      [
        "{a}*17",
        "g"
      ],
      [
        "{a}/100",
        "mol"
      ]
    ]
  },
  {
    "id": "ch-concentration",
    "cs": "Koncentrace roztoku",
    "en": "Concentration of a solution",
    "prereq": [
      "ch-mole"
    ],
    "topic": "ch-latkove-mnozstvi",
    "auto": false,
    "levels": [
      2,
      3,
      3
    ],
    "kw": [
      [
        "koncentrace",
        "roztok",
        "hmotnostní zlomek",
        "mol/l"
      ],
      [
        "concentration",
        "solution",
        "mass fraction",
        "mol/l"
      ]
    ],
    "templates": [
      [
        "Rozpustíš {a} mol látky v {b} l roztoku. Jaká je molární koncentrace (v mol/l)?",
        {
          "a": [
            1,
            6
          ],
          "b": [
            2,
            4
          ]
        },
        "You dissolve {a} mol of substance in {b} l of solution. What is molar concentration (in mol/l)?"
      ],
      [
        "Roztok má koncentraci {a} mol/l a objem {b} l. Kolik molů látky obsahuje?",
        {
          "a": [
            1,
            5
          ],
          "b": [
            2,
            6
          ]
        },
        "A solution has concentration {a} mol/l and volume {b} l. How many moles does it contain?"
      ],
      [
        "Rozpustíš {a} g soli ve {b} g vody. Jaký je hmotnostní zlomek soli v roztoku (v %)?",
        {
          "a": [
            10,
            40
          ],
          "b": [
            60,
            190
          ]
        },
        "You dissolve {a} g of salt in {b} g of water. What is mass percentage of salt (in %)?"
      ],
      [
        "Vypočítej molární koncentraci roztoku, který v {b} l obsahuje {a} mol látky (v mol/l).",
        {
          "a": [
            2,
            8
          ],
          "b": [
            2,
            5
          ]
        },
        "Calculate molar concentration of solution containing {a} mol in {b} l (in mol/l)."
      ],
      [
        "Kolik molů látky je v {b} l roztoku o koncentraci {a} mol/l?",
        {
          "a": [
            1,
            4
          ],
          "b": [
            1,
            5
          ]
        },
        "How many moles of substance in {b} l of solution of concentration {a} mol/l?"
      ],
      [
        "Rozpustíš {a} mol glukózy ve 2 l vody. Jaká je koncentrace (v mol/l)?",
        {
          "a": [
            2,
            8
          ]
        },
        "You dissolve {a} mol of glucose in 2 l of water. What is concentration (in mol/l)?"
      ],
      [
        "Ve 100 g roztoku je {a} g soli. Jaký je hmotnostní zlomek (v %)?",
        {
          "a": [
            5,
            25
          ]
        },
        "In 100 g of solution there is {a} g of salt. What is mass percent (in %)?"
      ],
      [
        "Kolik gramů cukru je potřeba na 200 g roztoku o koncentraci {a} %?",
        {
          "a": [
            5,
            20
          ]
        },
        "How many grams of sugar needed for 200 g of solution with concentration {a}%?"
      ]
    ],
    "answers": [
      [
        "{a}/{b}",
        "mol/l"
      ],
      [
        "{a}*{b}",
        "mol"
      ],
      [
        "{a}/({a}+{b})*100",
        "%"
      ],
      [
        "{a}/{b}",
        "mol/l"
      ],
      [
        "{a}*{b}",
        "mol"
      ],
      [
        "{a}/2",
        "mol/l"
      ],
      [
        "{a}",
        "%"
      ],
      [
        "200*{a}/100",
        "g"
      ]
    ]
  },
  {
    "id": "ch-stoichiometry",
    "cs": "Stechiometrie reakcí",
    "en": "Reaction stoichiometry",
    "prereq": [
      "ch-mole"
    ],
    "topic": "ch-latkove-mnozstvi",
    "auto": false,
    "levels": [
      3,
      3,
      4
    ],
    "kw": [
      [
        "reakce",
        "stechiometrie",
        "chemická rovnice"
      ],
      [
        "reaction",
        "stoichiometry",
        "chemical equation"
      ]
    ],
    "templates": [
      [
        "2 H₂ + O₂ → 2 H₂O. Z {a} mol vodíku vznikne kolik mol vody?",
        {
          "a": [
            2,
            8
          ]
        },
        "2 H2 + O2 -> 2 H2O. From {a} mol of hydrogen, how many moles of water are formed?"
      ],
      [
        "2 H₂ + O₂ → 2 H₂O. Kolik gramů vody vznikne z {a} mol vodíku? (M(H₂O) = 18 g/mol)",
        {
          "a": [
            2,
            8
          ]
        },
        "2 H2 + O2 -> 2 H2O. How many grams of water from {a} mol of hydrogen? (M(H2O) = 18 g/mol)"
      ],
      [
        "N₂ + 3 H₂ → 2 NH₃. Kolik mol amoniaku vznikne z {a} mol dusíku?",
        {
          "a": [
            1,
            6
          ]
        },
        "N2 + 3 H2 -> 2 NH3. How many moles of ammonia are formed from {a} mol of nitrogen?"
      ],
      [
        "CH₄ + 2 O₂ → CO₂ + 2 H₂O. Kolik molů CO₂ vznikne spálením {a} molů methanu?",
        {
          "a": [
            1,
            6
          ]
        },
        "CH4 + 2 O2 -> CO2 + 2 H2O. How many moles of CO2 from combustion of {a} mol of methane?"
      ],
      [
        "2 Na + 2 H₂O → 2 NaOH + H₂. Kolik molů H₂ vznikne z {a} molů sodíku Na?",
        {
          "a": [
            2,
            8
          ]
        },
        "2 Na + 2 H2O -> 2 NaOH + H2. How many moles of H2 formed from {a} mol of sodium Na?"
      ],
      [
        "CaCO₃ → CaO + CO₂. Kolik molů CaO vznikne rozkladem {a} molů CaCO₃?",
        {
          "a": [
            1,
            8
          ]
        },
        "CaCO3 -> CaO + CO2. How many moles of CaO from decomposition of {a} mol of CaCO3?"
      ],
      [
        "2 H₂ + O₂ → 2 H₂O. Kolik molů kyslíku O₂ je potřeba na reakci s 2*{a} moly vodíku?",
        {
          "a": [
            1,
            5
          ]
        },
        "2 H2 + O2 -> 2 H2O. How many moles of O2 needed to react with 2*{a} moles of H2?"
      ],
      [
        "C + O₂ → CO₂. Kolik molů oxidu uhličitého vznikne z {a} molů uhlíku?",
        {
          "a": [
            2,
            10
          ]
        },
        "C + O2 -> CO2. How many moles of carbon dioxide from {a} mol of carbon?"
      ]
    ],
    "answers": [
      [
        "{a}",
        "mol"
      ],
      [
        "{a}*18",
        "g"
      ],
      [
        "2*{a}",
        "mol"
      ],
      [
        "{a}",
        "mol"
      ],
      [
        "{a}/2",
        "mol"
      ],
      [
        "{a}",
        "mol"
      ],
      [
        "{a}",
        "mol"
      ],
      [
        "{a}",
        "mol"
      ]
    ]
  },
  {
    "id": "ch-balance",
    "cs": "Vyčíslování rovnic",
    "en": "Balancing equations",
    "prereq": [
      "ch-molar-mass"
    ],
    "topic": "ch-latkove-mnozstvi",
    "auto": false,
    "kw": [
      [
        "vyčíslit",
        "koeficienty",
        "chemická rovnice"
      ],
      [
        "balance",
        "coefficients",
        "chemical equation"
      ]
    ],
    "templates": [
      [
        "Vyčísli rovnici: H₂ + O₂ → H₂O",
        null,
        "Balance the equation: H2 + O2 -> H2O"
      ],
      [
        "Vyčísli rovnici: Fe + O₂ → Fe₂O₃",
        null,
        "Balance the equation: Fe + O2 -> Fe2O3"
      ],
      [
        "Vyčísli rovnici: C₃H₈ + O₂ → CO₂ + H₂O",
        null,
        "Balance the equation: C3H8 + O2 -> CO2 + H2O"
      ],
      [
        "Vyčísli rovnici: CO + O₂ → CO₂",
        null,
        "Balance the equation: CO + O2 -> CO2"
      ],
      [
        "Vyčísli rovnici: CH₄ + O₂ → CO₂ + H₂O",
        null,
        "Balance the equation: CH4 + O2 -> CO2 + H2O"
      ],
      [
        "Vyčísli rovnici: Na + H₂O → NaOH + H₂",
        null,
        "Balance the equation: Na + H2O -> NaOH + H2"
      ],
      [
        "Vyčísli rovnici: Al + O₂ → Al₂O₃",
        null,
        "Balance the equation: Al + O2 -> Al2O3"
      ],
      [
        "Vyčísli rovnici: N₂ + H₂ → NH₃",
        null,
        "Balance the equation: N2 + H2 -> NH3"
      ],
      [
        "Vyčísli rovnici: Mg + O₂ → MgO",
        null,
        "Balance the equation: Mg + O2 -> MgO"
      ],
      [
        "Vyčísli rovnici: CaCO₃ → CaO + CO₂",
        null,
        "Balance the equation: CaCO3 -> CaO + CO2"
      ],
      [
        "Vyčísli rovnici: KClO₃ → KCl + O₂",
        null,
        "Balance the equation: KClO3 -> KCl + O2"
      ],
      [
        "Vyčísli rovnici: Zn + HCl → ZnCl₂ + H₂",
        null,
        "Balance the equation: Zn + HCl -> ZnCl2 + H2"
      ]
    ]
  },
  {
    "id": "ch-draw-structure",
    "cs": "Nakresli strukturní vzorec (kresba)",
    "en": "Draw a structural formula (drawing)",
    "prereq": [
      "ch-molar-mass"
    ],
    "topic": "ch-latkove-mnozstvi",
    "auto": false,
    "drawing": true,
    "kw": [
      [
        "strukturní vzorec",
        "vazby",
        "kresba",
        "uhlovodíky"
      ],
      [
        "structural formula",
        "bonds",
        "drawing",
        "hydrocarbons"
      ]
    ],
    "templates": [
      [
        "Nakresli strukturní vzorec vody a vyznač vazby.",
        null,
        "Draw the structural formula of water and label bonds."
      ],
      [
        "Nakresli strukturní vzorec methanu CH₄.",
        null,
        "Draw the structural formula of methane CH4."
      ],
      [
        "Nakresli strukturní vzorec ethanolu C₂H₅OH.",
        null,
        "Draw the structural formula of ethanol C2H5OH."
      ],
      [
        "Nakresli strukturní vzorec oxidu uhličitého CO₂.",
        null,
        "Draw the structural formula of carbon dioxide CO2."
      ],
      [
        "Nakresli strukturní vzorec amoniaku NH₃.",
        null,
        "Draw the structural formula of ammonia NH3."
      ],
      [
        "Nakresli strukturní vzorec ethenu C₂H₄ s dvojnou vazbou.",
        null,
        "Draw the structural formula of ethene C2H4 with double bond."
      ],
      [
        "Nakresli strukturní vzorec kyseliny octové CH₃COOH.",
        null,
        "Draw the structural formula of acetic acid CH3COOH."
      ],
      [
        "Nakresli strukturní vzorec propanu C₃H₈.",
        null,
        "Draw the structural formula of propane C3H8."
      ]
    ]
  }
]);
