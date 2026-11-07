import { expect, it } from 'vitest';
import { catalog } from '@openmathtutor/content';
import {
  checkAnswerLine, expectedAnswerFor, formatExpected, getTopicSkills, getTrackTopics, instantiateProblem,
  skillCheckLevel, type ExpectedAnswer,
} from '@openmathtutor/shared';
import { recognizeBoardLines } from './index';
import { computeLineVerdicts } from '../lines';
import { random, richRowElements } from '../../tests/inkFixture';

function writeable(text: string): string {
  return text.replace(/²/g, '^2').replace(/³/g, '^3').replace(/Ω/g, 'ohm').replace(/Kč/g, 'Kc');
}

function answerText(expected: ExpectedAnswer): string {
  return writeable(formatExpected(expected, 'cs'));
}

function lineFor(level: string, expected: ExpectedAnswer, statement: string): string {
  if (level === 'answer') return answerText(expected);
  if (/[a-z]/.test(statement) && statement.includes('=')) {
    const symbol = statement.match(/[a-z]/)![0];
    return `${symbol}=${answerText(expected)}`;
  }
  return `${statement}=${answerText(expected)}`;
}

it('probe every auto-check skill through the real recognizer', () => {
  const seen = new Set<string>();
  const rows: string[] = [];
  let pass = 0, total = 0;
  for (const track of catalog.tracks) for (const topic of getTrackTopics(catalog, track.id)) for (const skill of getTopicSkills(catalog, topic.id)) {
    if (seen.has(skill.id)) continue;
    seen.add(skill.id);
    const level = skillCheckLevel(catalog, skill);
    if (level === 'none') continue;
    const templates = skill.problemTemplateIds.map(id => catalog.problemTemplates.find(tp => tp.id === id)!).filter(Boolean);
    for (const [index, template] of templates.entries()) {
      const rng = random(1234 + index * 97);
      const problem = instantiateProblem(template, rng);
      const expected = problem.expected ?? expectedAnswerFor(problem.statement);
      if (!expected) { rows.push(`${skill.id}\tNO EXPECTED\t${problem.statement}`); continue; }
      const line = lineFor(level, expected, problem.statement);
      let elements;
      try { elements = richRowElements(line, 77 + index * 31, 40, [300, 260]); }
      catch (error) { rows.push(`MISSING\t${skill.id}\t${level}\t${line}\t${(error as Error).message}`); continue; }
      const recognized = recognizeBoardLines(elements);
      const text = recognized.map(r => r.text).join(' | ');
      total++;
      const verdict = checkAnswerLine(expected, text);
      const lineVerdict = computeLineVerdicts(problem.statement, [{ stepId: 's', latexGuess: text, parentId: 's' }], expected).s;
      const ok = verdict === 'correct' && lineVerdict?.status === 'ok';
      if (ok) pass++;
      rows.push(`${ok ? 'PASS' : 'FAIL'}\t${skill.id}\t${level}\tstmt=${problem.statement}\twant=${line}\tgot=${text}\t${verdict}/${lineVerdict?.status}${lineVerdict?.status === 'wrong' ? ':' + lineVerdict.reason : ''}\texp=${expected.value}${expected.unit ?? ''}\tconf=${recognized[0]?.confidence.toFixed(3)}`);
    }
  }
  const failed = rows.filter(row => row.startsWith('FAIL') || row.startsWith('MISSING'));
  if (failed.length) console.log(failed.join('\n'));
  console.log(`SUMMARY ${pass}/${total} (${((pass / total) * 100).toFixed(2)} %)`);
  expect(total).toBeGreaterThanOrEqual(60);
  expect(pass / total).toBeGreaterThanOrEqual(0.9);
});
