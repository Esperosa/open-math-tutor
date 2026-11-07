import { getSkillTemplates, getTopicSkills, getTrackTopics, type CourseCatalog } from "./curriculum.js";
import { formatExpected, instantiateProblem, type ExpectedAnswer } from "./answers.js";

export interface TestItem {
  n: number;
  skillId: string;
  skillTitle: string;
  statement: string;
  expected?: ExpectedAnswer;
  answerNote?: string;
  /** The task is to draw; the answer is judged by a person. */
  drawing: boolean;
}
export interface GeneratedTest { trackId: string; topicId: string | null; items: TestItem[] }

function readableTestStatement(statement: string, locale: "cs" | "en"): string {
  // Turn raw 40/100*240 into readable 40 % z 240
  const pct1 = /^(\d+)\/100\*(\d+)$/.exec(statement);
  if (pct1) return locale === "cs" ? `${pct1[1]} % z ${pct1[2]}` : `${pct1[1]}% of ${pct1[2]}`;
  const pct2 = /^(\d+)-(\d+)\/100\*(\d+)$/.exec(statement);
  if (pct2 && pct2[1] === pct2[3]) return locale === "cs" ? `Zmenši ${pct2[1]} o ${pct2[2]} %` : `Decrease ${pct2[1]} by ${pct2[2]}%`;
  const pct3 = /^(\d+)\+(\d+)\/100\*(\d+)$/.exec(statement);
  if (pct3 && pct3[1] === pct3[3]) return locale === "cs" ? `Zvětši ${pct3[1]} o ${pct3[2]} %` : `Increase ${pct3[1]} by ${pct3[2]}%`;

  // Equations without an instruction get "Řeš rovnici: "
  if (statement.includes("=") && !/^(?:Řeš|Solve|Vypočítej|Urči|Najdi|Calculate|Find|Nakresli|Draw)/i.test(statement)) {
    return locale === "cs" ? `Řeš rovnici: ${statement}` : `Solve the equation: ${statement}`;
  }
  return statement;
}

function toFraction(val: number, maxDen = 1000): { num: number; den: number } | null {
  if (!Number.isFinite(val) || Math.abs(val) > 1e6) return null;
  const sign = val < 0 ? -1 : 1;
  val = Math.abs(val);
  let h1 = 1, h0 = 0, k1 = 0, k0 = 1;
  let b = val;
  for (let step = 0; step < 20; step++) {
    const a = Math.floor(b);
    const h2 = a * h1 + h0;
    const k2 = a * k1 + k0;
    if (k2 > maxDen) break;
    h0 = h1; h1 = h2;
    k0 = k1; k1 = k2;
    if (Math.abs(val - h1 / k1) < 1e-7) {
      if (k1 > 1) return { num: sign * h1, den: k1 };
      return null;
    }
    const diff = b - a;
    if (Math.abs(diff) < 1e-9) break;
    b = 1 / diff;
  }
  if (k1 > 1 && Math.abs(val - h1 / k1) < 1e-4) return { num: sign * h1, den: k1 };
  return null;
}

/** Builds a printable test from the catalog with no AI: per skill the templates are used from easy to hard, each with fresh numbers. */
export function generateTest(catalog: CourseCatalog, scope: { trackId: string; topicId?: string }, perSkill = 2, random: () => number = Math.random, locale: "cs" | "en" = "cs"): GeneratedTest {
  const skills = scope.topicId ? getTopicSkills(catalog, scope.topicId)
    : getTrackTopics(catalog, scope.trackId).flatMap(topic => getTopicSkills(catalog, topic.id));
  const seen = new Set<string>();
  const items: TestItem[] = [];
  for (const skill of skills) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    const templates = [...getSkillTemplates(catalog, skill.id)].sort((a, b) => a.difficultyLevel - b.difficultyLevel);
    if (!templates.length) continue;
    for (let i = 0; i < Math.min(perSkill, templates.length); i++) {
      const template = templates[Math.min(templates.length - 1, Math.round(i * (templates.length - 1) / Math.max(1, perSkill - 1)))]!;
      const tpl = (locale === "en" && template.statementTemplateEn)
        ? { ...template, statementTemplate: template.statementTemplateEn }
        : template;
      const problem = instantiateProblem(tpl, random);
      const statement = readableTestStatement(problem.statement, locale);
      items.push({ n: items.length + 1, skillId: skill.id, skillTitle: skill.title[locale], statement,
        ...(problem.expected ? { expected: problem.expected } : {}), ...(template.answerNote ? { answerNote: template.answerNote } : {}), drawing: skill.drawing === true });
    }
  }
  return { trackId: scope.trackId, topicId: scope.topicId ?? null, items };
}

export function answerKeyText(item: TestItem, locale: "cs" | "en"): string {
  if (item.expected) {
    const val = item.expected.value;
    if (!Number.isInteger(val)) {
      const frac = toFraction(val);
      if (frac) {
        const dec = formatExpected(item.expected, locale);
        const unit = item.expected.unit ? ` ${item.expected.unit}` : "";
        return `${frac.num}/${frac.den}${unit} (${dec})`;
      }
    }
    return formatExpected(item.expected, locale);
  }
  if (item.answerNote) return item.answerNote;
  if (item.drawing) return locale === "cs" ? "kresba, posuzuje učitel" : "a drawing, judged by a teacher";
  return locale === "cs" ? "ručně hodnocené s postupem" : "manual grading with procedure";
}
