import type { ProblemTemplate, Skill, Topic } from "@openmathtutor/shared";

/**
 * Additional original practice material. Everything here is written for this
 * project against the *publicly documented* exam topics (Cermat specifications,
 * general first-year curricula) — no past exam item is reproduced.
 *
 * Skills with `autoCheck: false` cannot be verified by the local checker or the
 * SymPy verifier (geometry, systems, functions, calculus, ...): the tutor still
 * guides them, but the UI says plainly that steps are not machine-checked.
 * Statements are Czech course text; they are shown as written in both UI languages.
 */
type Ranges = Record<string, [number, number]>;
type Tpl = [statement: string, ranges?: Ranges];
interface SkillSpec {
  id: string; cs: string; en: string; prereq: string[]; topic: string; levels?: [number, number, number];
  auto?: boolean; free?: boolean; kw?: [string[], string[]]; templates: [Tpl, Tpl, Tpl];
  /** Per-template expected answer, for skills defined with their own formulas (physics, chemistry). */
  answers?: ([formula: string, unit?: string] | undefined)[];
  drawing?: boolean;
}

/** Expected numeric answers (formula over the generator names, optional unit) for templates that cannot be solved from their statement text. */
const ANSWERS: Record<string, [formula: string, unit?: string]> = {
  "proportion-1": ["{b}/{a}*{c}", "Kč"], "proportion-2": ["{a}*{b}/{c}", "h"], "proportion-3": ["{a}*1000*{b}/100000", "km"],
  "stats-basic-1": ["({a}+{b}+{c}+{d})/4"], "stats-basic-3": ["3*{a}-{b}-{c}"],
  "pythagoras-1": ["{a}^2+{b}^2", "cm²"], "pythagoras-2": ["{c}^2-{a}^2", "cm²"], "pythagoras-3": ["{a}^2+{b}^2", "cm²"],
  "circle-area-1": ["{a}^2", "π cm²"], "circle-area-3": ["{a}", "π m"],
  "solids-volume-1": ["{a}^3", "cm³"], "solids-volume-3": ["{a}^2*{b}", "π cm³"],
  "counting-basic-2": ["{a}*{b}"], "counting-basic-3": ["{a}*({a}-1)/2"],
  "arith-seq-1": ["{a}+9*{b}"], "arith-seq-3": ["{a}/2*(4+({a}-1)*3)"],
  "geom-seq-1": ["{a}*16"], "geom-seq-3": ["2^{a}-1"],
  "finance-interest-1": ["{a}*1000*(1+{b}/100)", "Kč"], "finance-interest-2": ["{a}*(1+{b}/100)*(1-{b}/100)", "Kč"],
  "comb-formulas-1": ["{a}*({a}-1)/2"], "comb-formulas-2": ["{a}*({a}-1)*({a}-2)*({a}-3)"],
  "probability-basic-2": ["{a}/({a}+{b})"],
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
    s.templates.forEach(([statementTemplate, generatorRanges], i) => extraTemplates.push({
      id: ids[i]!, skillId: s.id, difficultyLevel: levels[i]!, topic: id, statementTemplate,
      ...(generatorRanges ? { generatorRanges } : {}), ...(s.free === false ? {} : s.auto === false ? { freeText: true } : {}),
      ...(ANSWERS[ids[i]!] ? { answerTemplate: ANSWERS[ids[i]!]![0], ...(ANSWERS[ids[i]!]![1] ? { answerUnit: ANSWERS[ids[i]!]![1] } : {}) } : {}),
      ...(s.answers?.[i] ? { answerTemplate: s.answers[i]![0], ...(s.answers[i]![1] ? { answerUnit: s.answers[i]![1] } : {}) } : {}),
    }));
  }
}
const NOAUTO = { auto: false } as const;

