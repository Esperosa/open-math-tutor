import {
  ProviderError, validateBoardActions, isPlacement,
  type AnalyzeBoardRequest, type AnalyzeBoardResponse, type ContinueLessonRequest,
  type RecognizedStep,
} from '@openmathtutor/shared';

export function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export const text = (v: unknown, max = 500): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;
/** Like text(), but an empty string is valid — for genuinely optional fields (topic, task statement). */
export const optionalText = (v: unknown, max = 500): v is string =>
  typeof v === 'string' && v.length <= max;
export const revision = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) >= 0;
export const oneOf = (value: unknown, allowed: readonly string[]): value is string =>
  typeof value === 'string' && allowed.includes(value);

function steps(value: unknown, expected?: number): value is RecognizedStep[] {
  return Array.isArray(value) && value.length <= 100 && value.every(s =>
    record(s) && text(s.stepId, 128) && text(s.latexGuess, 300) && revision(s.boardRevision) &&
    (expected === undefined || s.boardRevision === expected));
}

export function validRequest(value: unknown, image: true): value is AnalyzeBoardRequest;
export function validRequest(value: unknown, image: false): value is ContinueLessonRequest;
export function validRequest(value: unknown, image: boolean): boolean {
  if (!record(value) || !text(value.requestId, 128) || !revision(value.boardRevision) ||
      !oneOf(value.locale, ['cs', 'en']) || !text(value.model, 128) ||
      !/^[a-zA-Z0-9][a-zA-Z0-9._:/-]*$/.test(value.model) || !record(value.task) ||
      // Topic and statement are genuinely optional: a student may just write
      // steps without first typing a restated problem or a topic label.
      !optionalText(value.task.topic, 100) || !steps(value.stepHistory)) return false;
  for (const key of ['statementText', 'statementLatex']) {
    if (value.task[key] !== undefined && !optionalText(value.task[key], 2000)) return false;
  }
  if (!image) {
    if (!oneOf(value.mode, ['check', 'hint', 'next_step', 'explain_differently', 'ask', 'next_problem'])) return false;
    if (value.studentMessage !== undefined && !text(value.studentMessage, 4000)) return false;
    if (value.learnerContext !== undefined && !text(value.learnerContext, 800)) return false;
    const curriculum = value.curriculumContext;
    if (curriculum !== undefined && (!record(curriculum) ||
        !text(curriculum.trackId, 128) || !text(curriculum.topicId, 128) || !text(curriculum.skillId, 128) ||
        !revision(curriculum.difficultyLevel))) return false;
    const chunks = value.retrievedContext;
    if (chunks !== undefined && (!Array.isArray(chunks) || chunks.length > 20 || !chunks.every(chunk =>
      record(chunk) && text(chunk.sourceId, 128) && text(chunk.sourceTitle, 500) &&
      revision(chunk.chunkIndex) && text(chunk.text, 8000)))) return false;
    return true;
  }
  const crop = value.imageCrop;
  return record(crop) && Number.isInteger(crop.width) && Number.isInteger(crop.height) &&
    (crop.width as number) > 0 && (crop.width as number) <= 4096 &&
    (crop.height as number) > 0 && (crop.height as number) <= 4096 &&
    text(crop.dataUrl, 6_000_000) &&
    /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(crop.dataUrl) &&
    crop.dataUrl.slice(crop.dataUrl.indexOf(',') + 1).length % 4 === 0;
}

/** The model only names existing steps and relative anchors. Absolute anchors
 * remain a saved-board compatibility format, never a provider capability. */
export function validateResponse(value: unknown, req: AnalyzeBoardRequest | ContinueLessonRequest): AnalyzeBoardResponse {
  const fail = () => { throw new ProviderError('invalid_response', 'Provider response failed schema, revision or board safety validation.'); };
  if (!record(value)) return fail();
  if (value.requestId !== req.requestId || value.boardRevision !== req.boardRevision ||
      !steps(value.recognizedSteps, req.boardRevision) ||
      typeof value.confidence !== 'number' || !Number.isFinite(value.confidence) || value.confidence < 0 || value.confidence > 1 ||
      !(value.firstErrorStepId === null || text(value.firstErrorStepId, 128)) ||
      !oneOf(value.verifierStatus, ['correct', 'incorrect', 'ambiguous', 'needs_domain_check']) ||
      !text(value.pedagogicalResponse, 4000) || typeof value.ttsText !== 'string' || value.ttsText.length > 4000 ||
      !(value.needsClarification === null || (record(value.needsClarification) && text(value.needsClarification.reason, 500)))) return fail();
  const result = validateBoardActions(value.boardActions, req.boardRevision,
    { minX: 0, minY: 0, maxX: 0, maxY: 0 });
  if (result.errors.length) return fail();
  const knownSteps = new Set(req.stepHistory.map(s => s.stepId));
  if (value.recognizedSteps.some(s => !knownSteps.has(s.stepId))) return fail();
  if (value.firstErrorStepId !== null && !knownSteps.has(value.firstErrorStepId as string)) return fail();
  if (new Set(result.valid.map(a => a.id)).size !== result.valid.length) return fail();
  for (const action of result.valid) {
    if (!text(action.id, 128) || 'anchor' in action || action.type === 'erase_own_annotation') return fail();
    if ('targetStepId' in action && (!knownSteps.has(action.targetStepId) ||
      (value.firstErrorStepId !== null && action.targetStepId !== value.firstErrorStepId))) return fail();
    const anchors = 'placement' in action ? [action.placement] : action.type === 'draw_arrow' ? [action.from, action.to] : [];
    if (anchors.some(p => !isPlacement(p) || !knownSteps.has(p.relativeToStepId) ||
      (value.firstErrorStepId !== null && p.relativeToStepId !== value.firstErrorStepId))) return fail();
  }
  return { requestId: req.requestId, boardRevision: req.boardRevision,
    recognizedSteps: value.recognizedSteps.map(({ stepId, latexGuess, boardRevision }) => ({ stepId, latexGuess, boardRevision })), confidence: value.confidence,
    firstErrorStepId: value.firstErrorStepId as string | null,
    verifierStatus: value.verifierStatus as AnalyzeBoardResponse['verifierStatus'],
    pedagogicalResponse: value.pedagogicalResponse, ttsText: value.ttsText,
    boardActions: result.valid, needsClarification: value.needsClarification as AnalyzeBoardResponse['needsClarification'] };
}
