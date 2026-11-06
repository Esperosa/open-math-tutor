import { describe, expect, it, vi } from 'vitest';
import * as shared from '@openmathtutor/shared';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { applyResponse, commitStudent, editTask, fingerprint, newBoard, removeAnnotation, renderableActions, stableMathCandidate } from './boardState';

export function element(id = 'line', text = '2x + 3 = 8', version = 1, y = 120): ExcalidrawElement {
  return { id, type: 'text', text, x: 120, y, width: 180, height: 32, angle: 0, version, versionNonce: version, isDeleted: false } as ExcalidrawElement;
}
function fixture() { return commitStudent(newBoard(), [element()]); }
function response(state = fixture(), actions: shared.BoardAction[] = []): shared.AnalyzeBoardResponse {
  return { requestId: 'req', boardRevision: state.revision, recognizedSteps: state.steps, confidence: 0.9,
    firstErrorStepId: state.steps[0].stepId, verifierStatus: 'incorrect', pedagogicalResponse: 'Odečti 3.', ttsText: 'Odečti tři.',
    needsClarification: null, boardActions: actions };
}
describe('board commits and stable steps', () => {
  it('increments for each committed edit, not selection/no-op, and preserves corrected step IDs', () => {
    const first = fixture();
    expect(first.revision).toBe(1);
    expect(commitStudent(first, [element()])).toBe(first);
    const corrected = commitStudent(first, [element('line', '2x = 5', 2)]);
    expect(corrected.revision).toBe(2);
    expect(corrected.steps[0].stepId).toBe(first.steps[0].stepId);
    expect(corrected.steps[0].latexGuess).toBe('2x = 5');
    expect(editTask(corrected, 'statement', '2x + 3 = 8').revision).toBe(3);
    expect(fingerprint([element()])).toBe(fingerprint([element(), { ...element(), id: 'omt-ai-1' }]));
  });
  it('does not alias Excalidraw mutable snapshots', () => {
    const input = element(); const state = commitStudent(newBoard(), [input]);
    Object.assign(input, { version: 9 });
    expect(state.elements[0].version).toBe(1);
  });
  it('groups handwriting geometrically and requires useful stable math candidates', () => {
    const a = { ...element('a', ''), type: 'freedraw', width: 25 } as ExcalidrawElement;
    const b = { ...a, id: 'b', x: 160 };
    const one = commitStudent(newBoard(), [a]); expect(stableMathCandidate(one)).toBe(false);
    const two = commitStudent(one, [a, b]); expect(two.steps).toHaveLength(1); expect(stableMathCandidate(two)).toBe(true);
    expect(stableMathCandidate(commitStudent(newBoard(), [element('t', '2x =')]))).toBe(false);
    expect(stableMathCandidate(fixture())).toBe(true);
  });
});
describe('shared validation is the annotation trust boundary', () => {
  it('rejects stale requests, including request ID mismatch, without changing history', () => {
    const state = fixture();
    expect(applyResponse(state, { ...response(state), boardRevision: 0 }, 'req')).toMatchObject({ state, stale: true });
    expect(applyResponse(state, response(state), 'different')).toMatchObject({ state, stale: true });
  });
  it('calls the published validator and drops stale, out-of-bounds, unknown and oversized actions', () => {
    const spy = vi.spyOn(shared, 'validateBoardActions'); const state = fixture();
    const valid: shared.BoardAction = { id: 'good', boardRevision: 1, type: 'write_math', latex: 'x=2', anchor: { x: 100, y: 150 } };
    const malformed = [valid, { ...valid, id: 'stale', boardRevision: 0 }, { ...valid, id: 'far', anchor: { x: 1e9, y: 0 } },
      { ...valid, id: 'long', latex: 'a'.repeat(301) }, { ...valid, id: 'bad', type: 'script' }] as shared.BoardAction[];
    const applied = applyResponse(state, response(state, malformed), 'req');
    expect(spy).toHaveBeenCalled(); expect(applied.stale).toBe(true); expect(applied.rejected).toBe(true);
    expect(applied.state.annotations.map(a => a.id)).toEqual(['good']);
    expect(renderableActions(applied.state)).toHaveLength(1); spy.mockRestore();
  });
  it('renders only the first causal target, never subsequent erroneous steps', () => {
    const state = commitStudent(newBoard(), [element(), element('second', 'x=4', 1, 220)]);
    const actions: shared.BoardAction[] = state.steps.map((s, i) => ({ id: `mark-${i}`, boardRevision: 1, type: 'circle', targetStepId: s.stepId }));
    const result = applyResponse(state, response(state, actions), 'req');
    expect(result.state.annotations.map(a => a.id)).toEqual(['mark-0']);
    expect(result.rejected).toBe(true);
  });
  it('AI batch/undo increments once; erasure and individual undo never remove student elements', () => {
    const state = fixture(); const actions: shared.BoardAction[] = [
      { id: 'one', type: 'underline', targetStepId: state.steps[0].stepId, boardRevision: 1 },
      { id: 'two', type: 'write_math', latex: 'x=2', anchor: { x: 120, y: 180 }, boardRevision: 1 },
    ];
    const annotated = applyResponse(state, response(state, actions), 'req').state;
    expect(annotated.revision).toBe(2);
    const erased = applyResponse(annotated, response(annotated, [
      { id: 'erase', type: 'erase_own_annotation', targetAnnotationId: 'one', boardRevision: 2 },
      { id: 'student-erasure', type: 'erase_own_annotation', targetAnnotationId: 'line', boardRevision: 2 },
    ]), 'req').state;
    expect(erased.revision).toBe(3); expect(erased.annotations.map(a => a.id)).toEqual(['two']);
    const undone = removeAnnotation(erased, 'two');
    expect(undone.revision).toBe(4); expect(undone.annotations).toEqual([]); expect(undone.elements).toEqual(state.elements);
  });
  it('clears old annotations on a correction but keeps explanation history', () => {
    const state = fixture();
    const annotated = applyResponse(state, response(state, [{ id: 'a', type: 'circle', targetStepId: state.steps[0].stepId, boardRevision: 1 }]), 'req').state;
    const corrected = commitStudent(annotated, [element('line', 'x=2', 2)]);
    expect(corrected.annotations).toEqual([]); expect(corrected.history).toHaveLength(1);
  });
  it('revalidates accumulated batches without applying the per-response cap to the entire layer', () => {
    let state = fixture();
    for (let batch = 0; batch < 2; batch++) {
      const actions: shared.BoardAction[] = Array.from({ length: 8 }, (_, i) => ({
        id: `${batch}-${i}`, type: 'write_text', text: 'hint', anchor: { x: 120, y: 180 }, boardRevision: state.revision,
      }));
      state = applyResponse(state, response(state, actions), 'req').state;
    }
    expect(state.annotations).toHaveLength(16); expect(renderableActions(state)).toHaveLength(16);
  });
  it('invalidates OCR after changed handwriting even when the element IDs stay the same', () => {
    const ink = { ...element('ink', ''), type: 'freedraw' } as ExcalidrawElement;
    let state = commitStudent(newBoard(), [ink]);
    state = { ...state, steps: state.steps.map(s => ({ ...s, latexGuess: 'x=4' })) };
    const corrected = commitStudent(state, [{ ...ink, version: 2, versionNonce: 2 }]);
    expect(corrected.steps[0].latexGuess).toBe('');
    expect(corrected.steps[0].stepId).toBe(state.steps[0].stepId);
  });
  it('retains asynchronous file-only updates without inventing a board edit', () => {
    const state = fixture(); const files = {};
    const next = commitStudent(state, state.elements, files);
    expect(next.files).toBe(files); expect(next.revision).toBe(state.revision);
  });
});