// ---------------------------------------------------------------- základní škola / přijímačky SŠ
topic("mocniny-a-vyrazy", "Mocniny a výrazy", "Powers and expressions", [
  { id: "powers-basic", cs: "Druhé mocniny a mocniny čísel", en: "Squares and powers of numbers", prereq: ["arithmetic-integers"], topic: "mocniny-a-vyrazy",
    kw: [["mocnina", "na druhou", "umocňování"], ["power", "square", "exponent"]], levels: [1, 2, 3],
    templates: [["{a}^2", { a: [2, 12] }], ["{a}^2+{b}^2", { a: [2, 9], b: [2, 9] }], ["({a}+{b})^2-{c}", { a: [1, 6], b: [1, 6], c: [1, 30] }]] },
  { id: "expression-formulas", cs: "Vzorce (a ± b)² a a² − b²", en: "Formulas (a ± b)² and a² − b²", prereq: ["powers-basic"], topic: "mocniny-a-vyrazy", ...NOAUTO,
    kw: [["roznásobit", "rozklad", "součin", "vzorec"], ["expand", "factor", "identity"]],
    templates: [["Roznásob podle vzorce: (x+{a})^2", { a: [1, 9] }], ["Rozlož na součin: x^2-{a}^2", { a: [2, 12] }], ["Zjednoduš: (x+{a})^2-(x-{a})^2", { a: [1, 9] }]] },
]);
topic("soustavy-rovnic", "Soustavy rovnic", "Systems of equations", [
  { id: "systems-2x2", cs: "Soustava dvou lineárních rovnic", en: "System of two linear equations", prereq: ["linear-equations-basic"], topic: "soustavy-rovnic", ...NOAUTO,
    kw: [["soustava", "dosazovací", "sčítací", "dvě rovnice"], ["system", "substitution", "elimination"]],
    templates: [["Řeš soustavu: x+y={a}, x-y={b}", { a: [6, 20], b: [2, 4] }], ["Řeš soustavu: 2x+y={a}, x-y={b}", { a: [8, 20], b: [1, 4] }], ["Řeš soustavu: {a}x+2y={b}, x+y={c}", { a: [3, 6], b: [10, 30], c: [3, 8] }]] },
]);
topic("zavislosti-a-data", "Závislosti a data", "Relations and data", [
  { id: "proportion", cs: "Přímá a nepřímá úměrnost", en: "Direct and inverse proportion", prereq: ["fractions-basic"], topic: "zavislosti-a-data", ...NOAUTO,
    kw: [["trojčlenka", "úměra", "úměrnost"], ["rule of three", "proportion"]], levels: [1, 2, 3],
    templates: [["{a} kg jablek stojí {b} Kč. Kolik stojí {c} kg stejných jablek?", { a: [2, 5], b: [40, 120], c: [6, 10] }],
      ["{a} dělníků vykope příkop za {b} hodin. Za kolik hodin ho vykope {c} dělníků, pracují-li stejně rychle?", { a: [2, 6], b: [12, 24], c: [3, 12] }],
      ["Mapa má měřítko 1 : {a}000. Vzdálenost na mapě je {b} cm. Kolik km je to ve skutečnosti?", { a: [20, 50], b: [3, 12] }]] },
  { id: "stats-basic", cs: "Aritmetický průměr a medián", en: "Mean and median", prereq: ["arithmetic-integers"], topic: "zavislosti-a-data", ...NOAUTO,
    kw: [["průměr", "medián", "statistika", "četnost"], ["average", "mean", "median", "statistics"]], levels: [1, 2, 3],
    templates: [["Vypočítej aritmetický průměr čísel {a}, {b}, {c}, {d}.", { a: [1, 9], b: [1, 9], c: [1, 9], d: [1, 9] }],
      ["Urči medián čísel {a}, {b}, {c}, {d}, {e}.", { a: [1, 20], b: [1, 20], c: [1, 20], d: [1, 20], e: [1, 20] }],
      ["Průměr tří čísel je {a}. Dvě z nich jsou {b} a {c}. Jaké je třetí číslo?", { a: [5, 12], b: [1, 9], c: [1, 9] }]] },
]);
topic("geometrie", "Geometrie", "Geometry", [
  { id: "pythagoras", cs: "Pythagorova věta", en: "Pythagorean theorem", prereq: ["powers-basic"], topic: "geometrie", ...NOAUTO,
    kw: [["trojúhelník", "přepona", "odvěsna", "pravoúhlý"], ["triangle", "hypotenuse", "right angle"]],
    templates: [["Pravoúhlý trojúhelník má odvěsny {a} cm a {b} cm. Urči druhou mocninu jeho přepony.", { a: [3, 9], b: [3, 9] }],
      ["Přepona pravoúhlého trojúhelníku měří {c} cm, jedna odvěsna {a} cm. Urči druhou mocninu druhé odvěsny.", { a: [3, 8], c: [10, 15] }],
      ["Obdélník má strany {a} cm a {b} cm. Urči druhou mocninu jeho úhlopříčky.", { a: [4, 12], b: [4, 12] }]] },
  { id: "circle-area", cs: "Obvod a obsah kruhu", en: "Circumference and area of a circle", prereq: ["powers-basic"], topic: "geometrie", ...NOAUTO,
    kw: [["kruh", "kružnice", "pí", "poloměr"], ["circle", "pi", "radius", "area"]], levels: [1, 2, 3],
    templates: [["Kruh má poloměr {a} cm. Urči jeho obsah (výsledek v násobcích π).", { a: [2, 12] }],
      ["Kružnice má obvod {a}π cm. Urči její poloměr a obsah kruhu.", { a: [4, 20] }],
      ["Kruhová zahrada má průměr {a} m. Kolik metrů plotu je potřeba na její obvod (v násobcích π)?", { a: [6, 30] }]] },
  { id: "solids-volume", cs: "Objem a povrch těles", en: "Volume and surface area of solids", prereq: ["circle-area"], topic: "geometrie", ...NOAUTO,
    kw: [["krychle", "kvádr", "válec", "jehlan", "objem", "povrch"], ["cube", "cylinder", "pyramid", "volume", "surface"]],
    templates: [["Krychle má hranu {a} cm. Urči její objem a povrch.", { a: [2, 9] }],
      ["Kvádr má rozměry {a} cm, {b} cm a {c} cm. Urči jeho objem a povrch.", { a: [2, 9], b: [3, 10], c: [4, 12] }],
      ["Válec má poloměr podstavy {a} cm a výšku {b} cm. Urči jeho objem (v násobcích π).", { a: [2, 8], b: [3, 12] }]] },
]);
topic("nestandardni-ulohy", "Logika a nestandardní úlohy", "Logic and non-standard problems", [
  { id: "counting-basic", cs: "Jednoduchá kombinatorika", en: "Simple counting", prereq: ["arithmetic-integers"], topic: "nestandardni-ulohy", ...NOAUTO,
    kw: [["kombinatorika", "kolika způsoby", "pořadí", "možnosti"], ["counting", "arrangements", "ways"]], levels: [1, 2, 3],
    templates: [["Kolika způsoby lze seřadit {a} různých knih vedle sebe na polici?", { a: [3, 6] }],
      ["Máš {a} druhů polévek a {b} druhů hlavních jídel. Kolik různých obědů (polévka + hlavní jídlo) můžeš složit?", { a: [2, 6], b: [3, 8] }],
      ["Ve třídě je {a} žáků. Kolika způsoby lze vybrat dvojici, která bude dělat službu?", { a: [5, 12] }]] },
]);

