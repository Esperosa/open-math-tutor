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
    problemTemplateIds: ["integers-1", "integers-2", "integers-3", "integers-4", "integers-5", "integers-6", "integers-7", "integers-8"],
  },
  {
    id: SKILL_ORDER_OF_OPERATIONS,
    title: { cs: "Pořadí operací a závorky", en: "Order of operations and parentheses" },
    prerequisiteSkillIds: [SKILL_INTEGERS],
    problemTemplateIds: ["order-1", "order-2", "order-3", "order-4", "order-5", "order-6", "order-7", "order-8"],
  },
  {
    id: SKILL_FRACTIONS_BASIC,
    title: { cs: "Základní operace se zlomky", en: "Basic fraction operations" },
    prerequisiteSkillIds: [SKILL_INTEGERS],
    problemTemplateIds: ["fractions-basic-1", "fractions-basic-2", "fractions-basic-3", "fractions-basic-4", "fractions-basic-5", "fractions-basic-6", "fractions-basic-7", "fractions-basic-8"],
  },
  {
    id: SKILL_FRACTIONS_ADVANCED,
    title: { cs: "Zlomky se závorkami", en: "Fractions with parentheses" },
    prerequisiteSkillIds: [SKILL_FRACTIONS_BASIC],
    problemTemplateIds: ["fractions-adv-1", "fractions-adv-2", "fractions-adv-3", "fractions-adv-4", "fractions-adv-5", "fractions-adv-6", "fractions-adv-7", "fractions-adv-8"],
  },
  {
    id: SKILL_PERCENTAGES_BASIC,
    title: { cs: "Výpočet procent z čísla", en: "Computing a percentage of a number" },
    prerequisiteSkillIds: [SKILL_FRACTIONS_BASIC],
    problemTemplateIds: ["percent-basic-1", "percent-basic-2", "percent-basic-3", "percent-basic-4", "percent-basic-5", "percent-basic-6", "percent-basic-7", "percent-basic-8"],
  },
  {
    id: SKILL_PERCENTAGES_APPLIED,
    title: { cs: "Procentuální nárůst a pokles", en: "Percentage increase and decrease" },
    prerequisiteSkillIds: [SKILL_PERCENTAGES_BASIC],
    problemTemplateIds: ["percent-applied-1", "percent-applied-2", "percent-applied-3", "percent-applied-4", "percent-applied-5", "percent-applied-6", "percent-applied-7", "percent-applied-8"],
  },
  {
    id: SKILL_LINEAR_BASIC,
    title: { cs: "Jednoduché lineární rovnice", en: "Simple linear equations" },
    prerequisiteSkillIds: [SKILL_INTEGERS],
    problemTemplateIds: ["linear-basic-1", "linear-basic-2", "linear-basic-3", "linear-basic-4", "linear-basic-5", "linear-basic-6", "linear-basic-7", "linear-basic-8"],
  },
  {
    id: SKILL_LINEAR_DISTRIBUTION,
    title: { cs: "Rovnice se závorkou", en: "Equations with distribution" },
    prerequisiteSkillIds: [SKILL_LINEAR_BASIC, SKILL_ORDER_OF_OPERATIONS],
    problemTemplateIds: ["linear-dist-1", "linear-dist-2", "linear-dist-3", "linear-dist-4", "linear-dist-5", "linear-dist-6", "linear-dist-7", "linear-dist-8"],
  },
  {
    id: SKILL_LINEAR_ADVANCED,
    title: { cs: "Rovnice s neznámou na obou stranách", en: "Equations with the variable on both sides" },
    prerequisiteSkillIds: [SKILL_LINEAR_DISTRIBUTION],
    problemTemplateIds: ["linear-adv-1", "linear-adv-2", "linear-adv-3", "linear-adv-4", "linear-adv-5", "linear-adv-6", "linear-adv-7", "linear-adv-8"],
  },
];

