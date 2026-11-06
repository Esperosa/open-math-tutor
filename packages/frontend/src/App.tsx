import katex from 'katex';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { BoardAction, ContinueLessonRequest, ExpectedAnswer, ProviderId } from '@openmathtutor/shared';
import {
  recordAttempt, retrieveTopChunks, isMastered, instantiateProblem, expectedAnswerFor, statementHasSymbols,
  looksLikeFinalLine, nextCoachEvent, coachLine, stepKey, recordError, recordSolved, chooseStyle, recordStyleShown,
  resolveStyleOutcome, profileSummary, generateTest, topicMastered, getTopicSkills, nextUnlockedTopic, nextUnlockedSkill, pickTemplateForDifficulty,
  type CoachEvent, confirmCoachFinal, type ExplainStyle, type LearnerProfile,
} from '@openmathtutor/shared';
import { catalog } from '@openmathtutor/content';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { Board, type BoardHandle } from './Board';
import { applyResponse, commitStudent, correctInk, editTask, fingerprint, newBoard, removeAnnotation, stableMathCandidate, type BoardState } from './boardState';
import { createHandwritingRecognizer } from './handwriting';
import { bridge, BridgeError, type ProviderEntry } from './api';
import { messages, errorKeys, type MessageKey } from './i18n';
import { BOARD_PATTERNS, DEFAULT_TOOLS, load, save, type Saved, type Settings } from './storage';
import { StrokeSettler } from './settle';
import { useMic, useVoice } from './useVoice';
import { cancelPiperSpeech } from './piperTts';
import { downloadPercent, estimateBytes, formatSize } from './piperVoices';
import { loadProfile, saveProfile } from './profileStorage';
import { localTeacherActions } from './localTeacher';
import { computeLineVerdicts, effectiveStatement, markPerStep, writtenLines } from './lines';
import { TutorHud, type TutorChoice, type TutorMessage } from './TutorHud';
import { useBoardActivity } from './activity';
import { useSettledValue } from './settled';
import { useChat } from './chat/useChat';
import { conversationTail } from './chat/chatStore';
import { chatMessages } from './chat/messages';
import { answerFaq, faqById } from './chat/faq';
import { CHIP_FAQ, CHIP_LABEL, quickReplies, type ChipId } from './chat/replies';
import { COACH_MIN_DELAY_MS, REQUEST_SLOW_MS, REQUEST_TIMEOUT_MS } from './pacing';
import { loadMastery, saveMastery, getOrCreateMastery } from './curriculumStorage';
import { CoursesPanel, type LessonStart } from './curriculum/CoursesPanel';
import { Onboarding, type StartLevel } from './curriculum/Onboarding';
import { TrackBreadcrumb } from './curriculum/TrackBreadcrumb';
import { Rail, Icon, type PanelId } from './Hud';
import { Calculator } from './Calculator';
import { NotesPanel } from './NotesPanel';
import { PlanPanel } from './PlanPanel';
import { buildTestHtml } from './testSheet';
import type { TutorMood } from './Tutor';
import { Credit } from './Credit';
import { buildNotesHtml, buildNotesMarkdown, downloadBlob, printHtml, studyTextRequest, summarizeStrengths } from './notes';
import { AskPanel } from './AskPanel';
import { UploadBoard, type UploadedImage } from './UploadBoard';
import { CustomSourcesPanel } from './CustomSourcesPanel';
import { loadSources, saveSources, addSource, removeSource, allChunks } from './customSources';

type Mode = ContinueLessonRequest['mode'];
type ContinueLessonExtra = Pick<ContinueLessonRequest, 'studentMessage' | 'curriculumContext' | 'retrievedContext' | 'learnerContext' | 'conversation'>;
const hashKey = (key: string) => [...key].reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 7);
/** Bounded, untrusted local recognizer hints; the image crop stays the primary source. */
function inkHints(steps: readonly BoardState['steps'][number][]) {
  return steps.filter(step => step.origin === 'ink' && step.latexGuess.trim() && step.symbols?.length)
    .slice(-40).map(step => ({
      stepId: step.stepId, text: step.latexGuess, confidence: step.confidence ?? 0, bbox: step.box,
      symbols: (step.symbols ?? []).slice(0, 300).map((symbol, index) => ({
        index, label: symbol.label ?? symbol.candidates[0]?.label ?? '?',
        candidates: symbol.candidates.slice(0, 5).map(candidate => ({ label: candidate.label, probability: candidate.probability })),
        strokeOrder: symbol.strokeOrder.slice(0, 300), bbox: symbol.bbox, uncertain: symbol.uncertain,
      })),
    }));
}
const STYLE_MODE: Record<ExplainStyle, Mode> = { hint: 'hint', worked: 'next_step', analogy: 'explain_differently', visual: 'explain_differently' };
interface Pending { id: string; controller: AbortController; provider: ProviderId; boardId: string; revision: number; /** A chat answer: the student writing on the board does not make it obsolete. */ keep: boolean }
function providerStatusLabel(p: ProviderEntry, t: Record<MessageKey, string>): string {
  if (!p.detect.installed) { return " - " + t.providerMissing }
  if (!p.authStatus.authenticated) {
    if (p.id === 'google' && p.authStatus.keyPresent === false) { return " - " + t.googleKeyMissing }
    return " - " + t.authMissing;
  }
  if (!p.authStatus.tutoringAvailable) { return " - " + t.providerLimited }
  return "";
}


function renderMathStatement(raw: string): string | null {
  if (!raw) return null;
  if (!/[/^=<>≤≥·]/.test(raw) && !/lim/i.test(raw)) return null;

  let prefix = '';
  let math = raw;

  const colonIdx = raw.indexOf(':');
  if (colonIdx !== -1 && /[a-zA-Z\u00C0-\u024F]/.test(raw.slice(0, colonIdx))) {
    prefix = raw.slice(0, colonIdx + 1) + ' ';
    math = raw.slice(colonIdx + 1).trim();
  } else {
    const wordPrefixMatch = /^([A-ZÁČĎÉĚÍŇÓŘŠŤÚŮÝŽa-záčďéěíňóřšťúůýž\s]+?)\s+([0-9a-zA-Z(].*)$/.exec(raw);
    if (wordPrefixMatch && !/[=<>+\-*/^]/.test(wordPrefixMatch[1])) {
      prefix = wordPrefixMatch[1] + ' ';
      math = wordPrefixMatch[2];
    }
  }

  let suffix = '';
  if (math.endsWith('.')) {
    suffix = '.';
    math = math.slice(0, -1);
  }

  let latex = math.trim();
  latex = latex.replace(/lim\s*\(([a-z]+)\s*(?:→|->)\s*(?:∞|\\infty)\)/gi, '\\lim_{$1 \\to \\infty}');
  latex = latex.replace(/\(([^)]+)\)\/\(([^)]+)\)/g, '\\frac{$1}{$2}');
  latex = latex.replace(/\(([^)]+)\)\/([0-9a-zA-Z]+)/g, '\\frac{$1}{$2}');
  latex = latex.replace(/([0-9a-zA-Z]+)\/\(([^)]+)\)/g, '\\frac{$1}{$2}');
  latex = latex.replace(/(\b[0-9a-zA-Z]+)\/(\b[0-9a-zA-Z]+)/g, '\\frac{$1}{$2}');
  latex = latex.replace(/\*/g, ' \\cdot ');

  try {
    const rendered = katex.renderToString(latex, { throwOnError: false, displayMode: false, strict: 'ignore' });
    return (prefix ? `${prefix}` : '') + rendered + suffix;
  } catch {
    return null;
  }
}