// ---------------------------------------------------------------- maturita / přijímačky VŠ
topic("funkce", "Funkce a rovnice", "Functions and equations", [
  { id: "quadratic-eq", cs: "Kvadratické rovnice", en: "Quadratic equations", prereq: ["linear-equations-distribution", "powers-basic"], topic: "funkce", ...NOAUTO, free: false,
    kw: [["diskriminant", "kvadratická", "parabola", "kořeny"], ["discriminant", "quadratic", "roots"]], levels: [2, 3, 4],
    templates: [["x^2+{b}x+{c}=0", { b: [3, 9], c: [2, 20] }], ["x^2-{b}=0", { b: [4, 100] }], ["{a}x^2+{b}x={c}", { a: [2, 4], b: [1, 7], c: [3, 15] }]] },
  { id: "inequalities-linear", cs: "Lineární nerovnice", en: "Linear inequalities", prereq: ["linear-equations-basic"], topic: "funkce", ...NOAUTO, free: false,
    kw: [["nerovnost", "interval", "záporné číslo"], ["inequality", "interval"]],
    templates: [["{a}x+{b}<{c}", { a: [2, 7], b: [1, 9], c: [12, 40] }], ["{a}-{b}x>={c}", { a: [10, 30], b: [2, 5], c: [-8, 4] }], ["{a}(x-{b})<={c}", { a: [2, 6], b: [1, 6], c: [4, 30] }]] },
  { id: "abs-equations", cs: "Rovnice s absolutní hodnotou", en: "Equations with absolute value", prereq: ["linear-equations-basic"], topic: "funkce", ...NOAUTO,
    kw: [["absolutní hodnota", "modul"], ["absolute value", "modulus"]],
    templates: [["Řeš rovnici s absolutní hodnotou: |x-{a}|={b}", { a: [1, 9], b: [1, 8] }], ["Řeš: |{a}x+{b}|={c}", { a: [2, 4], b: [1, 6], c: [3, 12] }], ["Řeš nerovnici: |x+{a}|<{b}", { a: [1, 6], b: [2, 9] }]] },
  { id: "functions-graphs", cs: "Funkce, definiční obor a graf", en: "Functions, domain and graph", prereq: ["linear-equations-basic"], topic: "funkce", ...NOAUTO,
    kw: [["lineární funkce", "graf", "definiční obor", "obor hodnot"], ["function", "graph", "domain", "range"]],
    templates: [["Lineární funkce má rovnici y={a}x+{b}. Najdi průsečíky grafu s osami.", { a: [1, 6], b: [-8, 8] }], ["Urči definiční obor funkce f(x)=1/(x-{a}).", { a: [1, 9] }], ["Funkce f(x)=x^2-{a}. Urči f({b}) a nuly funkce.", { a: [1, 16], b: [1, 6] }]] },
]);
topic("posloupnosti-a-finance", "Posloupnosti a finanční matematika", "Sequences and finance", [
  { id: "arith-seq", cs: "Aritmetická posloupnost", en: "Arithmetic sequence", prereq: ["linear-equations-basic"], topic: "posloupnosti-a-finance", ...NOAUTO,
    kw: [["posloupnost", "diference", "člen"], ["sequence", "difference"]], levels: [2, 3, 4],
    templates: [["Aritmetická posloupnost má první člen {a} a diferenci {b}. Urči desátý člen.", { a: [1, 9], b: [2, 7] }], ["V aritmetické posloupnosti je a_3={a} a a_7={b}. Urči diferenci a první člen.", { a: [5, 15], b: [25, 45] }], ["Urči součet prvních {a} členů aritmetické posloupnosti 2, 5, 8, …", { a: [6, 20] }]] },
  { id: "geom-seq", cs: "Geometrická posloupnost", en: "Geometric sequence", prereq: ["arith-seq"], topic: "posloupnosti-a-finance", ...NOAUTO,
    kw: [["kvocient", "geometrická"], ["ratio", "geometric"]],
    templates: [["Geometrická posloupnost má první člen {a} a kvocient 2. Urči pátý člen.", { a: [1, 6] }], ["V geometrické posloupnosti je a_2={a} a a_4={b}. Urči kvocient (kladný).", { a: [2, 6], b: [32, 96] }], ["Urči součet prvních {a} členů posloupnosti 1, 2, 4, 8, …", { a: [4, 9] }]] },
  { id: "finance-interest", cs: "Úroky a spoření", en: "Interest and savings", prereq: ["percentages-applied"], topic: "posloupnosti-a-finance", ...NOAUTO,
    kw: [["úrok", "spoření", "půjčka", "složené úročení"], ["interest", "savings", "loan", "compound"]],
    templates: [["Na účet vložíš {a}000 Kč s ročním úrokem {b} %. Kolik budeš mít po roce (bez zdanění)?", { a: [5, 50], b: [2, 6] }], ["Cena zboží {a} Kč se zvýšila o {b} % a pak snížila o {b} %. Jaká je nová cena?", { a: [200, 900], b: [10, 30] }], ["Vklad {a}000 Kč se {b} roky úročí ročně {c} % složeně. Napiš výraz pro konečnou částku.", { a: [10, 40], b: [2, 4], c: [2, 5] }]] },
]);
topic("goniometrie", "Goniometrie a trigonometrie", "Trigonometry", [
  { id: "trig-right-triangle", cs: "Funkce sin, cos, tg v pravoúhlém trojúhelníku", en: "Sine, cosine, tangent in a right triangle", prereq: ["pythagoras"], topic: "goniometrie", ...NOAUTO,
    kw: [["sinus", "kosinus", "tangens", "goniometrie"], ["sine", "cosine", "tangent", "trigonometry"]],
    templates: [["V pravoúhlém trojúhelníku je přepona {a} cm a úhel α={b}°. Urči protilehlou odvěsnu.", { a: [6, 20], b: [20, 70] }], ["Žebřík dlouhý {a} m je opřen o zeď pod úhlem {b}° k zemi. Do jaké výšky sahá?", { a: [3, 8], b: [55, 75] }], ["Odvěsny pravoúhlého trojúhelníku jsou {a} cm a {b} cm. Urči velikost většího ostrého úhlu.", { a: [3, 9], b: [10, 20] }]] },
  { id: "trig-equations", cs: "Goniometrické rovnice a vzorce", en: "Trigonometric equations and identities", prereq: ["trig-right-triangle"], topic: "goniometrie", ...NOAUTO,
    kw: [["jednotková kružnice", "radián"], ["unit circle", "radian"]],
    templates: [["Řeš v intervalu <0°; 360°): sin x = 1/2", undefined], ["Převeď {a}° na radiány.", { a: [30, 330] }], ["Zjednoduš výraz: sin^2 x + cos^2 x + {a}", { a: [1, 9] }]] },
]);
topic("kombinatorika-pravdepodobnost", "Kombinatorika a pravděpodobnost", "Combinatorics and probability", [
  { id: "comb-formulas", cs: "Variace, permutace a kombinace", en: "Permutations and combinations", prereq: ["counting-basic"], topic: "kombinatorika-pravdepodobnost", ...NOAUTO,
    kw: [["variace", "kombinační číslo", "faktoriál"], ["permutation", "combination", "factorial"]],
    templates: [["Kolika způsoby lze z {a} lidí vybrat dvoučlenný výbor?", { a: [6, 12] }], ["Kolik různých čtyřciferných čísel lze složit z číslic 1–{a}, když se číslice neopakují?", { a: [5, 9] }], ["Vypočítej kombinační číslo C({a}, {b}).", { a: [6, 10], b: [2, 4] }]] },
  { id: "probability-basic", cs: "Klasická pravděpodobnost", en: "Classical probability", prereq: ["comb-formulas"], topic: "kombinatorika-pravdepodobnost", ...NOAUTO,
    kw: [["pravděpodobnost", "náhoda", "kostka", "mince"], ["probability", "dice", "coin"]],
    templates: [["Házíš dvěma kostkami. Jaká je pravděpodobnost, že součet je {a}?", { a: [4, 10] }], ["V pytlíku je {a} červených a {b} modrých kuliček. Jaká je pravděpodobnost, že náhodně vytažená je červená?", { a: [2, 9], b: [2, 9] }], ["Hodíš třikrát mincí. Jaká je pravděpodobnost, že padne právě {a} panna?", { a: [1, 3] }]] },
]);