const problemTemplates: ProblemTemplate[] = [
  // --- Integers (D8: always has negative numbers, non-zero terms so no degenerate "5" or "-4") ---
  { id: "integers-1", skillId: SKILL_INTEGERS, difficultyLevel: 1, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}+{b}", statementTemplateEn: "{a}+{b}", generatorRanges: { a: [-9, -1], b: [1, 9] } },
  { id: "integers-2", skillId: SKILL_INTEGERS, difficultyLevel: 2, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}-{b}+{c}", statementTemplateEn: "{a}-{b}+{c}", generatorRanges: { a: [-9, -1], b: [1, 9], c: [1, 9] } },
  { id: "integers-3", skillId: SKILL_INTEGERS, difficultyLevel: 3, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}*{b}-{c}", statementTemplateEn: "{a}*{b}-{c}", generatorRanges: { a: [-9, -1], b: [2, 9], c: [1, 9] } },
  { id: "integers-4", skillId: SKILL_INTEGERS, difficultyLevel: 1, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}-{b}", statementTemplateEn: "{a}-{b}", generatorRanges: { a: [-9, -1], b: [1, 9] } },
  { id: "integers-5", skillId: SKILL_INTEGERS, difficultyLevel: 2, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}*({b}+{c})", statementTemplateEn: "{a}*({b}+{c})", generatorRanges: { a: [-9, -1], b: [1, 5], c: [1, 5] } },
  { id: "integers-6", skillId: SKILL_INTEGERS, difficultyLevel: 2, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}+({b}*{c})", statementTemplateEn: "{a}+({b}*{c})", generatorRanges: { a: [-9, -1], b: [-5, -1], c: [2, 5] } },
  { id: "integers-7", skillId: SKILL_INTEGERS, difficultyLevel: 3, topic: TOPIC_NUMBERS,
    statementTemplate: "({a}-{b})*{c}", statementTemplateEn: "({a}-{b})*{c}", generatorRanges: { a: [-5, -1], b: [1, 5], c: [2, 4] } },
  { id: "integers-8", skillId: SKILL_INTEGERS, difficultyLevel: 3, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}-{b}*{c}", statementTemplateEn: "{a}-{b}*{c}", generatorRanges: { a: [-9, -1], b: [2, 5], c: [2, 5] } },

  // --- Order of operations ---
  { id: "order-1", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 2, topic: TOPIC_NUMBERS,
    statementTemplate: "({a}+{b})*{c}", statementTemplateEn: "({a}+{b})*{c}", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9] } },
  { id: "order-2", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 3, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}*({b}-{c})", statementTemplateEn: "{a}*({b}-{c})", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9] } },
  { id: "order-3", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 4, topic: TOPIC_NUMBERS,
    statementTemplate: "({a}-{b})*({c}+{d})", statementTemplateEn: "({a}-{b})*({c}+{d})", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9] } },
  { id: "order-4", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 2, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}+{b}*{c}", statementTemplateEn: "{a}+{b}*{c}", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9] } },
  { id: "order-5", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 3, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}*{b}+{c}*{d}", statementTemplateEn: "{a}*{b}+{c}*{d}", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9] } },
  { id: "order-6", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 4, topic: TOPIC_NUMBERS,
    statementTemplate: "({a}+{b})*({c}-{d})", statementTemplateEn: "({a}+{b})*({c}-{d})", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9] } },
  { id: "order-7", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 3, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}*({b}+{c})-{d}", statementTemplateEn: "{a}*({b}+{c})-{d}", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9] } },
  { id: "order-8", skillId: SKILL_ORDER_OF_OPERATIONS, difficultyLevel: 3, topic: TOPIC_NUMBERS,
    statementTemplate: "{a}+{b}*({c}+{d})", statementTemplateEn: "{a}+{b}*({c}+{d})", generatorRanges: { a: [-9, 9], b: [-9, 9], c: [-9, 9], d: [-9, 9] } },

  // --- Fractions, basic ---
  { id: "fractions-basic-1", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 1, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}+{c}/{d}", statementTemplateEn: "{a}/{b}+{c}/{d}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9] } },
  { id: "fractions-basic-2", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}-{c}/{d}", statementTemplateEn: "{a}/{b}-{c}/{d}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9] } },
  { id: "fractions-basic-3", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}*{c}/{d}", statementTemplateEn: "{a}/{b}*{c}/{d}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9] } },
  { id: "fractions-basic-4", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 1, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}+{c}/{b}", statementTemplateEn: "{a}/{b}+{c}/{b}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8] } },
  { id: "fractions-basic-5", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 1, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}-{c}/{b}", statementTemplateEn: "{a}/{b}-{c}/{b}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8] } },
  { id: "fractions-basic-6", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}+{b}/{c}", statementTemplateEn: "{a}+{b}/{c}", generatorRanges: { a: [1, 5], b: [1, 8], c: [2, 9] } },
  { id: "fractions-basic-7", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}-{b}/{c}", statementTemplateEn: "{a}-{b}/{c}", generatorRanges: { a: [1, 5], b: [1, 8], c: [2, 9] } },
  { id: "fractions-basic-8", skillId: SKILL_FRACTIONS_BASIC, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}*{c}", statementTemplateEn: "{a}/{b}*{c}", generatorRanges: { a: [1, 8], b: [2, 9], c: [2, 6] } },

  // --- Fractions, advanced ---
  { id: "fractions-adv-1", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/({b}+{c})", statementTemplateEn: "{a}/({b}+{c})", generatorRanges: { a: [1, 20], b: [1, 9], c: [1, 9] } },
  { id: "fractions-adv-2", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "({a}/{b}+{c}/{d})*{e}/{f}", statementTemplateEn: "({a}/{b}+{c}/{d})*{e}/{f}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9], e: [1, 5], f: [2, 9] } },
  { id: "fractions-adv-3", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 4, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}*({c}/{d}-{e}/{f})", statementTemplateEn: "{a}/{b}*({c}/{d}-{e}/{f})", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9], e: [1, 5], f: [2, 9] } },
  { id: "fractions-adv-4", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "({a}/{b}-{c}/{d})*{e}", statementTemplateEn: "({a}/{b}-{c}/{d})*{e}", generatorRanges: { a: [1, 8], b: [2, 9], c: [1, 8], d: [2, 9], e: [2, 6] } },
  { id: "fractions-adv-5", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}*({b}/{c}+{d}/{e})", statementTemplateEn: "{a}*({b}/{c}+{d}/{e})", generatorRanges: { a: [2, 6], b: [1, 6], c: [2, 8], d: [1, 6], e: [2, 8] } },
  { id: "fractions-adv-6", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 4, topic: TOPIC_FRACTIONS,
    statementTemplate: "({a}+{b}/{c})*{d}/{e}", statementTemplateEn: "({a}+{b}/{c})*{d}/{e}", generatorRanges: { a: [1, 4], b: [1, 6], c: [2, 8], d: [1, 5], e: [2, 8] } },
  { id: "fractions-adv-7", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "({a}/{b}+{c}/{d})*{e}", statementTemplateEn: "({a}/{b}+{c}/{d})*{e}", generatorRanges: { a: [1, 6], b: [2, 8], c: [1, 6], d: [2, 8], e: [2, 5] } },
  { id: "fractions-adv-8", skillId: SKILL_FRACTIONS_ADVANCED, difficultyLevel: 4, topic: TOPIC_FRACTIONS,
    statementTemplate: "{a}/{b}+({c}/{d})*{e}/{f}", statementTemplateEn: "{a}/{b}+({c}/{d})*{e}/{f}", generatorRanges: { a: [1, 6], b: [2, 8], c: [1, 6], d: [2, 8], e: [1, 5], f: [2, 8] } },

  // --- Percentages, basic ---
  { id: "percent-basic-1", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 1, topic: TOPIC_FRACTIONS,
    statementTemplate: "{p}/100*{n}", statementTemplateEn: "{p}/100*{n}", generatorRanges: { p: [5, 95], n: [20, 500] } },
  { id: "percent-basic-2", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{n}-{p}/100*{n}", statementTemplateEn: "{n}-{p}/100*{n}", generatorRanges: { p: [5, 95], n: [20, 500] } },
  { id: "percent-basic-3", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "{n}+{p}/100*{n}", statementTemplateEn: "{n}+{p}/100*{n}", generatorRanges: { p: [5, 95], n: [20, 500] } },
  { id: "percent-basic-4", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{p}/100*{n}+{m}", statementTemplateEn: "{p}/100*{n}+{m}", generatorRanges: { p: [5, 95], n: [20, 400], m: [5, 100] } },
  { id: "percent-basic-5", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{p}/100*{n}-{m}", statementTemplateEn: "{p}/100*{n}-{m}", generatorRanges: { p: [10, 95], n: [50, 400], m: [1, 20] } },
  { id: "percent-basic-6", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{p}/100*{n}*2", statementTemplateEn: "{p}/100*{n}*2", generatorRanges: { p: [5, 50], n: [20, 200] } },
  { id: "percent-basic-7", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "{p}/100*({n}*2)", statementTemplateEn: "{p}/100*({n}*2)", generatorRanges: { p: [5, 50], n: [20, 200] } },
  { id: "percent-basic-8", skillId: SKILL_PERCENTAGES_BASIC, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "({n}-{p}/100*{n})*2", statementTemplateEn: "({n}-{p}/100*{n})*2", generatorRanges: { p: [5, 50], n: [20, 200] } },

  // --- Percentages, applied ---
  { id: "percent-applied-1", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{p}/100*({n}+{m})", statementTemplateEn: "{p}/100*({n}+{m})", generatorRanges: { p: [5, 95], n: [20, 300], m: [10, 200] } },
  { id: "percent-applied-2", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "({n}+{p}/100*{n})/{d}", statementTemplateEn: "({n}+{p}/100*{n})/{d}", generatorRanges: { p: [5, 95], n: [20, 300], d: [2, 9] } },
  { id: "percent-applied-3", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 4, topic: TOPIC_FRACTIONS,
    statementTemplate: "{n}*{p}/100-{m}", statementTemplateEn: "{n}*{p}/100-{m}", generatorRanges: { p: [5, 95], n: [20, 300], m: [1, 50] } },
  { id: "percent-applied-4", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 2, topic: TOPIC_FRACTIONS,
    statementTemplate: "{p}/100*({n}-{m})", statementTemplateEn: "{p}/100*({n}-{m})", generatorRanges: { p: [5, 95], n: [100, 300], m: [10, 50] } },
  { id: "percent-applied-5", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "({n}-{p}/100*{n})/{d}", statementTemplateEn: "({n}-{p}/100*{n})/{d}", generatorRanges: { p: [5, 95], n: [40, 300], d: [2, 8] } },
  { id: "percent-applied-6", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 4, topic: TOPIC_FRACTIONS,
    statementTemplate: "{p}/100*{n}+{q}/100*{m}", statementTemplateEn: "{p}/100*{n}+{q}/100*{m}", generatorRanges: { p: [5, 50], n: [20, 200], q: [5, 50], m: [20, 200] } },
  { id: "percent-applied-7", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 3, topic: TOPIC_FRACTIONS,
    statementTemplate: "{n}+{p}/100*{n}+{m}", statementTemplateEn: "{n}+{p}/100*{n}+{m}", generatorRanges: { p: [5, 50], n: [20, 200], m: [10, 100] } },
  { id: "percent-applied-8", skillId: SKILL_PERCENTAGES_APPLIED, difficultyLevel: 4, topic: TOPIC_FRACTIONS,
    statementTemplate: "({n}+{m})-{p}/100*({n}+{m})", statementTemplateEn: "({n}+{m})-{p}/100*({n}+{m})", generatorRanges: { p: [5, 50], n: [50, 200], m: [20, 100] } },

  // --- Linear equations, basic (D8: a in [2, 9] with derived b so never degenerates to "x=29") ---
  { id: "linear-basic-1", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 1, topic: TOPIC_LINEAR,
    statementTemplate: "{a}x={b}", statementTemplateEn: "{a}x={b}", generatorRanges: { a: [2, 9], b: [-50, 50] } },
  { id: "linear-basic-2", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 2, topic: TOPIC_LINEAR,
    statementTemplate: "{a}x+{b}={c}", statementTemplateEn: "{a}x+{b}={c}", generatorRanges: { a: [2, 9], b: [-20, 20], c: [-50, 50] } },
  { id: "linear-basic-3", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 3, topic: TOPIC_LINEAR,
    statementTemplate: "x/{a}+{b}={c}", statementTemplateEn: "x/{a}+{b}={c}", generatorRanges: { a: [2, 9], b: [-20, 20], c: [-50, 50] } },
  { id: "linear-basic-4", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 2, topic: TOPIC_LINEAR,
    statementTemplate: "{a}x-{b}={c}", statementTemplateEn: "{a}x-{b}={c}", generatorRanges: { a: [2, 9], b: [1, 30], c: [-50, 50] } },
  { id: "linear-basic-5", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 2, topic: TOPIC_LINEAR,
    statementTemplate: "{b}+{a}x={c}", statementTemplateEn: "{b}+{a}x={c}", generatorRanges: { a: [2, 9], b: [-20, 20], c: [-50, 50] } },
  { id: "linear-basic-6", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 2, topic: TOPIC_LINEAR,
    statementTemplate: "{b}-{a}x={c}", statementTemplateEn: "{b}-{a}x={c}", generatorRanges: { a: [2, 9], b: [-20, 20], c: [-50, 50] } },
  { id: "linear-basic-7", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 3, topic: TOPIC_LINEAR,
    statementTemplate: "x/{a}-{b}={c}", statementTemplateEn: "x/{a}-{b}={c}", generatorRanges: { a: [2, 9], b: [1, 20], c: [-30, 30] } },
  { id: "linear-basic-8", skillId: SKILL_LINEAR_BASIC, difficultyLevel: 2, topic: TOPIC_LINEAR,
    statementTemplate: "{a}x={b}+{c}", statementTemplateEn: "{a}x={b}+{c}", generatorRanges: { a: [2, 9], b: [-30, 30], c: [-30, 30] } },

  // --- Linear equations with distribution ---
  { id: "linear-dist-1", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 2, topic: TOPIC_LINEAR,
    statementTemplate: "{a}(x+{b})={c}", statementTemplateEn: "{a}(x+{b})={c}", generatorRanges: { a: [2, 9], b: [-9, 9], c: [-50, 50] } },
  { id: "linear-dist-2", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 3, topic: TOPIC_LINEAR,
    statementTemplate: "{a}(x-{b})={c}", statementTemplateEn: "{a}(x-{b})={c}", generatorRanges: { a: [2, 9], b: [-9, 9], c: [-50, 50] } },
  { id: "linear-dist-3", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 4, topic: TOPIC_LINEAR,
    statementTemplate: "{a}(x+{b})+{c}={d}", statementTemplateEn: "{a}(x+{b})+{c}={d}", generatorRanges: { a: [2, 9], b: [-9, 9], c: [-20, 20], d: [-50, 50] } },
  { id: "linear-dist-4", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 3, topic: TOPIC_LINEAR,
    statementTemplate: "{a}(x-{b})+{c}={d}", statementTemplateEn: "{a}(x-{b})+{c}={d}", generatorRanges: { a: [2, 9], b: [1, 9], c: [-20, 20], d: [-50, 50] } },
  { id: "linear-dist-5", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 3, topic: TOPIC_LINEAR,
    statementTemplate: "{a}(x+{b})-{c}={d}", statementTemplateEn: "{a}(x+{b})-{c}={d}", generatorRanges: { a: [2, 9], b: [-9, 9], c: [1, 20], d: [-50, 50] } },
  { id: "linear-dist-6", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 3, topic: TOPIC_LINEAR,
    statementTemplate: "{c}+{a}(x+{b})={d}", statementTemplateEn: "{c}+{a}(x+{b})={d}", generatorRanges: { a: [2, 9], b: [-9, 9], c: [-20, 20], d: [-50, 50] } },
  { id: "linear-dist-7", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 4, topic: TOPIC_LINEAR,
    statementTemplate: "{a}({b}x+{c})={d}", statementTemplateEn: "{a}({b}x+{c})={d}", generatorRanges: { a: [2, 5], b: [2, 4], c: [-6, 6], d: [-40, 40] } },
  { id: "linear-dist-8", skillId: SKILL_LINEAR_DISTRIBUTION, difficultyLevel: 4, topic: TOPIC_LINEAR,
    statementTemplate: "{a}({b}x-{c})={d}", statementTemplateEn: "{a}({b}x-{c})={d}", generatorRanges: { a: [2, 5], b: [2, 4], c: [1, 6], d: [-40, 40] } },

  // --- Linear equations, advanced (variable on both sides, guaranteed unique coefficients) ---
  { id: "linear-adv-1", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 3, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}x+{b}={c}x+{d}", statementTemplateEn: "{a}x+{b}={c}x+{d}", generatorRanges: { a: [2, 9], b: [-20, 20], c: [2, 9], d: [-20, 20] } },
  { id: "linear-adv-2", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 4, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}(x+{b})={c}(x-{d})", statementTemplateEn: "{a}(x+{b})={c}(x-{d})", generatorRanges: { a: [2, 9], b: [-9, 9], c: [2, 9], d: [-9, 9] } },
  { id: "linear-adv-3", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 5, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}x+{b}(x+{c})={d}", statementTemplateEn: "{a}x+{b}(x+{c})={d}", generatorRanges: { a: [1, 9], b: [2, 9], c: [-9, 9], d: [-50, 50] } },
  { id: "linear-adv-4", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 3, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}x-{b}={c}x+{d}", statementTemplateEn: "{a}x-{b}={c}x+{d}", generatorRanges: { a: [2, 9], b: [1, 20], c: [2, 9], d: [-20, 20] } },
  { id: "linear-adv-5", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 4, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}(x+{b})={c}(x+{d})", statementTemplateEn: "{a}(x+{b})={c}(x+{d})", generatorRanges: { a: [2, 8], b: [-9, 9], c: [2, 8], d: [-9, 9] } },
  { id: "linear-adv-6", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 4, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}(x-{b})={c}(x+{d})", statementTemplateEn: "{a}(x-{b})={c}(x+{d})", generatorRanges: { a: [2, 8], b: [1, 9], c: [2, 8], d: [-9, 9] } },
  { id: "linear-adv-7", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 5, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}x-{b}(x+{c})={d}", statementTemplateEn: "{a}x-{b}(x+{c})={d}", generatorRanges: { a: [2, 9], b: [2, 6], c: [-8, 8], d: [-50, 50] } },
  { id: "linear-adv-8", skillId: SKILL_LINEAR_ADVANCED, difficultyLevel: 4, topic: TOPIC_LINEAR_ADVANCED,
    statementTemplate: "{a}(x+{b})+{c}x={d}", statementTemplateEn: "{a}(x+{b})+{c}x={d}", generatorRanges: { a: [2, 6], b: [-8, 8], c: [1, 6], d: [-50, 50] } },
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
    topicIds: [TOPIC_NUMBERS, TOPIC_FRACTIONS, "mocniny-a-vyrazy", TOPIC_LINEAR, TOPIC_LINEAR_ADVANCED, "soustavy-rovnic", "zavislosti-a-data", "geometrie", "nestandardni-ulohy"],
  },
  {
    id: "vs-prijimacky",
    title: { cs: "Přijímačky na vysokou školu", en: "University entrance exam" },
    description: {
      cs: "Příprava na písemné přijímací testy z matematiky (např. MFF, FEL, VŠE): rovnice a nerovnice, funkce, goniometrie, kombinatorika. Osnova je orientační; zkontroluj si požadavky své fakulty.",
      en: "Preparation for written university entrance tests in mathematics: equations and inequalities, functions, trigonometry, combinatorics. The syllabus is indicative; check your faculty's requirements.",
    },
    examFamily: "vs-prijimacky", calculator: "scientific", unofficial: true,
    topicIds: ["funkce", "goniometrie", "kombinatorika-pravdepodobnost", "soustavy-rovnic", "mocniny-a-vyrazy", "geometrie", "nestandardni-ulohy"],
  },
  {
    id: "maturita",
    title: { cs: "Maturita z matematiky", en: "Maturita (school-leaving exam) in mathematics" },
    description: {
      cs: "Opakování učiva pro maturitu: čísla a algebra, rovnice a nerovnice, funkce, posloupnosti a finance, goniometrie, kombinatorika a pravděpodobnost. U zkoušky je povolena kalkulačka bez grafického režimu a řešení rovnic.",
      en: "Review for the maturita: algebra, equations and inequalities, functions, sequences and finance, trigonometry, combinatorics and probability. A calculator without graphing or equation solving is allowed at the exam.",
    },
    examFamily: "maturita", calculator: "scientific", sourceUrl: CERMAT_MZ,
    topicIds: ["funkce", "posloupnosti-a-finance", "goniometrie", "kombinatorika-pravdepodobnost", "soustavy-rovnic", "mocniny-a-vyrazy", "geometrie", "nestandardni-ulohy"],
  },
  {
    id: "vysoka-skola",
    title: { cs: "Vysoká škola — základy algebry", en: "University — algebra foundations" },
    description: {
      cs: "Rychlé oprášení středoškolské algebry před prvním semestrem: čísla, zlomky, mocniny, rovnice a soustavy.",
      en: "A quick refresher of school algebra before the first semester: numbers, fractions, powers, equations and systems.",
    },
    examFamily: "vysoka-skola", unofficial: true,
    topicIds: ["soustavy-rovnic", "mocniny-a-vyrazy", "funkce", "geometrie"],
  },
  {
    id: "fyzika",
    title: { cs: "Fyzika — výpočty a schémata", en: "Physics — calculations and diagrams" },
    description: {
      cs: "Rychlost, síla, práce, tlak a elektřina: číselné úlohy s okamžitou kontrolou výsledku a kreslení schémat. Vlastní výběr látky, ne oficiální osnova.",
      en: "Speed, force, work, pressure and electricity: numeric problems with instant answer checking and diagram drawing. A selection of our own, not an official syllabus.",
    },
    examFamily: "fyzika", subject: "physics", calculator: "scientific", unofficial: true, topicIds: ["fy-mechanika", "fy-elektrina"],
  },
  {
    id: "chemie",
    title: { cs: "Chemie — výpočty a vzorce", en: "Chemistry — calculations and formulas" },
    description: {
      cs: "Molární hmotnost, látkové množství, koncentrace a stechiometrie s kontrolou výsledku, plus vyčíslování rovnic a kreslení vzorců. Vlastní výběr látky, ne oficiální osnova.",
      en: "Molar mass, amount of substance, concentration and stoichiometry with answer checking, plus balancing equations and drawing formulas. A selection of our own, not an official syllabus.",
    },
    examFamily: "chemie", subject: "chemistry", calculator: "scientific", unofficial: true, topicIds: ["ch-latkove-mnozstvi"],
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
