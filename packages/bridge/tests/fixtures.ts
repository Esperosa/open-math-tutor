import type { AnalyzeBoardRequest, AnalyzeBoardResponse, ContinueLessonRequest } from '@openmathtutor/shared';

export const lesson: ContinueLessonRequest = {
  requestId: 'test-1', boardRevision: 2, mode: 'hint', task: { topic: 'arithmetic', statementText: '1+1' },
  stepHistory: [{ stepId: 's1', latexGuess: '1+1=2', boardRevision: 2 }], locale: 'en', model: 'sonnet',
};
export const analysis: AnalyzeBoardRequest = {
  ...lesson, imageCrop: { dataUrl: 'data:image/png;base64,aGVsbG8=', width: 10, height: 10 },
};
export const response: AnalyzeBoardResponse = {
  requestId: 'test-1', boardRevision: 2, recognizedSteps: lesson.stepHistory, confidence: 0.9,
  firstErrorStepId: null, verifierStatus: 'correct', pedagogicalResponse: 'Try counting.',
  ttsText: '', boardActions: [], needsClarification: null,
};
