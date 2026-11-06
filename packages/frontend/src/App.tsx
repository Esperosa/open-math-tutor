import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContinueLessonRequest, ProviderId } from '@openmathtutor/shared';
import {
  recordAttempt, retrieveTopChunks, checkSteps, isMastered, instantiateTemplate,
  getTopicSkills, nextUnlockedTopic, nextUnlockedSkill, pickTemplateForDifficulty,
} from '@openmathtutor/shared';
import { catalog } from '@openmathtutor/content';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { Board, type BoardHandle } from './Board';
import { applyResponse, commitStudent, editTask, fingerprint, newBoard, removeAnnotation, stableMathCandidate, type BoardState } from './boardState';
import { bridge, BridgeError, type ProviderEntry } from './api';
import { messages, errorKeys, type MessageKey } from './i18n';
import { load, save, type Saved, type Settings } from './storage';
import { StrokeSettler } from './settle';
import { useVoice } from './useVoice';
import { loadMastery, saveMastery, getOrCreateMastery } from './curriculumStorage';
import { CoursesPanel, type LessonStart } from './curriculum/CoursesPanel';
import { Onboarding } from './curriculum/Onboarding';
import { TrackBreadcrumb } from './curriculum/TrackBreadcrumb';
import { Rail, Icon, type PanelId } from './Hud';
import { AskPanel } from './AskPanel';
import { UploadBoard, type UploadedImage } from './UploadBoard';
import { CustomSourcesPanel } from './CustomSourcesPanel';
import { loadSources, saveSources, addSource, removeSource, allChunks } from './customSources';

