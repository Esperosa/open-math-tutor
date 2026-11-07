import { describe, expect, it } from "vitest";
import { catalog } from "./catalog.js";
import { instantiateProblem, skillCheckLevel } from "@openmathtutor/shared";

describe("D10 + m1: pool expansion and nice quadratic roots", () => {
  it("every auto-check skill has at least 8 problem templates", () => {
    const autoCheckSkills = catalog.skills.filter(sk => skillCheckLevel(catalog, sk) !== "none");
    expect(autoCheckSkills.length).toBeGreaterThanOrEqual(10);
    for (const skill of autoCheckSkills) {
      expect(
        skill.problemTemplateIds.length,
        `skill ${skill.id} (${skill.title.cs}) has only ${skill.problemTemplateIds.length} templates, expected >= 8`
      ).toBeGreaterThanOrEqual(8);
    }
  });

  it("every skill in the catalog has at least 8 problem templates", () => {
    for (const skill of catalog.skills) {
      expect(
        skill.problemTemplateIds.length,
        `skill ${skill.id} (${skill.title.cs}) has only ${skill.problemTemplateIds.length} templates, expected >= 8`
      ).toBeGreaterThanOrEqual(8);
    }
  });

  it("ch-molar-mass has at least 10 substances and varied chemistry templates", () => {
    const molarMassSkill = catalog.skills.find(sk => sk.id === "ch-molar-mass");
    expect(molarMassSkill).toBeDefined();
    expect(molarMassSkill!.problemTemplateIds.length).toBeGreaterThanOrEqual(10);
    
    // Check ch-mole and ch-concentration also have >= 8
    const moleSkill = catalog.skills.find(sk => sk.id === "ch-mole");
    expect(moleSkill!.problemTemplateIds.length).toBeGreaterThanOrEqual(8);
    const concSkill = catalog.skills.find(sk => sk.id === "ch-concentration");
    expect(concSkill!.problemTemplateIds.length).toBeGreaterThanOrEqual(8);
  });

  it("quadratic equations in Maturita/Přijímačky VŠ always have nice integer or simple rational roots", () => {
    const quadTemplates = catalog.problemTemplates.filter(t => t.skillId === "quadratic-eq");
    expect(quadTemplates.length).toBeGreaterThanOrEqual(8);

    for (const template of quadTemplates) {
      for (let i = 0; i < 50; i++) {
        const problem = instantiateProblem(template);
        const stmt = problem.statement; // e.g. "x^2-5x+6=0" or "2x^2-11x+12=0" or "x^2-16=0" or "x^2+x=6"
        
        // Extract a, b, c from ax^2 + bx + c = 0 or ax^2 + bx = c
        // Standardize: move all terms to lhs = 0
        const parts = stmt.split("=");
        expect(parts.length).toBe(2);
        const lhs = parts[0]!;
        const rhs = parts[1]!;
        const rhsVal = Number(rhs.trim());

        // Parse lhs into a*x^2 + b*x + c
        let cleaned = lhs.replace(/\s+/g, "");
        // Handle terms: regex for ([-+]?\d*)x\^2, ([-+]?\d*)x, ([-+]?\d+)
        let a = 0, b = 0, c = 0;
        
        // Find x^2 term
        const mX2 = cleaned.match(/([+-]?\d*)x\^2/);
        if (mX2) {
          const coeff = mX2[1];
          a = coeff === "" || coeff === "+" ? 1 : coeff === "-" ? -1 : Number(coeff);
          cleaned = cleaned.replace(mX2[0], "");
        }
        
        // Find x term
        const mX = cleaned.match(/([+-]?\d*)x(?!\^)/);
        if (mX) {
          const coeff = mX[1];
          b = coeff === "" || coeff === "+" ? 1 : coeff === "-" ? -1 : Number(coeff);
          cleaned = cleaned.replace(mX[0], "");
        }
        
        // Remaining constant on lhs
        if (cleaned.length > 0) {
          c = Number(cleaned);
        }
        
        // Move rhsVal to lhs: c_total = c - rhsVal
        const cTotal = c - rhsVal;

        // Discriminant D = b^2 - 4ac
        const D = b * b - 4 * a * cTotal;
        expect(D, `Discriminant must be non-negative for ${stmt} (got ${D})`).toBeGreaterThanOrEqual(0);
        
        const sqrtD = Math.round(Math.sqrt(D));
        expect(sqrtD * sqrtD, `Discriminant must be a perfect square for ${stmt} (D=${D})`).toBe(D);

        // Roots x = (-b +- sqrtD) / (2a)
        const root1 = (-b + sqrtD) / (2 * a);
        const root2 = (-b - sqrtD) / (2 * a);

        // Roots must be integer or simple half-integers (denominator 1 or 2, i.e. 2*root is integer)
        expect(
          Number.isInteger(root1 * 2),
          `Root 1 (${root1}) for ${stmt} must be an integer or half-integer`
        ).toBe(true);
        expect(
          Number.isInteger(root2 * 2),
          `Root 2 (${root2}) for ${stmt} must be an integer or half-integer`
        ).toBe(true);
      }
    }
  });
});

describe("D6: English localized statements in catalog", () => {
  it("every problem template has a statementTemplateEn without Czech diacritics", () => {
    const czechDiacritics = /[áčďéěíňóřšťúůýž]/i;
    const exceptions: string[] = []; // Proper names if any

    for (const template of catalog.problemTemplates) {
      expect(
        template.statementTemplateEn,
        `template ${template.id} in skill ${template.skillId} is missing statementTemplateEn`
      ).toBeDefined();

      const enText = template.statementTemplateEn!;
      // Check for Czech diacritics
      const match = enText.match(czechDiacritics);
      if (match && !exceptions.some(ex => enText.includes(ex))) {
        expect.fail(
          `template ${template.id} statementTemplateEn "${enText}" contains Czech diacritic '${match[0]}'`
        );
      }
    }
  });

  it("instantiating template with statementTemplateEn produces English statement without Czech diacritics", () => {
    const czechDiacritics = /[áčďéěíňóřšťúůýž]/i;
    for (const template of catalog.problemTemplates) {
      const enTemplate = { ...template, statementTemplate: template.statementTemplateEn! };
      for (let i = 0; i < 5; i++) {
        const problem = instantiateProblem(enTemplate);
        expect(problem.statement).not.toMatch(czechDiacritics);
      }
    }
  });
});
