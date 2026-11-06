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
}

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
      ...(s.auto === false ? { autoCheck: false } : {}), ...(s.kw ? { keywords: { cs: s.kw[0], en: s.kw[1] } } : {}),
    });
    s.templates.forEach(([statementTemplate, generatorRanges], i) => extraTemplates.push({
      id: ids[i]!, skillId: s.id, difficultyLevel: levels[i]!, topic: id, statementTemplate,
      ...(generatorRanges ? { generatorRanges } : {}), ...(s.free === false ? {} : s.auto === false ? { freeText: true } : {}),
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
    templates: [["Kolika způsoby lze z {a} lidí vybrat {b}členný výbor?", { a: [6, 12], b: [2, 3] }], ["Kolik různých čtyřciferných čísel lze složit z číslic 1–{a}, když se číslice neopakují?", { a: [5, 9] }], ["Vypočítej kombinační číslo C({a}, {b}).", { a: [6, 10], b: [2, 4] }]] },
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