type Mode = ContinueLessonRequest['mode'];
type ContinueLessonExtra = Pick<ContinueLessonRequest, 'studentMessage' | 'curriculumContext' | 'retrievedContext'>;
interface Pending { id: string; controller: AbortController; provider: ProviderId; boardId: string; revision: number }
export function App() {
  const [saved, setSaved] = useState<Saved>(load);
  const live = useRef(saved); live.current = saved;
  const board = saved.boards.find(b => b.id === saved.activeId)!;
  const settings = saved.settings;
  const t = messages[settings.locale];
  const editor = useRef<BoardHandle>(null);
  const pending = useRef<Pending | null>(null);
  const busy = useRef(false);
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState<MessageKey>('idle');
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [verifierOK, setVerifierOK] = useState(true);
  const [retry, setRetry] = useState(0);
  const [saveError, setSaveError] = useState(false);
  const [line, setLine] = useState('');
  const [selectedStep, setSelectedStep] = useState('');
  const [rejected, setRejected] = useState(false);
  const [panel, setPanel] = useState<PanelId | null>(null);
  const [pinned, setPinned] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(new Set());
  const hoverTimer = useRef<ReturnType<typeof setTimeout>>();
  const leaveTimer = useRef<ReturnType<typeof setTimeout>>();
  const verdicts = useMemo(() => checkSteps(board.statement, board.steps), [board.statement, board.steps]);
  const offer = useMemo(() => {
    for (let i = board.steps.length - 1; i >= 0; i--) {
      const step = board.steps[i]!;
      if (verdicts[step.stepId]?.status === 'wrong' && !dismissed.has(`${step.stepId}:${step.latexGuess}`)) return { n: i + 1, key: `${step.stepId}:${step.latexGuess}` };
    }
    return null;
  }, [board.steps, verdicts, dismissed]);
  useEffect(() => {
    const away = (e: PointerEvent) => {
      if ((e.target as Element | null)?.closest('.rail, .drawer, .settings-pop, .icon-btn')) return;
      setPanel(null); setPinned(false); setSettingsOpen(false);
    };
    const esc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setPanel(null); setPinned(false); setSettingsOpen(false); }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault(); setPanel('courses'); setPinned(true);
        setTimeout(() => document.getElementById('course-search')?.focus(), 50);
      }
    };
    document.addEventListener('pointerdown', away); document.addEventListener('keydown', esc);
    return () => { document.removeEventListener('pointerdown', away); document.removeEventListener('keydown', esc); };
  }, []);
  const voice = useVoice(settings);
  const [settler] = useState(() => new StrokeSettler(() => void analyze.current()));
  const analyze = useRef<() => Promise<void>>(async () => {});
  const [mastery, setMastery] = useState(loadMastery);
  const [lessonSkillId, setLessonSkillId] = useState<string | null>(null);
  const [sources, setSources] = useState(loadSources);
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
      if (!live.current.settings.provider) {
        const ready = entries.find(p => p.detect.installed && p.authStatus.authenticated && p.authStatus.tutoringAvailable && p.models.length > 0)
          ?? entries.find(p => p.detect.installed && p.authStatus.authenticated && p.models.length > 0);
        if (ready) {
          const value = { ...live.current, settings: { ...live.current.settings, provider: ready.id, model: ready.models[0]!.id } };
          live.current = value; setSaved(value);
        }
      }
    }).catch(() => { if (!controller.signal.aborted) setStatus('bridgeUnavailable'); })
      .finally(() => clearTimeout(timeout));
    return () => controller.abort();
  }, [retry]);
  useEffect(() => {
    const timer = setTimeout(() => setSaveError(!save(saved)), 350);
    return () => clearTimeout(timer);
  }, [saved]);
  useEffect(() => {
    const flush = () => { save(live.current); };
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
    if (!canRequest || busy.current || (!mode && !imageOverride && !model?.supportsImageInput)) return;
    stop(false);
    const snapshot = live.current.boards.find(b => b.id === live.current.activeId)!;
    const controller = new AbortController();
    const id = crypto.randomUUID();
    const request: Pending = { id, controller, provider: settings.provider as ProviderId, boardId: snapshot.id, revision: snapshot.revision };
    pending.current = request; setRunning(true); setStatus(mode === 'ask' ? 'thinkingAnswer' : 'thinking'); setRejected(false);
    const timer = setTimeout(() => { controller.abort(); void bridge.cancel(request.provider, id, AbortSignal.timeout(5000)).catch(() => {}); }, 120000);
    const base = { requestId: id, boardRevision: snapshot.revision,
      task: { statementText: snapshot.statement, topic: snapshot.topic },
      stepHistory: snapshot.steps.map(({ stepId, latexGuess, boardRevision }) => ({ stepId, latexGuess, boardRevision })),
      locale: settings.locale, model: settings.model };
    try {
      const imageCrop = imageOverride ?? (!mode ? await editor.current?.crop(snapshot) : undefined);
      if (pending.current !== request || controller.signal.aborted) return;
      const response = mode ? await bridge.continue(request.provider, { ...base, mode, ...extra }, controller.signal)
        : await bridge.analyze(request.provider, { ...base, imageCrop: imageCrop! }, controller.signal);
      if (pending.current !== request) return;
      const current = live.current.boards.find(b => b.id === request.boardId);
      if (!current || live.current.activeId !== request.boardId || busy.current) { setStatus('waiting'); return; }
      const applied = applyResponse(current, response, id);
      if (applied.state !== current) updateBoard(applied.state);
      setStatus(applied.stale ? 'waiting' : 'ready'); setRejected(applied.rejected);
      if (!applied.stale && mode === 'check' && lessonSkillId) {
        const wasCorrect = response.verifierStatus === 'correct';
        setMastery(prev => {
          const next = recordAttempt(getOrCreateMastery(prev, lessonSkillId, Date.now()), wasCorrect, Date.now());
          const updated = { ...prev, [next.skillId]: next };
          saveMastery(updated);
          return updated;
        });
      }
      if (!applied.stale && live.current.settings.voiceEnabled) voice.speak(response.ttsText);
    } catch (error) {
      if (pending.current !== request) return;
      if (controller.signal.aborted) setStatus('timeout');
      else if (error instanceof BridgeError) {
        setStatus(error.code === 'bridgeUnavailable' || error.code === 'invalidRequest' ? error.code : errorKeys[error.code]);
        if (error.code === 'bridgeUnavailable') setConnected(false);
      } else setStatus('unknown');
    } finally {
      clearTimeout(timer);
      if (pending.current === request) { pending.current = null; setRunning(false); }
    }
  }
  analyze.current = () => request();
  function schedule(next: BoardState) {
    settler.update(`${next.id}:${fingerprint(next.elements)}`, live.current.settings.auto && canRequest && !!model?.supportsImageInput && !busy.current && stableMathCandidate(next));
  }
  function commit(elements: readonly ExcalidrawElement[], files: BinaryFiles) {
    const current = live.current.boards.find(b => b.id === live.current.activeId)!;
    const next = commitStudent(current, elements, files);
    if (next.revision === current.revision) { if (next !== current) updateBoard(next); return; }
    stop(false); setStatus('waiting'); updateBoard(next); schedule(next);
  }
  function boardBusy(value: boolean) {
    busy.current = value;
    if (value) { stop(false); setStatus('waiting'); }
    else schedule(live.current.boards.find(b => b.id === live.current.activeId)!);
  }
  function switchExercise(id: string) {
    stop(false); setLine(''); setSelectedStep('');
    const value = { ...live.current, activeId: id }; live.current = value; setSaved(value); setStatus('idle');
  }
  function hoverPanel(id: PanelId) {
    clearTimeout(leaveTimer.current); clearTimeout(hoverTimer.current);
    if (!pinned) hoverTimer.current = setTimeout(() => setPanel(id), 220);
  }
  function togglePanel(id: PanelId) {
    clearTimeout(hoverTimer.current);
    if (panel === id && pinned) { setPanel(null); setPinned(false); } else { setPanel(id); setPinned(true); }
  }
  function leavePanel() {
    clearTimeout(hoverTimer.current);
    if (!pinned) leaveTimer.current = setTimeout(() => setPanel(null), 450);
  }
  function createExercise() {
    stop(false); const next = newBoard();
    const value = { ...live.current, boards: [...live.current.boards, next], activeId: next.id };
    live.current = value; setSaved(value); setLine(''); setSelectedStep(''); setStatus('idle');
  }
  function startLesson(lesson: LessonStart) {
    // A new lesson is a new problem, not an edit of the current one — reusing
    // the active board here left the previous problem's handwriting and
    // explanation history visible underneath the new statement.
    stop(false); setLine(''); setSelectedStep('');
    const next: BoardState = { ...newBoard(), topic: lesson.topic, statement: lesson.statementText };
    const value = { ...live.current, boards: [...live.current.boards, next], activeId: next.id };
    live.current = value; setSaved(value);
    setLessonSkillId(lesson.skillId);
    setStatus('idle');
    void request('next_problem', { curriculumContext: lesson.curriculumContext });
  }
  function startTrack(trackId: string) {
    configure({ activeTrackId: trackId, onboardingDismissed: true });
    const masteredIds = new Set(Object.values(mastery).filter(isMastered).map(s => s.skillId));
    const topic = nextUnlockedTopic(catalog, trackId, masteredIds);
    const skill = topic ? nextUnlockedSkill(getTopicSkills(catalog, topic.id), masteredIds) : null;
    if (!topic || !skill) { createExercise(); return; }
    const difficultyLevel = mastery[skill.id]?.difficultyLevel ?? 1;
    const template = pickTemplateForDifficulty(catalog, skill.id, difficultyLevel);
    if (!template) return;
    startLesson({
      skillId: skill.id, statementText: instantiateTemplate(template), topic: topic.title[settings.locale],
      curriculumContext: { trackId, topicId: topic.id, skillId: skill.id, difficultyLevel: template.difficultyLevel },
    });
  }
  function changeTrack() {
    configure({ activeTrackId: '', onboardingDismissed: false });
  }
  function ask(message: string) {
    const chunks = allChunks(sources);
    const retrievedContext = chunks.length
      ? retrieveTopChunks(chunks, message, 5).map(c => ({ sourceId: c.sourceId, sourceTitle: c.sourceTitle, chunkIndex: c.chunkIndex, text: c.text }))
      : undefined;
    void request('ask', { studentMessage: message, retrievedContext });
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
  function deleteExercise() {
    if (!window.confirm(t.eraseConfirm)) return;
    stop(false);
    const boards = live.current.boards.filter(b => b.id !== live.current.activeId);
    if (!boards.length) boards.push(newBoard());
    const value = { ...live.current, boards, activeId: boards[0].id }; live.current = value; setSaved(value); setLine(''); setSelectedStep('');
  }
  if (!settings.activeTrackId && !settings.onboardingDismissed) {
    return <Onboarding catalog={catalog} t={t} locale={settings.locale} onSelectTrack={startTrack} onSkip={() => configure({ onboardingDismissed: true })} />;
  }
  const openPanel = panel;
  const alertChip = !connected ? <span role="alert">{t.bridgeUnavailable} <button onClick={() => setRetry(r => r + 1)}>{t.retry}</button></span>
    : !canRequest ? <span>{provider && !provider.models.length ? t.noModels : t.selectProvider}</span> : null;
  return <div className="app-shell">
    <div className="board-stage"><Board key={board.id} ref={editor} board={board} settings={settings} onCommit={commit} onBusy={boardBusy} verdicts={verdicts} onAskHere={() => { setPanel('ask'); setPinned(true); }} /></div>
    <div className="hud" data-testid="hud">
      <div className="hud-top-left">
        {settings.activeTrackId && <TrackBreadcrumb catalog={catalog} trackId={settings.activeTrackId} mastery={mastery} t={t} locale={settings.locale} onChangeTrack={changeTrack} />}
        <div className="task-card"><label>{t.task}<textarea rows={2} maxLength={4000} value={board.statement} placeholder={t.taskPlaceholder}
          onChange={e => { stop(false); updateBoard(editTask(board, 'statement', e.target.value)); }} /></label>
          <label>{t.topic}<input value={board.topic} maxLength={200} placeholder={t.topicPlaceholder}
            onChange={e => { stop(false); updateBoard(editTask(board, 'topic', e.target.value)); }} /></label></div>
      </div>
      <div className="hud-top-right">
        {alertChip && <div className="hud-chip" aria-live="polite">{alertChip}</div>}
        <button className="icon-btn" title={t.settings} aria-label={t.settings} aria-expanded={settingsOpen} onClick={() => setSettingsOpen(o => !o)}>
          <span className={`status-dot ${canRequest ? 'ok' : 'idle'}`} aria-hidden="true" /><Icon name="settings" /></button>
      </div>
      <aside className={`settings-pop${settingsOpen ? ' open' : ''}`} aria-label={t.settings}>
        <label>{t.language}<select value={settings.locale} onChange={e => configure({ locale: e.target.value as Settings['locale'], voiceURI: '' })}>
          <option value="cs">Čeština</option><option value="en">English</option></select></label>
        <button onClick={() => configure({ theme: settings.theme === 'light' ? 'dark' : 'light' })}>{settings.theme === 'light' ? t.dark : t.light}</button>
        {connected && <>
          <label>{t.provider}<select value={settings.provider} onChange={e => {
            const id = e.target.value as ProviderId | '';
            // Picking a provider should also pick a usable model, not leave
            // every action button silently disabled until the person notices.
            const match = providers.find(p => p.id === id);
            configure({ provider: id, model: match?.models[0]?.id ?? '' });
          }}>
          <option value="">{t.choose}</option>{providers.map(p => <option key={p.id} value={p.id}>{p.id}
            {!p.detect.installed ? ` — ${t.providerMissing}` : !p.authStatus.authenticated ? ` — ${t.authMissing}` : !p.authStatus.tutoringAvailable ? ` — ${t.providerLimited}` : ''}</option>)}</select></label>
          <label>{t.model}<select value={settings.model} onChange={e => configure({ model: e.target.value })}><option value="">{t.choose}</option>
            {provider?.models.map(m => <option key={m.id} value={m.id}>{m.label}</option>)}</select></label>
          {provider?.authStatus.authenticated && !provider.authStatus.tutoringAvailable &&
            <span role="alert" className="warning-inline" title={provider.authStatus.detail}>{t.tutoringLimited}</span>}
          {!verifierOK && <span role="alert">{t.healthVerifier}</span>}
        </>}
        <label className="check-label"><input type="checkbox" checked={settings.showAI} onChange={e => configure({ showAI: e.target.checked })} />{t.aiLayer}</label>
        <label className="check-label"><input type="checkbox" checked={settings.auto} onChange={e => configure({ auto: e.target.checked })} />{t.consent}</label>
        {model && !model.supportsImageInput && <p className="warning">{t.imageUnsupported}</p>}
        <label className="check-label"><input type="checkbox" checked={settings.voiceEnabled} onChange={e => configure({ voiceEnabled: e.target.checked })} />{t.voice}</label>
        <label>{t.voiceChoice}<select value={voice.voices.some(v => v.voiceURI === settings.voiceURI) ? settings.voiceURI : ''} onChange={e => configure({ voiceURI: e.target.value })}>
          <option value="">{t.choose}</option>{voice.voices.map(v => <option key={v.voiceURI} value={v.voiceURI}>{v.name} ({v.lang})</option>)}</select></label>
        <label>{t.rate} ({settings.rate})<input type="range" min="0.5" max="1.5" step="0.1" value={settings.rate} onChange={e => configure({ rate: Number(e.target.value) })} /></label>
        {voice.warning && <p className="warning" role="alert">{t[voice.warning]}</p>}
        <p className="muted">{t.controlsHelp}</p>
        <p className="privacy">{t.privacy}</p>
      </aside>
      <Rail items={[{ id: 'courses', label: t.courses }, { id: 'ask', label: t.askLabel }, { id: 'materials', label: t.customSources },
        { id: 'exercises', label: t.exercise }, { id: 'history', label: t.history }]}
        active={openPanel} onHover={hoverPanel} onToggle={togglePanel} />
      <aside className={`drawer${openPanel ? ' open' : ''}`}
        onMouseEnter={() => clearTimeout(leaveTimer.current)} onMouseLeave={leavePanel}>
        <section hidden={openPanel !== 'courses'}>
          <CoursesPanel catalog={catalog} mastery={mastery} t={t} locale={settings.locale} onStartLesson={startLesson} activeSkillId={lessonSkillId} onAsk={q => { setPanel('ask'); setPinned(true); ask(q); }} />
        </section>
        <section hidden={openPanel !== 'ask'}>
          <AskPanel t={t} disabled={!canRequest || running} onAsk={ask} />
          <UploadBoard t={t} disabled={!canRequest || !model?.supportsImageInput || running} onUpload={uploadScan} />
        </section>
        <section hidden={openPanel !== 'materials'}>
          <CustomSourcesPanel t={t} sources={sources} onAdd={addCustomSource} onRemove={removeCustomSource} />
        </section>
        <section hidden={openPanel !== 'exercises'}><h2>{t.exercise}</h2><label>{t.exercise}<select value={saved.activeId} onChange={e => switchExercise(e.target.value)}>
          {saved.boards.map((b, i) => <option key={b.id} value={b.id}>{i + 1}. {b.statement.slice(0, 40) || '…'}</option>)}</select></label>
          <div className="row"><button onClick={createExercise}>{t.newExercise}</button><button onClick={deleteExercise}>{t.deleteExercise}</button></div></section>
        <section hidden={openPanel !== 'history'}><h2 className="h2-muted">{t.history}<span className="info-icon" title={t.unverified} aria-label={t.unverified} role="img">ⓘ</span></h2>
          {!board.history.length && <p className="muted">{t.emptyHistory}</p>}
          <ol className="history">{board.history.map(h => <li key={h.id} data-testid="explanation">
            <strong>{t[h.status]}</strong>{h.firstErrorStepId && <small>{t.firstError}: {board.steps.findIndex(s => s.stepId === h.firstErrorStepId) + 1 || '—'}</small>}
            <p>{h.text}</p>{h.clarification && <p>{h.clarification}</p>}<small>{t.revision} {h.revision}</small>
            <button onClick={() => voice.speak(h.ttsText)} disabled={!voice.available}>{t.speak}</button>
          </li>)}</ol>
          <h2 className="h2-muted">{t.annotations}</h2><p className="muted">{t.annotationReveal}</p><ul className="annotations-list">{board.annotations.map((a, i) => <li key={a.id} data-testid="annotation-item">
            <span>{t.aiBadge} {i + 1}</span><button onClick={() => { stop(false); updateBoard(removeAnnotation(board, a.id)); }}>{t.undoAnnotation} {i + 1}</button></li>)}</ul></section>
      </aside>
      {offer && <div className="tutor-bubble" role="group" aria-live="polite" data-testid="tutor-offer">
        <p>{t.tutorOffer.replace('{n}', String(offer.n))}</p>
        <div className="row">
          <button className="primary" disabled={!canRequest || running} onClick={() => { setDismissed(d => new Set(d).add(offer.key)); void request('check'); }}>{t.offerExplain}</button>
          <button disabled={!canRequest || running} onClick={() => { setDismissed(d => new Set(d).add(offer.key)); void request('hint'); }}>{t.offerHint}</button>
          <button onClick={() => setDismissed(d => new Set(d).add(offer.key))}>{t.offerDismiss}</button>
        </div>
      </div>}
      <div className="hud-dock">
        <form className="keyboard-entry" onSubmit={e => { e.preventDefault(); if (line.trim()) { editor.current?.addLine(line.trim(), selectedStep || null); setLine(''); setSelectedStep(''); } }}>
          <label><span className="sr">{t.keyboardLine}</span><input value={line} onChange={e => setLine(e.target.value)} placeholder={t.linePlaceholder} maxLength={1000} /></label>
          <label><span className="sr">{t.steps}</span><select value={selectedStep} onChange={e => { setSelectedStep(e.target.value); setLine(board.steps.find(s => s.stepId === e.target.value)?.latexGuess ?? ''); }}>
            <option value="">{t.newLine}</option>{board.steps.map((s, i) => <option key={s.stepId} value={s.stepId}>{i + 1}. {s.latexGuess || '…'}</option>)}</select></label>
          <button type="submit" disabled={!line.trim()}>{selectedStep ? t.replaceLine : t.addLine}</button>
        </form>
        <div className="manual-controls"><button disabled={!canRequest || !model?.supportsImageInput || !board.activeStepId || running} onClick={() => void request()}>{t.readBoard}</button>{(['check', 'hint', 'next_step', 'explain_differently'] as const).map(mode =>
          <button key={mode} className={mode === 'check' ? 'primary' : ''} disabled={!canRequest || running} onClick={() => void request(mode)}>{t[mode]}</button>)}
          <button className="stop" onClick={() => stop()} disabled={!running && !settings.voiceEnabled}>{t.stop}</button></div>
        <p className="status" role="status">{t[status === 'bridgeUnavailable' ? 'offline' : status]} <small>{t.revision} <output data-testid="revision">{board.revision}</output></small></p>
        {saveError && <p role="alert" className="warning">{t.localSaveError}</p>}
        {rejected && <p role="alert" className="warning">{t.rejectedActions}</p>}
      </div>
    </div>
  </div>;
}
