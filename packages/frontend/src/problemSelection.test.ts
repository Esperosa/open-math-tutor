import { describe, expect, test } from 'vitest';
import { catalog } from '@openmathtutor/content';
import { pickNextProblemForSkill, pickNextProblemForTrack, instantiateWithLocale } from './problemSelection';

function createPrng(seed = 123456789) {
  let s = seed;
  return function () {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('problem selection deduplication and localization (D10, D6)', () => {
  test('generates 12 consecutive unique problems for a skill with fixed seed', () => {
    const prng = createPrng(42);
    const recent: string[] = [];
    const skillId = 'quadratic-eq';

    for (let i = 0; i < 12; i++) {
      const res = pickNextProblemForSkill({
        catalog,
        skillId,
        difficultyLevel: 1,
        recentStatements: recent,
        locale: 'cs',
        random: prng,
      });
      expect(res).not.toBeNull();
      expect(recent).not.toContain(res!.problem.statement);
      recent.push(res!.problem.statement);
    }

    expect(new Set(recent).size).toBe(12);
  });

  test('generates 12 consecutive unique problems for chemistry molar mass', () => {
    const prng = createPrng(99);
    const recent: string[] = [];
    const skillId = 'ch-molar-mass';

    for (let i = 0; i < 12; i++) {
      const res = pickNextProblemForSkill({
        catalog,
        skillId,
        difficultyLevel: 1,
        recentStatements: recent,
        locale: 'cs',
        random: prng,
      });
      expect(res).not.toBeNull();
      expect(recent).not.toContain(res!.problem.statement);
      recent.push(res!.problem.statement);
    }

    expect(new Set(recent).size).toBe(12);
  });

  test('generates 12 consecutive unique problems with Math.random for every auto-checked skill', () => {
    const autoSkills = catalog.skills.filter(s => !s.drawing);

    for (const skill of autoSkills) {
      const recent: string[] = [];
      for (let i = 0; i < 12; i++) {
        const res = pickNextProblemForSkill({
          catalog,
          skillId: skill.id,
          difficultyLevel: 1,
          recentStatements: recent,
          locale: 'cs',
          random: Math.random,
        });
        expect(res).not.toBeNull();
        expect(recent).not.toContain(res!.problem.statement);
        recent.push(res!.problem.statement);
      }
      expect(new Set(recent).size).toBe(12);
    }
  });

  test('pickNextProblemForTrack produces 12 consecutive unique problems', () => {
    const prng = createPrng(777);
    const recent: string[] = [];
    const trackId = 'maturita';

    for (let i = 0; i < 12; i++) {
      const res = pickNextProblemForTrack({
        catalog,
        trackId,
        level: 1,
        mastery: {},
        recentStatements: recent,
        locale: 'cs',
        random: prng,
      });
      expect(res).not.toBeNull();
      expect(recent).not.toContain(res!.problem.statement);
      recent.push(res!.problem.statement);
    }

    expect(new Set(recent).size).toBe(12);
  });

  test('instantiateWithLocale respects English locale and statementTemplateEn', () => {
    const template = catalog.problemTemplates.find(t => t.skillId === 'fy-velocity' && t.statementTemplateEn);
    expect(template).toBeDefined();

    const csProblem = instantiateWithLocale(template!, 'cs');
    const enProblem = instantiateWithLocale(template!, 'en');

    expect(csProblem.statement).not.toBe(enProblem.statement);
    // English version should contain English words like car / train / velocity / km/h / speed
    expect(enProblem.statement).toMatch(/[A-Za-z]/);
  });
});