// ---------------------------------------------------------------- vysoká škola (neoficiální osnovy)
topic("va-limity", "Limity a spojitost", "Limits and continuity", [
  { id: "limit-sequence", cs: "Limita posloupnosti", en: "Limit of a sequence", prereq: [], topic: "va-limity", ...NOAUTO,
    kw: [["limita", "konvergence", "posloupnost"], ["limit", "convergence", "sequence"]],
    templates: [["Vypočítej limitu posloupnosti lim (n→∞) ({a}n+{b})/(n+{c}).", { a: [1, 6], b: [1, 9], c: [1, 9] }], ["Vypočítej lim (n→∞) (n^2+{a})/({b}n^2+n).", { a: [1, 9], b: [1, 5] }], ["Rozhodni, zda posloupnost a_n = (-1)^n + 1/n konverguje, a zdůvodni.", undefined]] },
  { id: "limit-function", cs: "Limita funkce", en: "Limit of a function", prereq: ["limit-sequence"], topic: "va-limity", ...NOAUTO,
    kw: [["limita funkce", "neurčitý výraz", "l'hospital"], ["limit of a function", "indeterminate", "l'hospital"]],
    templates: [["Vypočítej lim (x→{a}) (x^2-{a}^2)/(x-{a}).", { a: [1, 9] }], ["Vypočítej lim (x→0) sin({a}x)/x.", { a: [2, 7] }], ["Vypočítej lim (x→∞) (x^2+{a}x)/(2x^2-{b}).", { a: [1, 9], b: [1, 9] }]] },
]);
topic("va-derivace", "Derivace", "Derivatives", [
  { id: "derivative-basic", cs: "Derivace elementárních funkcí", en: "Derivatives of elementary functions", prereq: ["limit-function"], topic: "va-derivace", ...NOAUTO,
    kw: [["derivace", "derivovat", "tečna"], ["derivative", "differentiate", "tangent"]],
    templates: [["Zderivuj funkci f(x)=x^{a}+{b}x.", { a: [2, 7], b: [1, 9] }], ["Zderivuj f(x)={a}e^x+sin x.", { a: [2, 9] }], ["Najdi rovnici tečny ke grafu f(x)=x^2 v bodě x={a}.", { a: [1, 6] }]] },
  { id: "derivative-rules", cs: "Pravidla derivování (součin, podíl, složená funkce)", en: "Differentiation rules", prereq: ["derivative-basic"], topic: "va-derivace", ...NOAUTO,
    kw: [["řetízkové pravidlo", "součin", "podíl"], ["chain rule", "product rule", "quotient rule"]],
    templates: [["Zderivuj f(x)=x^{a}·e^x.", { a: [2, 5] }], ["Zderivuj f(x)=(x^2+{a})/(x-1).", { a: [1, 9] }], ["Zderivuj f(x)=sin({a}x^2).", { a: [2, 6] }]] },
  { id: "derivative-apps", cs: "Extrémy a průběh funkce", en: "Extrema and curve sketching", prereq: ["derivative-rules"], topic: "va-derivace", ...NOAUTO,
    kw: [["extrém", "monotonie", "konvexita", "inflexní bod"], ["extremum", "monotonic", "convex", "inflection"]],
    templates: [["Najdi lokální extrémy funkce f(x)=x^3-{a}x.", { a: [3, 12] }], ["Najdi intervaly monotonie funkce f(x)=x^2-{a}x+{b}.", { a: [2, 8], b: [1, 9] }], ["Z drátu délky {a} m ohneme obdélník. Jaké rozměry dají největší obsah?", { a: [20, 60] }]] },
]);
topic("va-integraly", "Integrály", "Integrals", [
  { id: "integral-basic", cs: "Neurčitý integrál", en: "Indefinite integral", prereq: ["derivative-basic"], topic: "va-integraly", ...NOAUTO,
    kw: [["integrál", "primitivní funkce", "integrovat"], ["integral", "antiderivative", "integrate"]],
    templates: [["Vypočítej ∫ (x^{a}+{b}) dx.", { a: [2, 6], b: [1, 9] }], ["Vypočítej ∫ {a}e^x dx.", { a: [2, 9] }], ["Vypočítej ∫ (1/x + {a}cos x) dx.", { a: [1, 9] }]] },
  { id: "integral-methods", cs: "Per partes a substituce", en: "Integration by parts and substitution", prereq: ["integral-basic", "derivative-rules"], topic: "va-integraly", ...NOAUTO,
    kw: [["per partes", "substituce"], ["integration by parts", "substitution"]],
    templates: [["Vypočítej ∫ x·e^x dx metodou per partes.", undefined], ["Vypočítej ∫ {a}x·(x^2+1)^{b} dx substitucí.", { a: [1, 6], b: [2, 4] }], ["Vypočítej ∫ x·sin x dx.", undefined]] },
  { id: "integral-definite", cs: "Určitý integrál a plocha", en: "Definite integral and area", prereq: ["integral-basic"], topic: "va-integraly", ...NOAUTO,
    kw: [["určitý integrál", "obsah", "plocha pod grafem"], ["definite integral", "area under curve"]],
    templates: [["Vypočítej ∫ od 0 do {a} z x^2 dx.", { a: [1, 6] }], ["Urči obsah obrazce ohraničeného grafem y=x^2 a přímkou y={a}.", { a: [1, 9] }], ["Vypočítej ∫ od 1 do {a} z (1/x) dx.", { a: [2, 9] }]] },
]);
topic("la-soustavy-matice", "Soustavy a matice", "Systems and matrices", [
  { id: "gauss", cs: "Gaussova eliminace", en: "Gaussian elimination", prereq: [], topic: "la-soustavy-matice", ...NOAUTO,
    kw: [["soustava rovnic", "gauss", "eliminace", "hodnost"], ["linear system", "gauss", "elimination", "rank"]],
    templates: [["Vyřeš soustavu Gaussovou eliminací: x+y+z={a}, x-y+z={b}, 2x+y-z={c}.", { a: [4, 12], b: [0, 6], c: [0, 8] }], ["Urči hodnost matice (1 2 3 | 2 4 6 | 1 0 {a}).", { a: [1, 6] }], ["Pro které t má soustava x+y=1, x+ty=2 právě jedno řešení?", undefined]] },
  { id: "matrix-ops", cs: "Operace s maticemi", en: "Matrix operations", prereq: ["gauss"], topic: "la-soustavy-matice", ...NOAUTO,
    kw: [["násobení matic", "transpozice", "matice"], ["matrix multiplication", "transpose", "matrix"]],
    templates: [["Vypočítej součin matic (1 {a} | 0 1)·(1 {b} | 0 1).", { a: [1, 5], b: [1, 5] }], ["Je násobení matic komutativní? Najdi A, B 2×2 s AB≠BA.", undefined], ["Vypočítej (1 2 | 3 4)^2 − {a}·(1 2 | 3 4).", { a: [1, 9] }]] },
  { id: "determinant", cs: "Determinant", en: "Determinant", prereq: ["matrix-ops"], topic: "la-soustavy-matice", ...NOAUTO,
    kw: [["determinant", "sarrus", "laplace"], ["determinant", "sarrus", "laplace"]],
    templates: [["Vypočítej determinant matice (2 {a} | 1 3).", { a: [1, 7] }], ["Vypočítej determinant (1 2 3 | 0 {a} 1 | 1 0 2) Sarrusovým pravidlem.", { a: [1, 6] }], ["Pro které x je matice (x 2 | 3 x) singulární?", undefined]] },
  { id: "inverse-matrix", cs: "Inverzní matice", en: "Inverse matrix", prereq: ["determinant"], topic: "la-soustavy-matice", ...NOAUTO,
    kw: [["inverze", "regulární matice"], ["inverse", "invertible"]],
    templates: [["Najdi inverzní matici k (1 {a} | 0 1).", { a: [1, 6] }], ["Najdi inverzní matici k (2 1 | {a} 1), pokud existuje.", { a: [0, 5] }], ["Pomocí inverzní matice vyřeš soustavu 2x+y={a}, x+y={b}.", { a: [3, 12], b: [2, 8] }]] },
]);
topic("la-prostory", "Vektorové prostory a zobrazení", "Vector spaces and maps", [
  { id: "span-basis", cs: "Lineární nezávislost a báze", en: "Linear independence and basis", prereq: ["gauss"], topic: "la-prostory", ...NOAUTO,
    kw: [["báze", "dimenze", "lineární obal", "nezávislost"], ["basis", "dimension", "span", "independence"]],
    templates: [["Jsou vektory (1,2,3), (2,4,{a}), (0,1,1) lineárně nezávislé?", { a: [5, 8] }], ["Najdi bázi a dimenzi podprostoru generovaného (1,1,0), (2,2,0), (0,1,{a}).", { a: [1, 5] }], ["Doplň (1,{a},0) na bázi R^3.", { a: [1, 5] }]] },
  { id: "linear-maps", cs: "Lineární zobrazení, jádro a obraz", en: "Linear maps, kernel and image", prereq: ["span-basis", "matrix-ops"], topic: "la-prostory", ...NOAUTO,
    kw: [["jádro", "obraz", "lineární zobrazení"], ["kernel", "image", "linear map"]],
    templates: [["Zobrazení f(x,y)=(x+{a}y, 2x) – napiš matici a urči jádro.", { a: [1, 5] }], ["Urči dimenzi jádra a obrazu zobrazení dané maticí (1 2 | 2 4).", undefined], ["Je f(x,y)=(x+1, y) lineární? Zdůvodni.", undefined]] },
  { id: "eigen", cs: "Vlastní čísla a vlastní vektory", en: "Eigenvalues and eigenvectors", prereq: ["determinant", "linear-maps"], topic: "la-prostory", ...NOAUTO,
    kw: [["vlastní číslo", "charakteristický polynom", "diagonalizace"], ["eigenvalue", "characteristic polynomial", "diagonalization"]],
    templates: [["Najdi vlastní čísla matice (2 {a} | 0 3).", { a: [0, 5] }], ["Najdi vlastní čísla a vektory matice (1 2 | 2 1).", undefined], ["Je matice (1 1 | 0 1) diagonalizovatelná? Zdůvodni.", undefined]] },
]);
topic("dm-logika-mnoziny", "Logika, množiny a důkazy", "Logic, sets and proofs", [
  { id: "prop-logic", cs: "Výroková logika", en: "Propositional logic", prereq: [], topic: "dm-logika-mnoziny", ...NOAUTO,
    kw: [["výrok", "implikace", "negace", "tabulka pravdivosti"], ["proposition", "implication", "truth table"]],
    templates: [["Sestav tabulku pravdivosti pro výrok (A ⇒ B) ∧ (B ⇒ A).", undefined], ["Zneguj výrok: pro každé x existuje y takové, že x + y = {a}.", { a: [1, 9] }], ["Je (A ∨ B) ⇒ C ekvivalentní s (A ⇒ C) ∧ (B ⇒ C)? Dokaž.", undefined]] },
  { id: "sets-relations", cs: "Množiny a relace", en: "Sets and relations", prereq: ["prop-logic"], topic: "dm-logika-mnoziny", ...NOAUTO,
    kw: [["množina", "relace", "ekvivalence", "uspořádání"], ["set", "relation", "equivalence", "order"]],
    templates: [["Kolik prvků má potenční množina množiny o {a} prvcích?", { a: [3, 8] }], ["Je relace „a−b je dělitelné {a}“ na Z ekvivalence? Dokaž.", { a: [2, 7] }], ["Je dělitelnost uspořádání na množině {1,…,{a}}? Nakresli Hasseův diagram.", { a: [6, 12] }]] },
  { id: "induction", cs: "Matematická indukce", en: "Mathematical induction", prereq: ["prop-logic"], topic: "dm-logika-mnoziny", ...NOAUTO,
    kw: [["indukce", "důkaz"], ["induction", "proof"]],
    templates: [["Dokaž indukcí: 1+2+…+n = n(n+1)/2.", undefined], ["Dokaž indukcí, že {a}^n − 1 je dělitelné {b} pro všechna n≥1.", { a: [4, 7], b: [3, 6] }], ["Dokaž indukcí, že 2^n > n pro všechna n≥1.", undefined]] },
]);
topic("dm-kombinatorika-grafy", "Kombinatorika a grafy", "Combinatorics and graphs", [
  { id: "comb-counting", cs: "Kombinatorické počítání", en: "Counting methods", prereq: [], topic: "dm-kombinatorika-grafy", ...NOAUTO,
    kw: [["binomická věta", "variace s opakováním", "kombinace"], ["binomial theorem", "combinations"]],
    templates: [["Kolika způsoby lze rozdělit {a} různých kuliček do 3 různých krabic?", { a: [3, 7] }], ["Najdi koeficient u x^{a} v rozvoji (1+x)^{b}.", { a: [2, 4], b: [6, 9] }], ["Kolik je binárních řetězců délky {a} bez dvou po sobě jdoucích jedniček?", { a: [4, 8] }]] },
  { id: "inclusion-exclusion", cs: "Princip inkluze a exkluze", en: "Inclusion–exclusion", prereq: ["comb-counting"], topic: "dm-kombinatorika-grafy", ...NOAUTO,
    kw: [["inkluze", "exkluze", "dělitelnost"], ["inclusion", "exclusion"]],
    templates: [["Kolik čísel z {1,…,{a}} je dělitelných 2 nebo 3?", { a: [30, 100] }], ["Kolik permutací množiny {1,…,{a}} nemá žádný pevný bod?", { a: [3, 6] }], ["V třídě {a} žáků hraje fotbal, {b} basket, {c} oba. Kolik nehraje ani jedno, je-li ve třídě 30 žáků?", { a: [12, 20], b: [10, 18], c: [3, 8] }]] },
  { id: "graphs-basic", cs: "Grafy, stupně vrcholů a cesty", en: "Graphs, degrees and paths", prereq: ["sets-relations"], topic: "dm-kombinatorika-grafy", ...NOAUTO,
    kw: [["graf", "vrchol", "hrana", "stupeň"], ["graph", "vertex", "edge", "degree"]],
    templates: [["Kolik hran má úplný graf K_{a}?", { a: [4, 12] }], ["Existuje graf se stupni vrcholů 3, 3, 3, {a}? Zdůvodni.", { a: [1, 3] }], ["Kolik hran má strom na {a} vrcholech?", { a: [5, 30] }]] },
  { id: "trees-connectivity", cs: "Stromy a souvislost", en: "Trees and connectivity", prereq: ["graphs-basic"], topic: "dm-kombinatorika-grafy", ...NOAUTO,
    kw: [["strom", "kostra", "souvislý"], ["tree", "spanning tree", "connected"]],
    templates: [["Kolik kostér má cyklus C_{a}?", { a: [3, 8] }], ["Dokaž, že každý strom s alespoň 2 vrcholy má aspoň 2 listy.", undefined], ["Je graf se {a} vrcholy a {b} hranami nutně souvislý? Zdůvodni.", { a: [6, 10], b: [8, 12] }]] },
]);
topic("st-pravdepodobnost", "Pravděpodobnost", "Probability", [
  { id: "prob-conditional", cs: "Podmíněná pravděpodobnost a nezávislost", en: "Conditional probability and independence", prereq: [], topic: "st-pravdepodobnost", ...NOAUTO,
    kw: [["podmíněná pravděpodobnost", "nezávislé jevy", "bayes"], ["conditional probability", "independent events", "bayes"]],
    templates: [["Z balíčku 32 karet táhneš dvě bez vracení. Jaká je pravděpodobnost, že obě jsou esa?", undefined], ["P(A)=0,{a}, P(B)=0,4, A a B nezávislé. Urči P(A∪B).", { a: [2, 7] }], ["Test má citlivost 95 % a specificitu 90 %, nemoc má {a} % lidí. Jaká je P(nemoc | pozitivní test)?", { a: [1, 10] }]] },
  { id: "random-variables", cs: "Náhodné veličiny a střední hodnota", en: "Random variables and expectation", prereq: ["prob-conditional"], topic: "st-pravdepodobnost", ...NOAUTO,
    kw: [["rozdělení", "střední hodnota", "rozptyl", "binomické"], ["distribution", "expected value", "variance", "binomial"]],
    templates: [["Urči střední hodnotu a rozptyl hodu kostkou.", undefined], ["X~Bin({a}; 0,5). Urči E(X) a Var(X).", { a: [6, 20] }], ["Hodíš {a}krát mincí. Jaká je pravděpodobnost, že padne přesně polovina orlů?", { a: [4, 10] }]] },
  { id: "normal-distribution", cs: "Normální rozdělení", en: "Normal distribution", prereq: ["random-variables"], topic: "st-pravdepodobnost", ...NOAUTO,
    kw: [["gauss", "zvonovitá křivka", "standardizace"], ["gaussian", "bell curve", "standardization"]],
    templates: [["X~N(100; 15²). Převeď P(X<{a}) na standardní normální rozdělení.", { a: [85, 130] }], ["Jaká část hodnot leží v rozmezí μ ± 2σ u normálního rozdělení?", undefined], ["Výška mužů ~ N(180; 7²). Jaká je pravděpodobnost, že náhodný muž měří víc než {a} cm?", { a: [185, 200] }]] },
]);
topic("st-statistika", "Statistika", "Statistics", [
  { id: "estimation", cs: "Odhady a intervaly spolehlivosti", en: "Estimation and confidence intervals", prereq: ["normal-distribution"], topic: "st-statistika", ...NOAUTO,
    kw: [["odhad", "interval spolehlivosti", "výběrový průměr"], ["estimate", "confidence interval", "sample mean"]],
    templates: [["Výběr n={a} má průměr 50 a směrodatnou odchylku 8. Sestav 95% interval spolehlivosti pro střední hodnotu.", { a: [25, 100] }], ["Jak se změní šířka intervalu spolehlivosti, když zvětšíš výběr {a}krát?", { a: [2, 9] }], ["V průzkumu z {a} lidí odpovědělo 60 % ano. Najdi 95% interval pro podíl.", { a: [100, 500] }]] },
  { id: "hypothesis-testing", cs: "Testování hypotéz", en: "Hypothesis testing", prereq: ["estimation"], topic: "st-statistika", ...NOAUTO,
    kw: [["hypotéza", "p-hodnota", "t-test", "hladina významnosti"], ["hypothesis", "p-value", "t-test", "significance"]],
    templates: [["Formuluj H0 a H1 pro tvrzení, že mince je spravedlivá, a vysvětli chybu 1. druhu.", undefined], ["Z {a} měření vyšel průměr 102 a s=6. Otestuj H0: μ=100 na hladině 5 %.", { a: [16, 40] }], ["Co znamená p-hodnota {a}? Zamítneš H0 na hladině 5 %?", { a: [1, 9] }]] },
]);

