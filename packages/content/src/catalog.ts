import type { CourseCatalog, ProblemTemplate, Skill, Topic, Track } from "@openmathtutor/shared";
import { extraSkills, extraTemplates, extraTopics } from "./extra.js";

/**
 * Original practice-problem catalog. Every statement here was written for
 * this project — none of it reproduces or paraphrases a real past exam
 * paper from any exam board. See SOURCES.md for what each track is modeled
 * after and why that's safe to do. Only arithmetic, negative numbers,
 * fractions, percentages (as normalized fractions, e.g. "25/100*80"),
 * parentheses, and linear equations are covered — that's the verifier's
 * current scope (see verifier/SPEC.md); no geometry/quadratics/radicals.
 */

const TOPIC_NUMBERS = "zaklady-cisla";
const TOPIC_FRACTIONS = "zlomky-a-procenta";
const TOPIC_LINEAR = "linearni-rovnice";
const TOPIC_LINEAR_ADVANCED = "linearni-rovnice-pokrocile";

const SKILL_INTEGERS = "arithmetic-integers";
const SKILL_ORDER_OF_OPERATIONS = "arithmetic-order-of-operations";
const SKILL_FRACTIONS_BASIC = "fractions-basic";
const SKILL_FRACTIONS_ADVANCED = "fractions-advanced";
const SKILL_PERCENTAGES_BASIC = "percentages-basic";
const SKILL_PERCENTAGES_APPLIED = "percentages-applied";
const SKILL_LINEAR_BASIC = "linear-equations-basic";
const SKILL_LINEAR_DISTRIBUTION = "linear-equations-distribution";
const SKILL_LINEAR_ADVANCED = "linear-equations-advanced";

const topics: Topic[] = [
  {
    id: TOPIC_NUMBERS,
    title: { cs: "Základy čísel", en: "Number basics" },
    skillIds: [SKILL_INTEGERS, SKILL_ORDER_OF_OPERATIONS],
  },
  {
    id: TOPIC_FRACTIONS,
    title: { cs: "Zlomky a procenta", en: "Fractions and percentages" },
    skillIds: [SKILL_FRACTIONS_BASIC, SKILL_FRACTIONS_ADVANCED, SKILL_PERCENTAGES_BASIC, SKILL_PERCENTAGES_APPLIED],
  },
  {
    id: TOPIC_LINEAR,
    title: { cs: "Lineární rovnice", en: "Linear equations" },
    skillIds: [SKILL_LINEAR_BASIC, SKILL_LINEAR_DISTRIBUTION],
  },
  {
    id: TOPIC_LINEAR_ADVANCED,
    title: { cs: "Lineární rovnice — pokročilé", en: "Linear equations — advanced" },
    skillIds: [SKILL_LINEAR_ADVANCED],
  },
];

const skills: Skill[] = [
  {
    id: SKILL_INTEGERS,
    title: { cs: "Počítání se zápornými čísly", en: "Arithmetic with negative numbers" },
    prerequisiteSkillIds: [],
    problemTemplateIds: ["integers-1", "integers-2", "integers-3"],
  },
  {
    id: SKILL_ORDER_OF_OPERATIONS,
    title: { cs: "Pořadí operací a závorky", en: "Order of operations and parentheses" },
    prerequisiteSkillIds: [SKILL_INTEGERS],
    problemTemplateIds: ["order-1", "order-2", "order-3"],
  },
  {
    id: SKILL_FRACTIONS_BASIC,
    title: { cs: "Základní operace se zlomky", en: "Basic fraction operations" },
    prerequisiteSkillIds: [SKILL_INTEGERS],
    problemTemplateIds: ["fractions-basic-1", "fractions-basic-2", "fractions-basic-3"],
  },
  {
    id: SKILL_FRACTIONS_ADVANCED,
    title: { cs: "Zlomky se závorkami", en: "Fractions with parentheses" },
    prerequisiteSkillIds: [SKILL_FRACTIONS_BASIC],
    problemTemplateIds: ["fractions-adv-1", "fractions-adv-2", "fractions-adv-3"],
  },
  {
    id: SKILL_PERCENTAGES_BASIC,
    title: { cs: "Výpočet procent z čísla", en: "Computing a percentage of a number" },
    prerequisiteSkillIds: [SKILL_FRACTIONS_BASIC],
    problemTemplateIds: ["percent-basic-1", "percent-basic-2", "percent-basic-3"],
  },
  {
    id: SKILL_PERCENTAGES_APPLIED,
    title: { cs: "Procentuální nárůst a pokles", en: "Percentage increase and decrease" },
    prerequisiteSkillIds: [SKILL_PERCENTAGES_BASIC],
    problemTemplateIds: ["percent-applied-1", "percent-applied-2", "percent-applied-3"],
  },
  {
    id: SKILL_LINEAR_BASIC,
    title: { cs: "Jednoduché lineární rovnice", en: "Simple linear equations" },
    prerequisiteSkillIds: [SKILL_INTEGERS],
    problemTemplateIds: ["linear-basic-1", "linear-basic-2", "linear-basic-3"],
  },
  {
    id: SKILL_LINEAR_DISTRIBUTION,
    title: { cs: "Rovnice se závorkou", en: "Equations with distribution" },
    prerequisiteSkillIds: [SKILL_LINEAR_BASIC, SKILL_ORDER_OF_OPERATIONS],
    problemTemplateIds: ["linear-dist-1", "linear-dist-2", "linear-dist-3"],
  },
  {
    id: SKILL_LINEAR_ADVANCED,
    title: { cs: "Rovnice s neznámou na obou stranách", en: "Equations with the variable on both sides" },
    prerequisiteSkillIds: [SKILL_LINEAR_DISTRIBUTION],
    problemTemplateIds: ["linear-adv-1", "linear-adv-2", "linear-adv-3"],
  },
];