export function App() {
  const [saved, setSaved] = useState<Saved>(load);
  const live = useRef(saved); live.current = saved;
  const board = saved.boards.find(b => b.id === saved.activeId)!;
  const settings = saved.settings;
  const t = messages[settings.locale];
  const editor = useRef<BoardHandle>(null);
  const recognizers = useRef(new Map<string, ReturnType<typeof createHandwritingRecognizer>>());
  const recognizerFor = (boardId: string) => {
    const existing = recognizers.current.get(boardId);
    if (existing) return existing;
    const created = createHandwritingRecognizer();
    recognizers.current.set(boardId, created);
    if (recognizers.current.size > 20) recognizers.current.delete(recognizers.current.keys().next().value!);
    return created;
  };
  const pending = useRef<Pending | null>(null);
  const busy = useRef(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<MessageKey>('idle');
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [verifierOK, setVerifierOK] = useState(true);
  const [retry, setRetry] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [rejected, setRejected] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [pinned, setPinned] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [calcOpen, setCalcOpen] = useState(false);
  const [message, setMessage] = useState<TutorMessage | null>(() => ({ id: 'welcome', kind: 'info', text: t.taskEmpty }));
  const [tutorMenu, setTutorMenu] = useState(false);

  const [bridgeChecked, setBridgeChecked] = useState(false);
  const [testNotice, setTestNotice] = useState('');
  const [editingTask, setEditingTask] = useState(false);
  const [happy, setHappy] = useState(false);
  const { activity, phase } = useBoardActivity();
  const [chatOpen, setChatOpen] = useState(false);
  const [chatLarge, setChatLarge] = useState(false);
  const [slow, setSlow] = useState(false);
  const [coachTick, setCoachTick] = useState(0);
  const [aiAnswerId, setAiAnswerId] = useState('');
  const chat = useChat(saved.activeId, saved.boards.map(b => b.id));
  const [profile, setProfileState] = useState<LearnerProfile>(loadProfile);
  const profileRef = useRef(profile); profileRef.current = profile;
  const stepErrors = useRef<Map<string, number>>(new Map());
  const resetting = useRef(false);
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => () => { clearTimeout(hoverTimer.current); clearTimeout(leaveTimer.current); }, []);
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const lines = useMemo(() => writtenLines(board.steps), [board.steps]);
  const statement = useMemo(() => effectiveStatement(board.statement, lines), [board.statement, lines]);
  const formattedTaskHtml = useMemo(() => renderMathStatement(statement), [statement]);
  const displayTopic = useMemo(() => {
    const tp = (board.skillId ? catalog.topics.find(t => t.skillIds.includes(board.skillId!)) : undefined)
      ?? catalog.topics.find(t => t.id === board.topic || t.title.cs === board.topic || t.title.en === board.topic);
    return tp ? tp.title[settings.locale] : board.topic;
  }, [board.skillId, board.topic, settings.locale]);

  const verdicts = useMemo(() => {
    if (settings.coachMode === 'off') return {};
    const symbols = statementHasSymbols(statement);
    if (settings.coachMode === 'final' && !lines.some(l => looksLikeFinalLine(l.latexGuess, symbols))) return {};
    return markPerStep(computeLineVerdicts(statement, lines, board.expected ?? expectedAnswerFor(statement), board.confirmedFinals), lines);
  }, [statement, lines, board.expected, board.confirmedFinals, settings.coachMode]);
  const shownVerdicts = useSettledValue(verdicts, activity, board.id);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest('.rail, .drawer, .settings-pop, .icon-btn, .tutor-hud, .calculator')) return;
      setPanel(null); setPinned(false); setSettingsOpen(false); setTutorMenu(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !busy.current && !(e.target instanceof Element && e.target.closest('.excalidraw textarea, .excalidraw [contenteditable="true"]'))) { setPanel(null); setPinned(false); setSettingsOpen(false); setCalcOpen(false); setTutorMenu(false); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setPanel('courses'); setPinned(true);
        setTimeout(() => document.getElementById('course-search')?.focus(), 50);
      }
    };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc, true);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc, true); };
  }, []);
  const voice = useVoice(settings, uri => configure({ voiceURI: uri }));
  const mic = useMic(settings.locale);
  const [settler] = useState(() => new StrokeSettler(() => void analyze.current()));
  const analyze = useRef<() => Promise<void>>(async () => {});
  const [mastery, setMastery] = useState(loadMastery);
  const masteryRef = useRef(mastery); masteryRef.current = mastery;
  const strengths = useMemo(() => summarizeStrengths(catalog, mastery, settings.locale), [mastery, settings.locale]);
  const [lessonSkillId, setLessonSkillId] = useState<string | null>(null);
  const [sources, setSources] = useState(loadSources);
  const locateStep = useCallback((id: string) => editor.current?.stepViewportRect(id) ?? null, []);
  const locateObstacles = useCallback(() => editor.current?.contentViewportRects() ?? [], []);
  const provider = providers.find(p => p.id === settings.provider);
  const model = provider?.models.find(m => m.id === settings.model);
  const canRequest = connected && !!provider?.detect.installed && !!provider.authStatus.authenticated && !!model;

  const updateBoard = useCallback((next: BoardState) => {
    const current = live.current;
    const value = { ...current, boards: current.boards.map(b => b.id === next.id ? next : b) };
    live.current = value; setSaved(value);
  }, []);
  function configure(patch: Partial<Settings>) {
    stop(false); settler.cancel();
    const value = { ...live.current, settings: { ...live.current.settings, ...patch } };
    live.current = value; setSaved(value);
  }
  const stop = useCallback((notify = true) => {
    settler.cancel();
    const request = pending.current;
    pending.current = null;
    request?.controller.abort();
    if (request) void bridge.cancel(request.provider, request.id, AbortSignal.timeout(5000)).catch(() => {});
    cancelPiperSpeech();
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    setRunning(false);
    if (notify) setStatus('cancelled');
  }, [settler]);
  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    setConnected(false);
    void Promise.all([bridge.providers(controller.signal), bridge.health(controller.signal)]).then(([entries, health]) => {
      setProviders(entries); setConnected(true); setVerifierOK(health.verifier === 'ok');
      setStatus('ready');
      // Zero-config default: if nothing was chosen yet, pick the first provider
      // that's actually installed, logged in, able to tutor right now (not
      // just logged in — a provider can be fully authenticated and still be
      // fail-closed for every request), and has models. Never override a
      // provider the person already picked themselves.
      const chosen = entries.find(p => p.id === live.current.settings.provider);
      // A saved provider that can never tutor (e.g. fail-closed Codex) is replaced by one that can.
      if (!live.current.settings.provider || (chosen && !chosen.authStatus.tutoringAvailable && entries.some(p => p.detect.installed && p.authStatus.authenticated && p.authStatus.tutoringAvailable && p.models.length > 0))) {
        const tutorReady = entries.filter(p => p.detect.installed && p.authStatus.authenticated && p.authStatus.tutoringAvailable && p.models.length > 0);
        const ready = tutorReady.find(p => p.id === 'claude') ?? tutorReady.find(p => p.id === 'google') ?? tutorReady[0];
        if (ready) {
          const value = { ...live.current, settings: { ...live.current.settings, provider: ready.id, model: ready.models[0]!.id } };
          live.current = value; setSaved(value);
        }
      }
    }).catch(() => { if (!controller.signal.aborted) setStatus('bridgeUnavailable'); })
      .finally(() => { clearTimeout(timeout); setBridgeChecked(true); });
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const timer = setTimeout(() => { if (!resetting.current) setSaveError(!save(saved)); }, 350);
    return () => clearTimeout(timer);
  }, [saved]);
  useEffect(() => {
    const flush = () => { if (!resetting.current) save(live.current); };
    window.addEventListener('pagehide', flush);
    return () => window.removeEventListener('pagehide', flush);
  }, []);
  useEffect(() => { document.documentElement.lang = settings.locale; document.documentElement.dataset.theme = settings.theme; }, [settings.locale, settings.theme]);
  useEffect(() => () => { settler.cancel(); pending.current?.controller.abort(); }, [settler]);

  async function request(
    mode?: Mode,
    extra?: ContinueLessonExtra,
    imageOverride?: UploadedImage,
  ) {
    // An explicit ask (button, chip, chat) is never blocked by an open text editor; only the automatic image analysis waits for the pen.
    if (!canRequest || (busy.current && !mode) || (!mode && !imageOverride && !model?.supportsImageInput)) return;
    stop(false);
    const snapshot = live.current.boards.find(b => b.id === live.current.activeId)!;
    const controller = new AbortController();
    const id = crypto.randomUUID();
    const request: Pending = { id, controller, provider: settings.provider as ProviderId, boardId: snapshot.id, revision: snapshot.revision, keep: mode === 'ask' };
    pending.current = request; setRunning(true); setStatus(mode === 'ask' ? 'thinkingAnswer' : 'thinking'); setRejected(false);
    const timer = setTimeout(() => { controller.abort(); void bridge.cancel(request.provider, id, AbortSignal.timeout(5000)).catch(() => {}); }, REQUEST_TIMEOUT_MS);
    const slowTimer = setTimeout(() => { if (pending.current === request) setSlow(true); }, REQUEST_SLOW_MS);
    const hints = inkHints(snapshot.steps);
    const base = { requestId: id, boardRevision: snapshot.revision,
      // Keep the request inside the bridge's limits: no empty lines, bounded lengths and counts.
      task: { statementText: snapshot.statement.slice(0, 2000), topic: snapshot.topic.slice(0, 100) },
      stepHistory: [...writtenLines(snapshot.steps), ...snapshot.steps.filter(s => !s.latexGuess.trim()).map(s => ({ stepId: s.stepId, latexGuess: '?' }))].slice(-100)
        .map(({ stepId, latexGuess }) => ({ stepId, latexGuess: latexGuess.trim().slice(0, 300), boardRevision: snapshot.revision })),
      locale: settings.locale, model: settings.model, ...(hints.length ? { handwriting: hints } : {}) };
    try {
      let imageCrop: { dataUrl: string; width: number; height: number } | undefined;
      try {
        imageCrop = imageOverride ?? (model?.supportsImageInput
          ? await editor.current?.crop(snapshot, snapshot.activeStepId ?? undefined) : undefined);
      } catch { imageCrop = undefined; }
      if (pending.current !== request || controller.signal.aborted) return;
      const response = mode ? await bridge.continue(request.provider, { ...base, mode, ...extra,
        ...(imageCrop && model?.supportsImageInput ? { imageCrop } : {}) }, controller.signal)
        : await bridge.analyze(request.provider, { ...base, imageCrop: imageCrop! }, controller.signal);
      if (pending.current !== request) return;
      const current = live.current.boards.find(b => b.id === request.boardId);
      // A pen stroke in progress makes the answer obsolete; an open text editor does not. A chat answer survives any board change.
      if (!current || live.current.activeId !== request.boardId || (activity.penDown && !request.keep)) {
        if (request.keep) chat.add(request.boardId, 'tutor', response.pedagogicalResponse, id);
        setStatus('waiting'); return;
      }
      const applied = applyResponse(current, response, id);
      if (applied.state !== current) updateBoard(applied.state);
      setStatus(applied.stale ? 'waiting' : 'ready'); setRejected(applied.rejected);
      if (!applied.stale && mode === 'check' && current.skillId && !current.outcome && (response.verifierStatus === 'correct' || response.verifierStatus === 'incorrect')) {
        const wasCorrect = response.verifierStatus === 'correct';
        recordMastery(current.skillId, wasCorrect);
        updateBoard({ ...applied.state, outcome: wasCorrect ? 'solved' : 'failed' });
      }
      if (!applied.stale || request.keep) {
        setAiAnswerId(id);
        setMessage({ id: id, kind: response.verifierStatus === 'correct' ? 'solved' : 'info', text: response.pedagogicalResponse,
          ...(!applied.stale ? { stepId: response.firstErrorStepId ?? (mode === 'ask' ? undefined : snapshot.activeStepId ?? undefined) } : {}) });
        voice.speak(response.ttsText);
      }
    } catch (error) {
      if (pending.current !== request) return;
      if (controller.signal.aborted) setStatus('timeout');
      else if (error instanceof BridgeError) {
        setStatus(error.code === 'bridgeUnavailable' || error.code === 'invalidRequest' ? error.code : errorKeys[error.code]);
        if (error.code === 'bridgeUnavailable') setConnected(false);
      } else setStatus('unknown');
    } finally {
      clearTimeout(timer); clearTimeout(slowTimer); setSlow(false);
      if (pending.current === request) { pending.current = null; setRunning(false); }
    }
  }
  analyze.current = () => request();
  function schedule(next: BoardState) {
    settler.update(`${next.id}:${fingerprint(next.elements)}`, live.current.settings.auto && canRequest && !!model?.supportsImageInput && !busy.current && stableMathCandidate(next));
  }
  function commit(elements: readonly ExcalidrawElement[], files: BinaryFiles) {
    const current = live.current.boards.find(b => b.id === live.current.activeId)!;
    const recognizer = recognizerFor(current.id);
    const next = commitStudent(current, elements, files, els => recognizer.recognize(els));
    if (next.revision === current.revision) { if (next !== current) updateBoard(next); return; }
    boardEdited(); setStatus('waiting'); updateBoard(next); schedule(next);
  }
  /** The student changed the board: outdated checks are dropped, a chat answer is not. */
  function boardEdited() { if (!pending.current?.keep) stop(false); else settler.cancel(); }
  function boardBusy(value: boolean) {
    busy.current = value;
    if (value) {
      boardEdited(); setStatus('waiting');
      // The free-board welcome has done its job once writing starts. Lesson
      // guidance stays available while the student copies the given data.
      setMessage(m => m?.id === 'welcome' ? null : m);
    }
    else { schedule(live.current.boards.find(b => b.id === live.current.activeId)!); setCoachTick(n => n + 1); }
  }
  function inkCorrection(key: string, label: string) {
    const current = live.current.boards.find(b => b.id === live.current.activeId)!;
    const next = correctInk(current, key, label);
    if (next === current) return;
    stop(false); setStatus('waiting'); updateBoard(next); schedule(next);
  }
  function switchExercise(id: string) {
    stop(false); setMessage(null); setTutorMenu(false);
    const value = { ...live.current, activeId: id }; live.current = value; setSaved(value); setStatus('idle');
  }
  function openOnly(which: 'settings' | 'calc' | 'tutor') {
    setPanel(null); setPinned(false);
    setSettingsOpen(o => which === 'settings' ? !o : false);
    setCalcOpen(o => which === 'calc' ? !o : false);
    setTutorMenu(o => which === 'tutor' ? !o : false);
  }
  function hoverPanel(id: PanelId) {
    clearTimeout(leaveTimer.current); clearTimeout(hoverTimer.current);
    if (!pinned) hoverTimer.current = setTimeout(() => { setCalcOpen(false); setSettingsOpen(false); setTutorMenu(false); setPanel(id); }, 220);
  }
  function togglePanel(id: PanelId) {
    clearTimeout(hoverTimer.current);
    setCalcOpen(false); setSettingsOpen(false); setTutorMenu(false);
    if (panel === id && pinned) { setPanel(null); setPinned(false); } else { setPanel(id); setPinned(true); }
  }
  function leavePanel() {
    clearTimeout(hoverTimer.current);
    if (!pinned) leaveTimer.current = setTimeout(() => setPanel(null), 450);
  }
  function createExercise() {
    stop(false); setLessonSkillId(null); setMessage(null); const next = newBoard();
    const value = { ...live.current, boards: [...live.current.boards, next], activeId: next.id };
    live.current = value; setSaved(value); setStatus('idle');
  }
  function startLesson(lesson: LessonStart) {
    // A new lesson is a new problem, not an edit of the current one — reusing
    // the active board here left the previous problem's handwriting and
    // explanation history visible underneath the new statement.
    stop(false); setPanel(null); setPinned(false);
    const next: BoardState = { ...newBoard(), topic: lesson.topic, statement: lesson.statementText, skillId: lesson.skillId, ...(lesson.expected ? { expected: lesson.expected } : {}) };
    setMessage(null);
    const value = { ...live.current, boards: [...live.current.boards, next], activeId: next.id };
    live.current = value; setSaved(value);
    if (lesson.curriculumContext.trackId && lesson.curriculumContext.trackId !== live.current.settings.activeTrackId) configure({ activeTrackId: lesson.curriculumContext.trackId, onboardingDismissed: true });
    setLessonSkillId(lesson.skillId);
    setStatus('idle');
    const skill = catalog.skills.find(sk => sk.id === lesson.skillId);
    const intro = lesson.expected ? t.lessonStart : skill?.drawing ? t.lessonDrawing : (canRequest && live.current.settings.auto ? t.lessonAiChecked : t.lessonUnchecked);
    const greeting = intro.replace('{skill}', skill?.title[settings.locale] ?? lesson.topic);
    setMessage({ id: `lesson-${next.id}`, kind: 'info', text: greeting });
    voice.speak(greeting);
  }
  function startNext(trackId: string, level: number) {
    const masteredIds = new Set(Object.values(mastery).filter(isMastered).map(s => s.skillId));
    const topic = nextUnlockedTopic(catalog, trackId, masteredIds);
    const skill = topic ? nextUnlockedSkill(getTopicSkills(catalog, topic.id), masteredIds) : null;
    if (!topic || !skill) { createExercise(); return; }
    const difficultyLevel = mastery[skill.id]?.difficultyLevel ?? level;
    const previous = live.current.boards.find(b => b.id === live.current.activeId)?.statement;
    let template = pickTemplateForDifficulty(catalog, skill.id, difficultyLevel);
    if (!template) return;
    let problem = instantiateProblem(template);
    for (let i = 0; i < 8 && problem.statement === previous; i++) {
      template = pickTemplateForDifficulty(catalog, skill.id, i < 4 ? difficultyLevel : 0) ?? template;
      problem = instantiateProblem(template);
    }
    startLesson({
      skillId: skill.id, statementText: problem.statement, topic: topic.title[settings.locale],
      ...(problem.expected ? { expected: problem.expected } : {}),
      curriculumContext: { trackId, topicId: topic.id, skillId: skill.id, difficultyLevel: template.difficultyLevel },
    });
  }
  function startTrack(trackId: string, level: StartLevel = 1) {
    configure({ activeTrackId: trackId, onboardingDismissed: true, startLevel: level });
    startNext(trackId, level);
  }
  function startSkill(topicId: string, skillId: string) {
    const topic = catalog.topics.find(tp => tp.id === topicId);
    const skill = catalog.skills.find(sk => sk.id === skillId);
    if (!topic || !skill) return;
    const trackId = settings.activeTrackId || catalog.tracks.find(tr => tr.topicIds.includes(topicId))?.id || '';
    let template = pickTemplateForDifficulty(catalog, skillId, mastery[skillId]?.difficultyLevel ?? settings.startLevel);
    if (!template) return;
    let problem = instantiateProblem(template);
    const previous = live.current.boards.find(b => b.id === live.current.activeId)?.statement;
    if (problem.statement === previous) {
      // Resample, then try the skill's other templates, so "next problem" is never the same task again.
      const others = catalog.problemTemplates.filter(tp => tp.skillId === skillId);
      for (let i = 0; i < 6 && problem.statement === previous; i++) problem = instantiateProblem(template);
      for (const other of others) {
        if (problem.statement !== previous) break;
        const candidate = instantiateProblem(other);
        if (candidate.statement !== previous) { template = other; problem = candidate; }
      }
      if (problem.statement === previous) {
        // The skill has no more variety: move on to a sibling skill of the topic instead of repeating.
        const sibling = topic.skillIds.map(id => catalog.skills.find(sk => sk.id === id))
          .find(sk => sk && sk.id !== skillId && sk.problemTemplateIds.length && instantiateProblem(catalog.problemTemplates.find(tp => tp.id === sk.problemTemplateIds[0])!).statement !== previous);
        if (sibling) { startSkill(topicId, sibling.id); return; }
      }
    }
    setPanel(null); setPinned(false);
    startLesson({
      skillId, statementText: problem.statement, topic: topic.title[settings.locale], ...(problem.expected ? { expected: problem.expected } : {}),
      curriculumContext: { trackId, topicId, skillId, difficultyLevel: template.difficultyLevel },
    });
  }
  function buildTest(scope: { topicId?: string }, mode: 'print' | 'download') {
    const trackId = settings.activeTrackId;
    if (!trackId) return;
    const test = generateTest(catalog, { trackId, ...scope }, 2, Math.random, settings.locale);
    const trackTitle = catalog.tracks.find(tr => tr.id === trackId)?.title[settings.locale] ?? '';
    const topicTitle = scope.topicId ? catalog.topics.find(tp => tp.id === scope.topicId)?.title[settings.locale] : undefined;
    const html = buildTestHtml(test, `${t.testTitle}: ${topicTitle ?? trackTitle}`, t, settings.locale);
    if (mode === 'print') printHtml(html); else downloadBlob(new Blob([html], { type: 'text/html' }), 'test.html');
    setMessage({ id: `test-${Date.now()}`, kind: 'info', text: t.testReady });
    setTestNotice(`${t.testReady} (${test.items.length})`);
  }
  function nextProblem() {
    const skillId = board.skillId;
    const topic = skillId ? catalog.topics.find(tp => tp.skillIds.includes(skillId)) : undefined;
    if (skillId && topic && !isMastered(mastery[skillId] ?? { masteredAt: null } as never)) startSkill(topic.id, skillId);
    else if (settings.activeTrackId) startNext(settings.activeTrackId, settings.startLevel);
    else createExercise();
  }
  function changeTrack() {
    configure({ activeTrackId: '', onboardingDismissed: false });
  }
  function ask(message: string) {
    chat.add(live.current.activeId, 'student', message);
    askAi(message);
  }
  /** An AI question with a short thread of context; the student's own line is not part of the tail yet. */
  function askAi(message: string, mode: Mode = 'ask') {
    const chunks = allChunks(sources);
    const retrievedContext = chunks.length
      ? retrieveTopChunks(chunks, message, 5).map(c => ({ sourceId: c.sourceId, sourceTitle: c.sourceTitle, chunkIndex: c.chunkIndex, text: c.text }))
      : undefined;
    const conversation = conversationTail(chat.thread);
    void request(mode, { studentMessage: message, retrievedContext, learnerContext: learnerContext(), ...(conversation.length ? { conversation } : {}) });
  }
  /** The tutor says something outside the coach's own events (chat answers, local help). */
  function tutorSay(text: string) {
    setMessage({ id: `say-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`, kind: 'info', text }); voice.speak(text);
  }
  /** A typed or spoken message: everyday app questions are answered locally, the rest goes to the AI. */
  function sendChat(text: string) {
    const question = text.trim().slice(0, 400);
    if (!question) return;
    const locale = live.current.settings.locale, cm = chatMessages[locale];
    chat.add(live.current.activeId, 'student', question);
    const faq = answerFaq(question, locale);
    if (faq) { tutorSay(faq.text); return; }
    if (!canRequest) { tutorSay(`${cm.noAi}\n${cm.noAiHow}`); return; }
    askAi(question);
  }
  function chatChip(id: ChipId) {
    const locale = live.current.settings.locale, cm = chatMessages[locale];
    chat.add(live.current.activeId, 'student', cm[CHIP_LABEL[id]]);
    const faq = CHIP_FAQ[id];
    if (faq) { tutorSay(faqById(faq, locale).text); return; }
    if (id === 'understand') { updateProfile(p => resolveStyleOutcome(p, true)); flashHappy(); tutorSay(cm.understandReply); return; }
    if (id === 'next_problem') { nextProblem(); return; }
    if (id === 'hint' && message?.kind === 'wrong' && message.stepId) { void tutorChoice('local_hint'); return; }
    if (id === 'hint' && !lines.length) { tutorSay(cm.noHintYet); return; }
    if (!canRequest) { tutorSay(id === 'lost' ? cm.lostNoAi : `${cm.noAi}\n${cm.noAiHow}`); return; }
    if (id === 'explain') { void tutorChoice('explain'); return; }
    if (id === 'hint') { void request('hint', { learnerContext: learnerContext(), ...tail() }); return; }
    if (id === 'next_step') { void request('next_step', { learnerContext: learnerContext(), ...tail() }); return; }
    if (id === 'lost') { askAi(cm.askLost, 'explain_differently'); return; }
    askAi(id === 'why_wrong' ? cm.askWhyWrong : cm.askExample);
  }
  function tail(): Pick<ContinueLessonExtra, 'conversation'> {
    const conversation = conversationTail(chat.thread);
    return conversation.length ? { conversation } : {};
  }
  function toggleChat() {
    setPanel(null); setPinned(false); setSettingsOpen(false); setCalcOpen(false); setTutorMenu(false);
    setChatOpen(o => !o);
  }
  function uploadScan(image: UploadedImage) {
    void request(undefined, undefined, image);
  }
  function addCustomSource(title: string, text: string) {
    setSources(prev => { const next = addSource(prev, title, text); saveSources(next); return next; });
  }
  function removeCustomSource(id: string) {
    setSources(prev => { const next = removeSource(prev, id); saveSources(next); return next; });
  }
  function recordMastery(skillId: string, wasCorrect: boolean) {
    setMastery(prev => {
      const next = recordAttempt(getOrCreateMastery(prev, skillId, Date.now()), wasCorrect, Date.now());
      const updated = { ...prev, [next.skillId]: next };
      saveMastery(updated);
      return updated;
    });
  }
  function updateProfile(change: (p: LearnerProfile) => LearnerProfile) {
    const next = change(profileRef.current);
    profileRef.current = next; setProfileState(next); saveProfile(next);
  }
  function learnerContext(style?: ExplainStyle) {
    const locale = live.current.settings.locale;
    return profileSummary(profileRef.current, locale, style, Object.fromEntries(catalog.skills.map(s => [s.id, s.title[locale]])));
  }
  const happyTimer = useRef<ReturnType<typeof setTimeout>>();
  function flashHappy() { setHappy(true); clearTimeout(happyTimer.current); happyTimer.current = setTimeout(() => setHappy(false), 2500); }
  useEffect(() => () => clearTimeout(happyTimer.current), []);
  /** One pass of the local coach: judge the newest unhandled line and react (speak, mark, offer, record). */
  function runCoach() {
    const cur = live.current;
    const current = cur.boards.find(b => b.id === cur.activeId)!;
    const mode = cur.settings.coachMode;
    if (mode === 'off' || busy.current || pending.current) return;
    const ls = writtenLines(current.steps);
    const task = effectiveStatement(current.statement, ls);
    const expected: ExpectedAnswer | undefined = current.expected ?? expectedAnswerFor(task);
    // A low-confidence handwriting reading is a question, never a wrong answer.
    const newest = ls.filter(line => line.latexGuess.trim()).at(-1);
    if (newest?.uncertain) { applyCoachEvent(current, ls, { kind: 'unclear', key: stepKey(newest), n: ls.indexOf(newest) + 1 }); return; }
    const handled = new Set(current.handled ?? []);
    const event = nextCoachEvent({ mode, statement: task, steps: ls, expected, handled });
    if (event.kind === 'idle') return;
    applyCoachEvent(current, ls, event);
  }
  function applyCoachEvent(current: BoardState, ls: ReturnType<typeof writtenLines>, event: Exclude<CoachEvent, { kind: 'idle' }>) {
    const cur = live.current;
    // Everything written so far counts as seen once the newest line is judged: no late comments on lines the student has moved past.
    const marked: BoardState = { ...current, handled: [...new Set([...(current.handled ?? []), ...ls.map(stepKey), event.key])].slice(-300) };
    const locale = cur.settings.locale;
    const say = (kind: TutorMessage['kind']) => {
      let text = event.kind === 'check_in' ? messages[locale].checkInPrompt : coachLine(event, locale, hashKey(event.key));
      if (!text) return;
      if (event.kind === 'solved' && marked.skillId) {
        const topic = catalog.topics.find(tp => tp.skillIds.includes(marked.skillId!));
        const after = { ...masteryRef.current, [marked.skillId]: recordAttempt(getOrCreateMastery(masteryRef.current, marked.skillId, Date.now()), true, Date.now()) };
        if (topic && !marked.outcome && topicMastered(catalog, topic.id, after)) text += ` ${messages[locale].topicDoneHint}`;
      }
      setMessage({ id: event.key, kind, text, stepId: ls[event.n - 1]?.stepId, ...(event.kind === 'wrong_step' ? { reason: event.reason } : {}) }); voice.speak(text);
    };
    switch (event.kind) {
      case 'ok_step':
        updateProfile(p => resolveStyleOutcome(p, true)); flashHappy(); updateBoard(marked);
        setMessage(m => (m?.kind === 'wrong' ? null : m)); break;
      case 'wrong_step': case 'wrong_final': {
        const reason = event.kind === 'wrong_step' ? event.reason : 'wrong_final';
        if (event.kind === 'wrong_step' || !marked.outcome) updateProfile(p => resolveStyleOutcome(recordError(p, marked.skillId ?? null, reason, Date.now()), false));
        const wrongLine = ls[event.n - 1];
        const attempts = (stepErrors.current.get(wrongLine?.stepId ?? '') ?? 0) + 1;
        if (wrongLine?.stepId) stepErrors.current.set(wrongLine.stepId, attempts);
        let next = event.kind === 'wrong_step' ? { ...marked, annotations: [...marked.annotations,
          ...localTeacherActions(wrongLine, marked.revision, locale, { attemptCount: attempts })].slice(-64) } : marked;
        if (event.kind === 'wrong_final' && !next.outcome) { if (next.skillId) recordMastery(next.skillId, false); next = { ...next, outcome: 'failed' }; }
        updateBoard(next); say('wrong'); break;
      }
      case 'solved': {
        if (!marked.outcome && marked.skillId) recordMastery(marked.skillId, true);
        if (!marked.outcome) updateProfile(p => resolveStyleOutcome(recordSolved(p, Date.now()), true));
        updateBoard({ ...marked, outcome: marked.outcome ?? 'solved' }); say('solved'); break;
      }
      case 'check_in':
        updateBoard(marked); say('check_in'); break;
      case 'unclear': {
        updateBoard(marked);
        const line = ls.find(l => stepKey(l) === event.key);
        const text = line?.latexGuess ?? '';
        const task = effectiveStatement(current.statement, ls);
        if (line?.uncertain) {
          setMessage({ id: event.key, kind: 'info', text: messages[locale].uncertainReading, stepId: line.stepId });
          voice.speak(messages[locale].uncertainReading);
          break;
        }
        if (current.expected || expectedAnswerFor(task) || !looksLikeFinalLine(text, statementHasSymbols(task))) break; // data line or intermediate result: stay quiet
        if (cur.settings.auto && canRequest) void request('check', { learnerContext: learnerContext() });
        else say('unclear');
        break;
      }
    }
  }
  function selfAssess(done: boolean) {
    const cur = live.current.boards.find(b => b.id === live.current.activeId);
    if (!cur?.skillId || cur.outcome) return;
    recordMastery(cur.skillId, done);
    updateProfile(p => done ? recordSolved(p, Date.now()) : recordError(p, cur.skillId ?? null, 'self_reported', Date.now()));
    updateBoard({ ...cur, outcome: done ? 'solved' : cur.outcome ?? 'failed' });
    setMessage({ id: `self-${cur.id}`, kind: 'solved', text: t.selfNoted });
  }
  async function tutorChoice(choice: TutorChoice) {
    const key = message?.id ?? '';
    if (choice === 'confirm_final' || choice === 'report_failed') {
      const cur = live.current;
      const current = cur.boards.find(b => b.id === cur.activeId)!;
      if (cur.settings.coachMode === 'off' || message?.kind !== 'check_in' || busy.current) return;
      const ls = writtenLines(current.steps);
      const task = effectiveStatement(current.statement, ls);
      const event = confirmCoachFinal({ mode: cur.settings.coachMode, statement: task, steps: ls,
        expected: current.expected ?? expectedAnswerFor(task), handled: new Set() }, key);
      if (event.kind === 'idle') { setMessage(null); return; }
      applyCoachEvent({ ...current, confirmedFinals: [...new Set([...(current.confirmedFinals ?? []), key])].slice(-300) }, ls,
        choice === 'report_failed' ? { kind: 'wrong_final', key, n: event.n } : event);
      return;
    }
    if (choice === 'cancel') { stop(); return; }
    if (choice === 'dismiss') { setMessage(null); return; }
    if (choice === 'retry_line' || choice === 'local_hint') {
      const stepId = message?.stepId;
      if (!stepId || busy.current) return;
      if (choice === 'retry_line') { if (editor.current?.removeStepLine(stepId)) setMessage(null); return; }
      const cur = live.current, current = cur.boards.find(b => b.id === cur.activeId)!;
      const hint = messages[cur.settings.locale][message.reason === 'arithmetic' ? 'hintArithmetic' : 'hintStep'];
      const action: BoardAction = { id: `hint-${stepId}`, type: 'show_hint', boardRevision: current.revision, text: hint,
        placement: { relativeToStepId: stepId, side: 'below', offsetEm: 0.4 } };
      const teacherSol = localTeacherActions(lines.find(l => l.stepId === stepId), current.revision, cur.settings.locale, { revealSolution: true });
      updateBoard({ ...current, annotations: [...current.annotations.filter(n => n.id !== action.id && !teacherSol.some(ts => ts.id === n.id)), action, ...teacherSol].slice(-64) });
      setMessage({ ...message, text: hint });
      return;
    }
    if (choice === 'next') { nextProblem(); return; }
    if (choice === 'ask_ai') { if (!canRequest) { setMessage({ id: `noai-${Date.now()}`, kind: 'info', text: t.aiNotConnected }); return; } setMessage({ id: `thinking-${Date.now()}`, kind: 'thinking', text: t.thinking }); void request('check', { learnerContext: learnerContext() }); return; }
    {
      if (!canRequest) { setMessage({ id: `noai-${Date.now()}`, kind: 'info', text: t.aiNotConnected, ...(message?.stepId ? { stepId: message.stepId } : {}) }); return; }
    }
    const style: ExplainStyle = choice === 'hint' ? 'hint' : chooseStyle(profileRef.current, Math.random, profileRef.current.pending?.style);
    updateProfile(p => recordStyleShown(p, style, key));
    // Keep the tutor talking while the AI works instead of making the bubble vanish.
    setMessage({ id: `thinking-${Date.now()}`, kind: 'thinking', text: t.thinking });
    void request(STYLE_MODE[style], { learnerContext: learnerContext(style) });
  }
  useEffect(() => {
    if (settings.coachMode === 'off') return;
    // The line counts as finished after a short pause that follows the pen-up / Escape, never mid-stroke.
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const wait = activity.remaining();
      if (wait > 0) { timer = setTimeout(tick, wait + 10); return; }
      runCoach();
    };
    timer = setTimeout(tick, Math.max(COACH_MIN_DELAY_MS, activity.remaining()));
    return () => clearTimeout(timer);
    // runCoach reads live state through refs; re-arm on every committed change of the written work.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [board.id, board.revision, settings.coachMode, running, connected, canRequest, coachTick]);
  useEffect(() => {
    // Every tutor remark is part of the board's conversation (a re-render of the same remark is not added twice).
    if (message && message.kind !== 'thinking') chat.add(board.id, 'tutor', message.text, message.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [message?.id]);
  useEffect(() => {
    if (message?.kind !== 'info' || (!settings.activeTrackId && !settings.onboardingDismissed) || panel || settingsOpen || calcOpen) return;
    const id = message.id;
    const timer = setTimeout(() => setMessage(m => (m?.id === id ? null : m)), 25000);
    return () => clearTimeout(timer);
  }, [message, settings.activeTrackId, settings.onboardingDismissed, panel, settingsOpen, calcOpen]);
  useEffect(() => {
    // A missing bridge is already shown by the top-right chip; the tutor only speaks up about failed requests.
    const errorish = !['idle', 'ready', 'waiting', 'thinking', 'thinkingAnswer', 'bridgeUnavailable'].includes(status);
    if (errorish) setMessage({ id: `status-${status}`, kind: status === 'cancelled' ? 'info' : 'error', text: t[status === 'bridgeUnavailable' ? 'offline' : status] });
  }, [status, t]);
  function eraseEverything() {
    if (!window.confirm(t.eraseAllConfirm)) return;
    resetting.current = true;
    for (const key of ['openmathtutor.frontend.v1', 'openmathtutor.mastery.v1', 'openmathtutor.profile.v1', 'openmathtutor.sources.v1', 'openmathtutor.chat.v1']) localStorage.removeItem(key);
    location.reload();
  }
  function deleteExercise() {
    if (!window.confirm(t.eraseConfirm)) return;
    stop(false); setMessage(null); setTutorMenu(false); chat.clear(live.current.activeId);
    const boards = live.current.boards.filter(b => b.id !== live.current.activeId);
    if (!boards.length) boards.push(newBoard());
    const value = { ...live.current, boards, activeId: boards[0].id }; live.current = value; setSaved(value);
  }
  if (!settings.activeTrackId && !settings.onboardingDismissed) {
    return <Onboarding catalog={catalog} t={t} locale={settings.locale} onSelectTrack={startTrack} onSkip={() => { configure({ onboardingDismissed: true }); if (board.statement || board.skillId) createExercise(); }} />;
  }
  const openPanel = panel;
  async function exportImage(kind: 'png' | 'svg') {
    const blob = await editor.current?.exportImage(kind);
    if (blob) { downloadBlob(blob, `tabule.${kind}`); setMessage({ id: `board-${Date.now()}`, kind: 'info', text: t.notesSaved }); }
  }
  const activeTrack = catalog.tracks.find(tr => tr.id === settings.activeTrackId);
  const calcPolicy = activeTrack?.calculator ?? 'scientific';
  const alertChip = !bridgeChecked ? null : !connected ? <span role="alert">{t.bridgeUnavailable} <button onClick={() => setRetry(r => r + 1)}>{t.retry}</button></span>
    : !canRequest ? <span>{provider?.id === "google" && provider.authStatus.keyPresent === false ? t.googleKeyMissing : provider && !provider.models.length ? t.noModels : t.selectProvider}</span> : null;
  const mood: TutorMood = running ? 'thinking' : phase === 'writing' && settings.coachMode !== 'off' ? 'watching' : phase === 'checking' && settings.coachMode !== 'off' ? 'checking'
    : message?.kind === 'wrong' ? 'concerned' : message?.kind === 'solved' || happy ? 'happy' : 'idle';
  const cm = chatMessages[settings.locale];
  const answeredByAi = !!aiAnswerId && message?.id === aiAnswerId;
  const chips = running ? [] : quickReplies({ kind: message?.kind ?? null, canRequest, lessonActive: !!lessonSkillId || !!board.skillId, answeredByAi, hasLines: lines.length > 0 });
  const shownMessage: TutorMessage | null = running ? { id: 'thinking', kind: 'thinking', text: t.tutorThinking } : message;
  return <div className="app-shell">
    <div className="board-stage"><Board key={board.id} ref={editor} board={board} settings={settings} onCommit={commit} onBusy={boardBusy} onInkCorrection={inkCorrection} verdicts={shownVerdicts} onRemoveAnnotation={id => { stop(false); const current = live.current.boards.find(b => b.id === live.current.activeId)!; updateBoard(removeAnnotation(current, id)); }} onAskHere={() => { setPanel('ask'); setPinned(true); }} /></div>
    <div className={`hud${openPanel ? ' drawer-open' : ''}${settingsOpen ? ' settings-open' : ''}`} data-testid="hud">
      <div className="hud-top-left">
        <span className="sr"><output data-testid="revision">{board.revision}</output></span>
        {settings.activeTrackId && !board.skillId && <div className="track-breadcrumb" data-testid="free-chip">
          <span className="track-breadcrumb-path"><strong>{t.freeProblem}</strong></span>
          <button className="track-breadcrumb-change" onClick={nextProblem}>{t.backToCourse}</button></div>}
        {settings.activeTrackId && !!board.skillId && <TrackBreadcrumb catalog={catalog} trackId={settings.activeTrackId} currentSkillId={board.skillId ?? null} mastery={mastery} t={t} locale={settings.locale} onChangeTrack={changeTrack} />}
        <div className="task-card">
          {editingTask
            ? <><label>{t.task}<textarea rows={2} maxLength={4000} value={board.statement} placeholder={t.taskPlaceholder} autoFocus
                onChange={e => { stop(false); updateBoard(editTask(board, 'statement', e.target.value)); }} /></label>
                <button onClick={() => setEditingTask(false)}>{t.taskDone}</button></>
            : <><p className="task-text" data-testid="task-text">
                {formattedTaskHtml
                  ? <><span className="sr">{statement}</span><span aria-hidden="true" dangerouslySetInnerHTML={{ __html: formattedTaskHtml }} /></>
                  : (statement || t.taskEmpty)}
              </p>
                {displayTopic && <small>{displayTopic}</small>}
                <button className="task-edit" aria-label={t.taskEdit} title={t.taskEdit} onClick={() => setEditingTask(true)}>✎</button></>}
        </div>
      </div>
      <div className="hud-top-right">
        <div className="hud-icons">
        <span className="ai-status" data-testid="ai-status" data-state={canRequest ? 'connected' : 'offline'}
          title={canRequest ? t.aiConnected : t.aiNotConnected} aria-label={canRequest ? t.aiConnected : t.aiNotConnected}>
          <span className={`status-dot ${canRequest ? 'ok' : 'idle'}`} aria-hidden="true" />
          <span className="ai-status-label" aria-hidden="true">{canRequest ? t.aiConnected : t.aiOffline}</span></span>
        {calcPolicy !== 'none' && <button className="icon-btn" title={`${t.calcOpen} — ${t.hintCalc}`} aria-label={t.calcOpen} aria-pressed={calcOpen} onClick={() => openOnly('calc')}><Icon name="calc" /></button>}
        <button className="icon-btn" title={`${t.settings} — ${t.hintSettings}`} aria-label={t.settings} aria-expanded={settingsOpen} onClick={() => openOnly('settings')}>
          <Icon name="settings" /></button>
        </div>
        {alertChip && <div className="hud-chip" aria-live="polite">{alertChip}</div>}
      </div>
      <aside className={`settings-pop${settingsOpen ? ' open' : ''}`} aria-label={t.settings}>
        <div className="settings-header"><h2>{t.settings}</h2><button className="close-btn" aria-label={t.close} onClick={() => setSettingsOpen(false)}>×</button></div>
        <label>{t.language}<select value={settings.locale} onChange={e => configure({ locale: e.target.value as Settings['locale'], voiceURI: '' })}>
          <option value="cs">Čeština</option><option value="en">English</option></select></label>
        <button onClick={() => configure({ theme: settings.theme === 'light' ? 'dark' : 'light' })}>{settings.theme === 'light' ? t.dark : t.light}</button>
        <div role="radiogroup" aria-label={t.boardPaper}><span className="muted">{t.boardPaper}</span>
          <div className="pattern-picker">{BOARD_PATTERNS.map(pattern => <button key={pattern} role="radio" aria-checked={settings.boardPattern === pattern} data-pattern={pattern}
            onClick={() => configure({ boardPattern: pattern })}><span>{t[({ plain: 'patternPlain', grid: 'patternGrid', lines: 'patternLines', dots: 'patternDots', school: 'patternSchool' } as const)[pattern]]}</span></button>)}</div></div>
        <div role="radiogroup" aria-label={t.defaultTool}><span className="muted">{t.defaultTool}</span>
          <div className="pattern-picker">{DEFAULT_TOOLS.map(tool => <button key={tool} role="radio" aria-checked={settings.defaultTool === tool} data-tool={tool}
            onClick={() => configure({ defaultTool: tool })}><span>{tool === 'freedraw' ? t.toolPen : t.toolText}</span></button>)}</div></div>
        {connected && <>
          <label><span>{t.aiProvider}</span><select aria-label={t.provider} value={settings.provider} onChange={e => {
            const id = e.target.value as ProviderId | '';
            // Picking a provider should also pick a usable model, not leave
            // every action silently disabled until the person notices.
            const match = providers.find(p => p.id === id);
            configure({ provider: id, model: match?.models[0]?.id ?? '' });
          }}>
          <option value="">{t.choose}</option>{providers.map(p => <option key={p.id} value={p.id}>{p.id === "google" ? t.googleProvider : p.id}{providerStatusLabel(p, t)}</option>)}</select></label>
          <small className="muted">{t.aiRunsLocally}</small>
          <label><span>{t.aiModel}</span><select aria-label={t.model} value={settings.model} onChange={e => configure({ model: e.target.value })}><option value="">{t.choose}</option>
            {provider?.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          {provider && provider.id === "google" && !provider.authStatus.authenticated && provider.authStatus.keyPresent === false &&
            <p className="muted" role="alert">{t.googleKeyMissing}</p>}
          {!verifierOK && <span role="alert">{t.healthVerifier}</span>}
        </>}
        <label className="check-label"><input type="checkbox" checked={settings.showAI} onChange={e => configure({ showAI: e.target.checked })} />{t.aiLayer}</label>
        <label className="check-label"><input type="checkbox" checked={settings.auto} onChange={e => configure({ auto: e.target.checked })} />{t.consent}</label>
        <button onClick={() => { configure({ activeTrackId: '', onboardingDismissed: false }); setSettingsOpen(false); }}>{t.pickCourseAgain}</button>
        <label>{t.voiceChoice}<select value={voice.voices.some(v => v.voiceURI === settings.voiceURI) ? settings.voiceURI : ''} onChange={e => configure({ voiceURI: e.target.value })}>
          <option value="">{t.choose}</option>
          {voice.systemVoices.length > 0 && <optgroup label={t.voiceSystemGroup}>{voice.systemVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</optgroup>}
          <optgroup label={t.voicePiperGroup}>{voice.piperVoices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</optgroup></select></label>
        {voice.piper.voice && <div className="piper-voice" data-testid="piper-voice">
          {voice.piper.status === 'ready'
            ? <p className="muted" data-testid="piper-ready">{t.piperReady}</p>
            : voice.piper.status === 'downloading'
              ? <><progress max={100} value={downloadPercent(voice.piper.loaded, voice.piper.total)} aria-label={t.piperDownload} />
                  <p className="muted" data-testid="piper-progress">{t.piperProgress.replace('{done}', formatSize(voice.piper.loaded, settings.locale)).replace('{total}', formatSize(voice.piper.total, settings.locale))}</p>
                  <div className="row"><button onClick={voice.piper.cancel}>{t.piperCancel}</button></div></>
              : <><p className="muted">{t.piperSize.replace('{mb}', formatSize(estimateBytes(voice.piper.voice), settings.locale))}</p>
                  {voice.piper.error && <p className="warning" role="alert" data-testid="piper-error">{t[voice.piper.error]}</p>}
                  <div className="row"><button className="primary" data-testid="piper-download" onClick={voice.piper.start}>{t.piperDownload}</button></div></>}
        </div>}
        <label>{t.rate} ({settings.rate})<input type="range" min="0.5" max="1.5" step="0.1" value={settings.rate} onChange={e => configure({ rate: Number(e.target.value) })} /></label>
        <label className="check"><input type="checkbox" checked={settings.onlineVoices} onChange={e => configure({ onlineVoices: e.target.checked, voiceURI: '' })} /> {t.onlineVoices}</label>
        {voice.warning && <p className="warning" role="alert">{t[voice.warning]}</p>}
        {saveError && <p role="alert" className="warning">{t.localSaveError}</p>}
        {rejected && <p role="alert" className="warning">{t.rejectedActions}</p>}
        <p className="muted">{t.controlsHelp}</p>
        <p className="privacy">{t.privacy}</p>
        <button className="stop" onClick={eraseEverything}>{t.eraseAll}</button>
        <Credit locale={settings.locale} />
      </aside>
      <Credit locale={settings.locale} compact />
      {calcOpen && calcPolicy !== 'none' && <Calculator t={t} locale={settings.locale} policy={calcPolicy} examRules={!!activeTrack?.calculator}
        onClose={() => setCalcOpen(false)} onUse={text => editor.current?.addLine(text, null)} />}
      <Rail items={[{ id: 'plan', label: t.planTitle, hint: t.hintPlan }, { id: 'courses', label: t.courses, hint: t.hintCourses }, { id: 'ask', label: t.askLabel, hint: t.hintAsk }, { id: 'materials', label: t.customSources, hint: t.hintMaterials },
        { id: 'exercises', label: t.exercise, hint: t.hintExercises }, { id: 'history', label: t.history, hint: t.hintHistory }, { id: 'notes', label: t.notesRail, hint: t.hintNotes }]}
        active={openPanel} onHover={hoverPanel} onToggle={togglePanel} />
      <aside className={`drawer${openPanel ? ' open' : ''}`}
        onMouseEnter={() => clearTimeout(leaveTimer.current)} onMouseLeave={leavePanel}>
        <section hidden={openPanel !== 'plan'}>
          <PlanPanel catalog={catalog} trackId={settings.activeTrackId} mastery={mastery} profile={profile} t={t} locale={settings.locale}
            currentSkillId={board.skillId ?? lessonSkillId} onStartSkill={startSkill} onBuildTest={buildTest} notice={testNotice} />
        </section>
        <section hidden={openPanel !== 'courses'}>
          <CoursesPanel catalog={catalog} mastery={mastery} t={t} locale={settings.locale} onStartLesson={startLesson} activeSkillId={lessonSkillId} defaultDifficulty={settings.startLevel}
            onAsk={q => { setPanel('ask'); setPinned(true); ask(q); }} />
        </section>
        <section hidden={openPanel !== 'ask'}>
          <AskPanel t={t} disabled={!canRequest || running} onAsk={ask} />
          <UploadBoard t={t} disabled={!canRequest || !model?.supportsImageInput || running} onUpload={uploadScan} />
        </section>
        <section hidden={openPanel !== 'materials'}>
          <CustomSourcesPanel t={t} sources={sources} onAdd={addCustomSource} onRemove={removeCustomSource} />
        </section>
        <section hidden={openPanel !== 'exercises'}><h2>{t.exercise}</h2><label>{t.exercise}<select value={saved.activeId} onChange={e => switchExercise(e.target.value)}>
          {saved.boards.map((b, i) => <option key={b.id} value={b.id}>{i + 1}. {(b.statement || b.steps[0]?.latexGuess || t.emptyExercise).slice(0, 40)}</option>)}</select></label>
          <div className="row"><button onClick={createExercise}>{t.newExercise}</button><button onClick={deleteExercise}>{t.deleteExercise}</button></div></section>
        <section hidden={openPanel !== 'notes'}>
          <NotesPanel t={t} strengths={strengths} canAsk={canRequest && !running}
            onExportImage={kind => void exportImage(kind)}
            onExportMarkdown={() => { downloadBlob(new Blob([buildNotesMarkdown(saved.boards, t, strengths)], { type: 'text/markdown' }), 'zapisky.md'); setMessage({ id: `notes-${Date.now()}`, kind: 'info', text: t.notesSaved }); }}
            onPrint={() => printHtml(buildNotesHtml(saved.boards, t, strengths))}
            onStudyText={() => { setPanel('history'); ask(studyTextRequest(strengths, settings.locale)); }} />
        </section>
        <section hidden={openPanel !== 'history'}><h2 className="h2-muted">{t.history}<span className="info-icon" title={t.unverified} aria-label={t.unverified} role="img">ⓘ</span></h2>
          {!board.history.length && <p className="muted">{t.emptyHistory}</p>}
          <ol className="history">{board.history.map(h => <li key={h.id} data-testid="explanation">
            <strong>{t[h.status]}</strong>{h.firstErrorStepId && <small>{t.firstError}: {board.steps.findIndex(s => s.stepId === h.firstErrorStepId) + 1 || '—'}</small>}
            <p>{h.text}</p>{h.clarification && <p>{h.clarification}</p>}<small>{t.revision} {h.revision}</small>
            <button onClick={() => voice.speak(h.ttsText, true)} disabled={!voice.available}>{t.speak}</button>
          </li>)}</ol>
          <h2 className="h2-muted">{t.annotations}</h2><p className="muted">{t.annotationReveal}</p><ul className="annotations-list">{board.annotations.map((a, i) => <li key={a.id} data-testid="annotation-item">
            <span>{t.aiBadge} {i + 1}</span><button onClick={() => { stop(false); updateBoard(removeAnnotation(board, a.id)); }}>{t.undoAnnotation} {i + 1}</button></li>)}</ul></section>
      </aside>
      <TutorHud key={board.id} locateStep={locateStep} locateObstacles={locateObstacles} writing={phase === 'writing'} t={t} locale={settings.locale} activity={activity} slow={slow} celebrate={message?.kind === 'solved'}
        quiet={settingsOpen || calcOpen || !!openPanel} mood={mood} speaking={voice.speaking} message={shownMessage} menuOpen={tutorMenu} running={running} canRequest={canRequest}
        answerChips={answeredByAi ? ['understand', 'lost'] : undefined} onChip={chatChip}
        chat={{ open: chatOpen, onToggle: toggleChat, locale: settings.locale, thread: chat.thread, chips, busy: running, slow, large: chatLarge,
          micAvailable: mic.available, listening: mic.listening, onChip: chatChip, onSend: sendChat, onMic: () => mic.toggle(text => { setChatOpen(true); sendChat(text); }),
          onCollapse: () => setChatOpen(false), onToggleSize: () => setChatLarge(v => !v), onCancel: () => stop(),
          onClear: () => { if (window.confirm(cm.chatClearConfirm)) chat.clear(board.id); } }}
        lessonActive={!!lessonSkillId || !!board.skillId} selfAssess={!!board.skillId && !board.expected && !board.outcome} mode={settings.coachMode} voiceOn={settings.tutorVoice} micAvailable={mic.available} listening={mic.listening}
        onToggleMenu={() => openOnly('tutor')}
        notesVisible={settings.showAI} hasNotes={!!board.annotations.length}
        onToggleNotes={() => configure({ showAI: !settings.showAI })}
        onClearNotes={() => { stop(false); updateBoard({ ...board, annotations: [] }); }}
        onMode={mode => { configure({ coachMode: mode }); if (mode === 'off') setMessage(null); }} onVoice={on => { if (!on) voice.cancel(); configure({ tutorVoice: on }); }}
        onMic={() => mic.toggle(text => { setChatOpen(true); sendChat(text); })}
        onAction={action => { setTutorMenu(false); if (action === 'stop') stop(); else if (action === 'next_problem') nextProblem(); else if (action === 'free') createExercise(); else if (action === 'self_done' || action === 'self_fail') selfAssess(action === 'self_done'); else void request(action, { learnerContext: learnerContext() }); }}
        onChoice={choice => void tutorChoice(choice)} />
    </div>
  </div>;
}