// ---------------------------------------------------------------- fyzika a chemie (číselné úlohy s programově spočtenou odpovědí)
topic("fy-mechanika", "Mechanika", "Mechanics", [
  { id: "fy-velocity", cs: "Rychlost, dráha a čas", en: "Speed, distance and time", prereq: [], topic: "fy-mechanika", ...NOAUTO, levels: [1, 2, 3],
    kw: [["rychlost", "dráha", "pohyb", "v = s/t"], ["speed", "velocity", "distance"]],
    templates: [["Auto ujede {a} m za {b} s. Jakou má průměrnou rychlost (v m/s)?", { a: [30, 300], b: [2, 12] }], ["Cyklista jede rychlostí {a} km/h po dobu {b} h. Jakou dráhu ujede (v km)?", { a: [10, 30], b: [2, 5] }], ["Vlak ujede {a} km za {b} min. Urči jeho rychlost v km/h.", { a: [20, 90], b: [10, 45] }]],
    answers: [["{a}/{b}", "m/s"], ["{a}*{b}", "km"], ["{a}/({b}/60)", "km/h"]] },
  { id: "fy-force", cs: "Síla a zrychlení (F = m · a)", en: "Force and acceleration (F = m · a)", prereq: ["fy-velocity"], topic: "fy-mechanika", ...NOAUTO, levels: [1, 2, 3],
    kw: [["síla", "newton", "zrychlení", "tíha"], ["force", "newton", "acceleration", "weight"]],
    templates: [["Těleso o hmotnosti {a} kg zrychluje o {b} m/s². Jaká síla na něj působí (v N)?", { a: [2, 20], b: [2, 9] }], ["Síla {a} N uděluje tělesu zrychlení {b} m/s². Jaká je jeho hmotnost (v kg)?", { a: [20, 60], b: [2, 5] }], ["Jakou tíhovou sílu má těleso o hmotnosti {a} kg? (g = 10 m/s²)", { a: [2, 80] }]],
    answers: [["{a}*{b}", "N"], ["{a}/{b}", "kg"], ["{a}*10", "N"]] },
  { id: "fy-work", cs: "Práce, výkon a energie", en: "Work, power and energy", prereq: ["fy-force"], topic: "fy-mechanika", ...NOAUTO, levels: [2, 3, 3],
    kw: [["práce", "výkon", "joule", "watt", "energie"], ["work", "power", "joule", "watt", "energy"]],
    templates: [["Síla {a} N posune těleso o {b} m ve směru síly. Jakou práci vykoná (v J)?", { a: [10, 80], b: [2, 15] }], ["Stroj vykoná práci {a} J za {b} s. Jaký je jeho výkon (ve W)?", { a: [200, 900], b: [2, 10] }], ["Žárovka o příkonu {a} W svítí {b} h. Kolik kWh spotřebuje?", { a: [40, 100], b: [2, 10] }]],
    answers: [["{a}*{b}", "J"], ["{a}/{b}", "W"], ["{a}*{b}/1000", "kWh"]] },
  { id: "fy-density-pressure", cs: "Hustota a tlak", en: "Density and pressure", prereq: ["fy-force"], topic: "fy-mechanika", ...NOAUTO, levels: [2, 3, 4],
    kw: [["hustota", "tlak", "pascal", "hydrostatický"], ["density", "pressure", "pascal", "hydrostatic"]],
    templates: [["Těleso má hmotnost {a} g a objem {b} cm³. Jaká je jeho hustota (v g/cm³)?", { a: [20, 90], b: [2, 10] }], ["Síla {a} N působí kolmo na plochu {b} m². Jaký je tlak (v Pa)?", { a: [100, 900], b: [2, 10] }], ["Jaký je hydrostatický tlak ve vodě v hloubce {a} m? (ρ = 1000 kg/m³, g = 10 m/s²; výsledek v kPa)", { a: [2, 20] }]],
    answers: [["{a}/{b}", "g/cm³"], ["{a}/{b}", "Pa"], ["1000*10*{a}/1000", "kPa"]] },
  { id: "fy-draw-forces", cs: "Nakresli síly (kresba)", en: "Draw the forces (drawing)", prereq: ["fy-force"], topic: "fy-mechanika", ...NOAUTO, drawing: true,
    kw: [["kresba", "vektor", "síly", "nakloněná rovina"], ["drawing", "vector", "forces", "inclined plane"]],
    templates: [["Nakresli těleso ležící na stole a všechny síly, které na něj působí.", undefined], ["Nakresli těleso na nakloněné rovině a rozlož tíhovou sílu na dvě složky.", undefined], ["Nakresli síly působící na závaží zavěšené na pružině.", undefined]] },
]);
topic("fy-elektrina", "Elektřina", "Electricity", [
  { id: "fy-ohm", cs: "Ohmův zákon", en: "Ohm's law", prereq: [], topic: "fy-elektrina", ...NOAUTO, levels: [1, 2, 2],
    kw: [["napětí", "proud", "odpor", "ohm"], ["voltage", "current", "resistance", "ohm"]],
    templates: [["Rezistor {a} Ω je připojen na napětí {b} V. Jaký proud jím protéká (v A)?", { a: [5, 50], b: [10, 100] }], ["Obvodem protéká proud {a} A při napětí {b} V. Jaký je odpor (v Ω)?", { a: [2, 10], b: [20, 120] }], ["Rezistorem o odporu {b} Ω protéká proud {a} A. Jaké je napětí (ve V)?", { a: [2, 10], b: [5, 50] }]],
    answers: [["{b}/{a}", "A"], ["{b}/{a}", "Ω"], ["{a}*{b}", "V"]] },
  { id: "fy-resistors", cs: "Sériové a paralelní zapojení", en: "Series and parallel circuits", prereq: ["fy-ohm"], topic: "fy-elektrina", ...NOAUTO, levels: [2, 3, 4],
    kw: [["rezistory", "sériově", "paralelně", "celkový odpor"], ["resistors", "series", "parallel", "total resistance"]],
    templates: [["Dva rezistory {a} Ω a {b} Ω jsou zapojeny sériově. Jaký je celkový odpor (v Ω)?", { a: [10, 60], b: [10, 60] }], ["Dva rezistory {a} Ω a {b} Ω jsou zapojeny paralelně. Jaký je celkový odpor (v Ω)?", { a: [10, 60], b: [10, 60] }], ["Dva stejné rezistory {a} Ω zapojíš paralelně a sériově k nim připojíš rezistor {b} Ω. Jaký je celkový odpor (v Ω)?", { a: [10, 60], b: [5, 40] }]],
    answers: [["{a}+{b}", "Ω"], ["1/(1/{a}+1/{b})", "Ω"], ["{a}/2+{b}", "Ω"]] },
  { id: "fy-electric-power", cs: "Elektrický příkon a energie", en: "Electric power and energy", prereq: ["fy-ohm"], topic: "fy-elektrina", ...NOAUTO, levels: [2, 3, 3],
    kw: [["příkon", "spotřeba", "kwh", "cena elektřiny"], ["power", "energy use", "kwh", "electricity cost"]],
    templates: [["Spotřebič je připojen na napětí {a} V a protéká jím proud {b} A. Jaký je příkon (ve W)?", { a: [12, 230], b: [1, 9] }], ["Žehlička s příkonem 2000 W je zapnutá {a} h. Kolik kWh spotřebuje?", { a: [1, 6] }], ["Elektřina stojí {a} Kč za kWh. Spotřebič s příkonem 1,5 kW běží {b} h. Kolik zaplatíš (v Kč)?", { a: [5, 9], b: [2, 8] }]],
    answers: [["{a}*{b}", "W"], ["2*{a}", "kWh"], ["{a}*1.5*{b}", "Kč"]] },
  { id: "fy-draw-circuit", cs: "Nakresli schéma obvodu (kresba)", en: "Draw a circuit diagram (drawing)", prereq: ["fy-ohm"], topic: "fy-elektrina", ...NOAUTO, drawing: true,
    kw: [["schéma", "obvod", "žárovka", "baterie", "ampérmetr"], ["circuit diagram", "bulb", "battery", "ammeter"]],
    templates: [["Nakresli schéma obvodu: baterie, vypínač a žárovka zapojené za sebou.", undefined], ["Nakresli obvod se dvěma žárovkami zapojenými vedle sebe (paralelně) k jedné baterii.", undefined], ["Nakresli obvod s ampérmetrem a voltmetrem u žárovky a vyznač, jak se zapojují.", undefined]] },
]);
topic("ch-latkove-mnozstvi", "Látkové množství a roztoky", "Amount of substance and solutions", [
  { id: "ch-molar-mass", cs: "Molární hmotnost", en: "Molar mass", prereq: [], topic: "ch-latkove-mnozstvi", ...NOAUTO, levels: [1, 2, 3],
    kw: [["molární hmotnost", "relativní atomová hmotnost", "vzorec"], ["molar mass", "atomic mass", "formula"]],
    templates: [["Vypočítej molární hmotnost vody H₂O v g/mol (Ar: H = 1, O = 16).", undefined], ["Vypočítej molární hmotnost oxidu uhličitého CO₂ v g/mol (Ar: C = 12, O = 16).", undefined], ["Vypočítej molární hmotnost kyseliny sírové H₂SO₄ v g/mol (Ar: H = 1, S = 32, O = 16).", undefined]],
    answers: [["2*1+16", "g/mol"], ["12+2*16", "g/mol"], ["2*1+32+4*16", "g/mol"]] },
  { id: "ch-mole", cs: "Látkové množství (n = m / M)", en: "Amount of substance (n = m / M)", prereq: ["ch-molar-mass"], topic: "ch-latkove-mnozstvi", ...NOAUTO, levels: [2, 3, 4],
    kw: [["mol", "látkové množství", "avogadro"], ["mole", "amount of substance", "avogadro"]],
    templates: [["Kolik molů je {a} g vody? (M = 18 g/mol)", { a: [36, 180] }], ["Kolik gramů má {a} mol chloridu sodného NaCl? (M = 58,5 g/mol)", { a: [2, 6] }], ["Kolik částic je v {a} mol látky? (N_A = 6,02·10^23 /mol; výsledek zapiš jako číslo, třeba 1,2·10^24)", { a: [2, 5] }]],
    answers: [["{a}/18", "mol"], ["{a}*58.5", "g"], ["{a}*6.02*10^23"]] },
  { id: "ch-concentration", cs: "Koncentrace roztoku", en: "Concentration of a solution", prereq: ["ch-mole"], topic: "ch-latkove-mnozstvi", ...NOAUTO, levels: [2, 3, 3],
    kw: [["koncentrace", "roztok", "hmotnostní zlomek", "mol/l"], ["concentration", "solution", "mass fraction", "mol/l"]],
    templates: [["Rozpustíš {a} mol látky v {b} l roztoku. Jaká je molární koncentrace (v mol/l)?", { a: [1, 6], b: [2, 4] }], ["Roztok má koncentraci {a} mol/l a objem {b} l. Kolik molů látky obsahuje?", { a: [1, 5], b: [2, 6] }], ["Rozpustíš {a} g soli ve {b} g vody. Jaký je hmotnostní zlomek soli v roztoku (v %)?", { a: [10, 40], b: [60, 190] }]],
    answers: [["{a}/{b}", "mol/l"], ["{a}*{b}", "mol"], ["{a}/({a}+{b})*100", "%"]] },
  { id: "ch-stoichiometry", cs: "Stechiometrie reakcí", en: "Reaction stoichiometry", prereq: ["ch-mole"], topic: "ch-latkove-mnozstvi", ...NOAUTO, levels: [3, 3, 4],
    kw: [["reakce", "stechiometrie", "chemická rovnice"], ["reaction", "stoichiometry", "chemical equation"]],
    templates: [["2 H₂ + O₂ → 2 H₂O. Z {a} mol vodíku vznikne kolik mol vody?", { a: [2, 8] }], ["2 H₂ + O₂ → 2 H₂O. Kolik gramů vody vznikne z {a} mol vodíku? (M(H₂O) = 18 g/mol)", { a: [2, 8] }], ["N₂ + 3 H₂ → 2 NH₃. Kolik mol amoniaku vznikne z {a} mol dusíku?", { a: [1, 6] }]],
    answers: [["{a}", "mol"], ["{a}*18", "g"], ["2*{a}", "mol"]] },
  { id: "ch-balance", cs: "Vyčíslování rovnic", en: "Balancing equations", prereq: ["ch-molar-mass"], topic: "ch-latkove-mnozstvi", ...NOAUTO,
    kw: [["vyčíslit", "koeficienty", "chemická rovnice"], ["balance", "coefficients", "chemical equation"]],
    templates: [["Vyčísli rovnici: H₂ + O₂ → H₂O", undefined], ["Vyčísli rovnici: Fe + O₂ → Fe₂O₃", undefined], ["Vyčísli rovnici: C₃H₈ + O₂ → CO₂ + H₂O", undefined]] },
  { id: "ch-draw-structure", cs: "Nakresli strukturní vzorec (kresba)", en: "Draw a structural formula (drawing)", prereq: ["ch-molar-mass"], topic: "ch-latkove-mnozstvi", ...NOAUTO, drawing: true,
    kw: [["strukturní vzorec", "vazby", "kresba", "uhlovodíky"], ["structural formula", "bonds", "drawing", "hydrocarbons"]],
    templates: [["Nakresli strukturní vzorec vody a vyznač vazby.", undefined], ["Nakresli strukturní vzorec methanu CH₄.", undefined], ["Nakresli strukturní vzorec ethanolu C₂H₅OH.", undefined]] },
]);