const problemTemplates: ProblemTemplate[] = [
  // --- Integers ---
  { id: "integers-1", skillId: SKILL_INTEGERS, difficultyLevel: 1, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}+{b}", generatorRanges: { a: [-9, 9], b: [-9, 9] } },
  { id: "integers-2", skillId: SKILL_INTEGERS, difficultyLevel: 2, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}-{b}+{c}", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9] } },
  { id: "integers-3", skillId: SKILL_INTEGERS, difficultyLevel: 3, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}*{b}-{c}", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-20, 20] } },

  // --- Order of operations ---
  { id: "order-1", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 2, topic: TOPIC_NUMBERS,
    statementTemplate: "({a}+{b})*{c}", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9] } },
  { id: "order-2", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 3, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}*({b}-{c})", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9] } },
  { id: "order-3", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 4, topic: TOPIC_NUMBERS,
    statementTemplate: "({a}-{b})*({c}+{d})", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9] } },

  // --- Fractions, basic ---
  { id: "fractions-basic-1", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 1, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}+{c}/{d}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9] } },
  { id: "fractions-basic-2", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}-{c}/{d}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9] } },
  { id: "fractions-basic-3", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}*{c}/{d}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9] } },

  // --- Fractions, advanced ---
  { id: "fractions-adv-1", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/({b}+{c})", generatorRanges: { a: [1, 20], b: [1, 9], c: [1, 9] } },
  { id: "fractions-adv-2", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "({a}/{b}+{c}/{d})*{e}/{f}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9], e: [1, 5], f: [2, 9] } },
  { id: "fractions-adv-3", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 4, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}*({c}/{d}-{e}/{f})", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9], e: [1, 5], f: [2, 9] } },

  // --- Percentages, basic ---
  { id: "percent-basic-1", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 1, topic: TOPIC_FRACTIONS,
    statementTemplate: "{p}/100*{n}", generatorRanges: { p: [5, 95], n: [20, 500] } },
  { id: "percent-basic-2", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{n}-{p}/100*{n}", generatorRanges: { p: [5, 95], n: [20, 500] } },
  { id: "percent-basic-3", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "{n}+{p}/100*{n}", generatorRanges: { p: [5, 95], n: [20, 500] } },

  // --- Percentages, applied ---
  { id: "percent-applied-1", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{p}/100*({n}+{m})", generatorRanges: { p: [5, 95], n: [20, 300], m: [10, 200] } },
  { id: "percent-applied-2", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "({n}+{p}/100*{n})/{d}", generatorRanges: { p: [5, 95], n: [20, 300], d: [2, 9] } },
  { id: "percent-applied-3", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 4, topic: TOPIC_FRACTIONS,
    statementTemplate: "{n}*{p}/100-{m}", generatorRanges: { p: [5, 95], n: [20, 300], m: [1, 50] } },

  // --- Linear equations, basic ---
  { id: "linear-basic-1", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 1, topic: TOPIC_LINEAR,
    statementTemplate: "{a}x={b}", generatorRanges: { a: [1, 9], b: [-50, 50] } },
  { id: "linear-basic-2", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 2, topic: TOPIC_LINEAR,
    statementTemplate: "{a}x+{b}={c}", generatorRanges: { a: [1, 9], b: [-20, 20], c: [-50, 50] } },
  { id: "linear-basic-3", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 3, topic: TOPIC_LINEAR,
    statementTemplate: "x/{a}+{b}={c}", generatorRanges: { a: [2, 9], b: [-20, 20], c: [-50, 50] } },

  // --- Linear equations with distribution ---
  { id: "linear-dist-1", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 2, topic: TOPIC_LINEAR,
    statementTemplate: "{a}(x+{b})={c}", generatorRanges: { a: [2, 9], b: [-9, 9], c: [-50, 50] } },
  { id: "linear-dist-2", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 3, topic: TOPIC_LINEAR,
    statementTemplate: "{a}(x-{b})={c}", generatorRanges: { a: [2, 9], b: [-9, 9], c: [-50, 50] } },
  { id: "linear-dist-3", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 4, topic: TOPIC_LINEAR,
    statementTemplate: "{a}(x+{b})+{c}={d}", generatorRanges: { a: [2, 9], b: [-9, 9], c: [-20, 20], d: [-50, 50] } },

  // --- Linear equations, advanced (variable on both sides) ---
  { id: "linear-adv-1", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 3, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}x+{b}={c}x+{d}", generatorRanges: { a: [1, 9], b: [-20, 20], c: [1, 9], d: [-20, 20] } },
  { id: "linear-adv-2", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 4, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}(x+{b})={c}(x-{d})", generatorRanges: { a: [2, 9], b: [-9, 9], c: [2, 9], d: [-9, 9] } },
  { id: "linear-adv-3", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 5, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}x+{b}(x+{c})={d}", generatorRanges: { a: [1, 9], b: [2, 9], c: [-9, 9], d: [-50, 50] } },
];

const CERMAT_JPZ = "https://prijimacky.cermat.gov.cz/files/files/dokumenty/specifikace-pozadavku/Specifikace_2022-2023/MASPECIFIKACEPOZADAVKU2022.pdf";
const CERMAT_MZ = "https://maturita.cermat.gov.cz/files/files/MAR_MZ2024_TS_PL.pdf";

const tracks: Track[] = [
  {
    id: "ss-prijimacky",
    title: { cs: "Přijímačky na střední školu", en: "Lower-secondary entrance exam" },
    description: {
      cs: "Jednotná přijímací zkouška z matematiky (9. třída): čísla, mocniny, rovnice, soustavy, závislosti a data, geometrie i nestandardní úlohy. U zkoušky je kalkulačka zakázána.",
      en: "The Czech unified entrance exam in mathematics: numbers, powers, equations, systems, relations and data, geometry and non-standard problems. Calculators are not allowed at the exam.",
    },
    examFamily: "ss-prijimacky", calculator: "none", sourceUrl: CERMAT_JPZ,
    topicIds: [TOPIC_NUMBERS, TOPIC_FRACTIONS, "mocniny-a-vyrazy", TOPIC_LINEAR, "soustavy-rovnic", "zavislosti-a-data", "geometrie", "nestandardni-ulohy"],
  },
  {
    id: "vs-prijimacky",
    title: { cs: "Přijímačky na vysokou školu", en: "University entrance exam" },
    description: {
      cs: "Příprava na písemné přijímací testy z matematiky (např. MFF, FEL, VŠE): rovnice a nerovnice, funkce, goniometrie, kombinatorika. Osnova je orientační; zkontroluj si požadavky své fakulty.",
      en: "Preparation for written university entrance tests in mathematics: equations and inequalities, functions, trigonometry, combinatorics. The syllabus is indicative; check your faculty's requirements.",
    },
    examFamily: "vs-prijimacky", calculator: "scientific", unofficial: true,
    topicIds: [TOPIC_NUMBERS, TOPIC_FRACTIONS, "mocniny-a-vyrazy", TOPIC_LINEAR, TOPIC_LINEAR_ADVANCED, "soustavy-rovnic", "funkce", "geometrie", "goniometrie", "nestandardni-ulohy", "kombinatorika-pravdepodobnost"],
  },
  {
    id: "maturita",
    title: { cs: "Maturita z matematiky", en: "Maturita (school-leaving exam) in mathematics" },
    description: {
      cs: "Opakování učiva pro maturitu: čísla a algebra, rovnice a nerovnice, funkce, posloupnosti a finance, goniometrie, kombinatorika a pravděpodobnost. U zkoušky je povolena kalkulačka bez grafického režimu a řešení rovnic.",
      en: "Review for the maturita: algebra, equations and inequalities, functions, sequences and finance, trigonometry, combinatorics and probability. A calculator without graphing or equation solving is allowed at the exam.",
    },
    examFamily: "maturita", calculator: "scientific", sourceUrl: CERMAT_MZ,
    // Every skill in fractions/linear is gated behind SKILL_INTEGERS (TOPIC_NUMBERS).
    topicIds: [TOPIC_NUMBERS, TOPIC_FRACTIONS, "mocniny-a-vyrazy", TOPIC_LINEAR, TOPIC_LINEAR_ADVANCED, "funkce", "posloupnosti-a-finance", "geometrie", "goniometrie", "nestandardni-ulohy", "kombinatorika-pravdepodobnost"],
  },
  {
    id: "vysoka-skola",
    title: { cs: "Vysoká škola — základy algebry", en: "University — algebra foundations" },
    description: {
      cs: "Rychlé oprášení středoškolské algebry před prvním semestrem: čísla, zlomky, mocniny, rovnice a soustavy.",
      en: "A quick refresher of school algebra before the first semester: numbers, fractions, powers, equations and systems.",
    },
    examFamily: "vysoka-skola", unofficial: true,
    topicIds: [TOPIC_NUMBERS, TOPIC_LINEAR, TOPIC_LINEAR_ADVANCED, TOPIC_FRACTIONS, "mocniny-a-vyrazy", "soustavy-rovnic"],
  },
  {
    id: "vs-analyza",
    title: { cs: "VŠ — Matematická analýza", en: "University — Calculus" },
    description: {
      cs: "Limity, derivace a integrály podle typického prvního semestru. Neoficiální osnova; kroky nejsou automaticky kontrolovány.",
      en: "Limits, derivatives and integrals as in a typical first semester. Unofficial syllabus; steps are not machine-checked.",
    },
    examFamily: "vysoka-skola", unofficial: true, topicIds: ["va-limity", "va-derivace", "va-integraly"],
  },
  {
    id: "vs-linearni-algebra",
    title: { cs: "VŠ — Lineární algebra", en: "University — Linear algebra" },
    description: {
      cs: "Soustavy, matice, determinanty, vektorové prostory a vlastní čísla. Neoficiální osnova; kroky nejsou automaticky kontrolovány.",
      en: "Systems, matrices, determinants, vector spaces and eigenvalues. Unofficial syllabus; steps are not machine-checked.",
    },
    examFamily: "vysoka-skola", unofficial: true, topicIds: ["la-soustavy-matice", "la-prostory"],
  },
  {
    id: "vs-diskretni",
    title: { cs: "VŠ — Diskrétní matematika", en: "University — Discrete mathematics" },
    description: {
      cs: "Logika, množiny a relace, indukce, kombinatorika a grafy. Neoficiální osnova; kroky nejsou automaticky kontrolovány.",
      en: "Logic, sets and relations, induction, combinatorics and graphs. Unofficial syllabus; steps are not machine-checked.",
    },
    examFamily: "vysoka-skola", unofficial: true, topicIds: ["dm-logika-mnoziny", "dm-kombinatorika-grafy"],
  },
  {
    id: "vs-statistika",
    title: { cs: "VŠ — Pravděpodobnost a statistika", en: "University — Probability and statistics" },
    description: {
      cs: "Pravděpodobnost, náhodné veličiny, odhady a testování hypotéz. Neoficiální osnova; kroky nejsou automaticky kontrolovány.",
      en: "Probability, random variables, estimation and hypothesis testing. Unofficial syllabus; steps are not machine-checked.",
    },
    examFamily: "vysoka-skola", unofficial: true, topicIds: ["st-pravdepodobnost", "st-statistika"],
  },
];

export const catalog: CourseCatalog = {
  tracks, topics: [...topics, ...extraTopics], skills: [...skills, ...extraSkills], problemTemplates: [...problemTemplates, ...extraTemplates],
};

export function buildCatalog(): CourseCatalog {
  return catalog;
}
