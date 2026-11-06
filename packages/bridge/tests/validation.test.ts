import { describe, expect, it } from 'vitest';
import { validRequest, validateResponse } from '../src/validation.js';
import { lesson, analysis, response } from './fixtures.js';

describe('untrusted request validation', () => {
  it('accepts the shared contracts', () => {
    expect(validRequest(lesson, false)).toBe(true); expect(validRequest(analysis, true)).toBe(true);
  });
  it.each([
    null, {}, { ...lesson, boardRevision: -1 }, { ...lesson, boardRevision: 1.1 },
    { ...lesson, locale: 'xx' }, { ...lesson, model: '--system-prompt=bad' },
    { ...lesson, locale: ['en'] }, { ...lesson, mode: ['hint'] },
    { ...lesson, mode: 'exec' }, { ...lesson, task: { topic: '' } },
    { ...lesson, stepHistory: [{ stepId: 'x', latexGuess: 'x', boardRevision: NaN }] },
    { ...lesson, stepHistory: Array(101).fill(lesson.stepHistory[0]) },
  ])('rejects malformed text request %#', value => expect(validRequest(value, false)).toBe(false));
  it.each([
    {}, { dataUrl: 'file:///secret.png', width: 10, height: 10 },
    { dataUrl: 'data:image/svg+xml;base64,PHN2Zz4=', width: 10, height: 10 },
    { dataUrl: 'data:image/png;base64,aGVsbG8=', width: 0, height: 10 },
    { dataUrl: 'data:image/png;base64,aGVsbG8=', width: 10, height: 5000 },
  ])('rejects invalid image crops %#', imageCrop => expect(validRequest({ ...analysis, imageCrop }, true)).toBe(false));
});

describe('model response safety boundary', () => {
  it('accepts validated responses and step-targeted shared actions', () => {
    expect(validateResponse(response, lesson)).toEqual(response);
    const value = { ...response, boardActions: [{ id: 'a', boardRevision: 2, type: 'circle', targetStepId: 's1' }] };
    expect(validateResponse(value, lesson).boardActions).toEqual(value.boardActions);
  });
  it.each([
    null, {}, { ...response, requestId: 'other' }, { ...response, boardRevision: 1 },
    { ...response, confidence: Infinity }, { ...response, confidence: 1.1 },
    { ...response, verifierStatus: 'executed' }, { ...response, needsClarification: {} },
    { ...response, verifierStatus: ['correct'] },
    { ...response, boardActions: [{ id: 'a', type: 'circle', targetStepId: 's1', boardRevision: 2, style: { emphasis: ['high'] } }] },
    { ...response, firstErrorStepId: 'unknown' },
    { ...response, recognizedSteps: [{ stepId: 's1', latexGuess: 'x', boardRevision: 1 }] },
    { ...response, boardActions: [{ id: 'a', type: 'write_text', text: 'x', anchor: { x: 0, y: 0 }, boardRevision: 2 }] },
    { ...response, boardActions: [{ id: 'a', type: 'circle', targetStepId: 's1', boardRevision: 1 }] },
    { ...response, boardActions: [{ id: 'a', type: 'circle', targetStepId: 'unknown', boardRevision: 2 }] },
    { ...response, boardActions: [{ id: 'a', type: 'circle', targetStepId: 's1', boardRevision: 2, style: { color: 'url(javascript:x)' } }] },
    { ...response, boardActions: [{ id: 'a', type: 'circle', targetStepId: 's1', boardRevision: 2, code: 'untrusted' }] },
    { ...response, boardActions: Array(13).fill({ id: 'a', type: 'circle', targetStepId: 's1', boardRevision: 2 }) },
  ])('rejects invalid/stale/unbounded provider output %#', value => {
    expect(() => validateResponse(value, lesson)).toThrowError(expect.objectContaining({ code: 'invalid_response' }));
  });
});
