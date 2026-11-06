import { useEffect, useRef, useState } from 'react';
import type { Settings } from './storage';
import type { MessageKey } from './i18n';
import { estimateBytes, piperOption, piperVoiceByUri, piperVoicesFor, type PiperVoice, type VoiceOption } from './piperVoices';
import {
  cancelPiperSpeech, classifyPiperError, downloadPiperVoice, isAbortError,
  onPiperSpeaking, speakPiper, storedPiperVoices, warmAudioContext, warmPiperRuntime,
} from './piperTts';

export interface PiperVoiceState {
  /** The offline voice picked in Settings, or null when a system voice is selected. */
  voice: PiperVoice | null;
  status: 'hidden' | 'idle' | 'downloading' | 'ready' | 'error';
  loaded: number;
  total: number;
  error: MessageKey | null;
  start(): void;
  cancel(): void;
}

/** `onVoiceChange('')` sends a failed offline voice back to the system voice. */
export function useVoice(settings: Settings, onVoiceChange?: (voiceURI: string) => void) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState<MessageKey | null>(null);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!supported) return;
    const refresh = () => setVoices(speechSynthesis.getVoices().filter(v => v.localService || settings.onlineVoices));
    refresh(); speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => { speechSynthesis.removeEventListener('voiceschanged', refresh); speechSynthesis.cancel(); };
  }, [supported, settings.onlineVoices]);
  // The offline engine reports the same speaking flag, so the mascot's mouth moves identically.
  useEffect(() => onPiperSpeaking(setSpeaking), []);
  useEffect(() => () => cancelPiperSpeech(), []);
  useEffect(() => {
    const warm = () => { warmAudioContext(); window.removeEventListener('pointerdown', warm); window.removeEventListener('keydown', warm); };
    window.addEventListener('pointerdown', warm);
    window.addEventListener('keydown', warm);
    return () => { window.removeEventListener('pointerdown', warm); window.removeEventListener('keydown', warm); };
  }, []);

  const matching = voices.filter(v => v.lang.toLowerCase().startsWith(settings.locale));
  // Prefer natural/neural voices when nothing was picked explicitly.
  const quality = (v: SpeechSynthesisVoice) => /natural|neural|online|premium|enhanced/i.test(v.name) ? 0 : v.localService ? 1 : 2;
  const sorted = [...matching].sort((a, b) => quality(a) - quality(b));
  const systemChosen = matching.find(v => v.voiceURI === settings.voiceURI) ?? sorted[0];

  const availablePiperVoices = piperVoicesFor(settings.locale);
  const piperVoice = piperVoiceByUri(settings.voiceURI, settings.locale);

  const [storedIds, setStoredIds] = useState<string[]>([]);
  const [download, setDownload] = useState<{ status: 'idle' | 'downloading' | 'error'; loaded: number; error: MessageKey | null }>({ status: 'idle', loaded: 0, error: null });
  const downloadAbort = useRef<AbortController | null>(null);
  const lastProgress = useRef(0);

  useEffect(() => { void storedPiperVoices().then(setStoredIds).catch(() => {}); }, []);
  // Moving the selection to another voice starts its download card from scratch.
  useEffect(() => {
    downloadAbort.current?.abort();
    downloadAbort.current = null;
    setDownload({ status: 'idle', loaded: 0, error: null });
  }, [piperVoice?.id]);

  const piperReady = !!piperVoice && storedIds.includes(piperVoice.id);

  function startDownload() {
    const voice = piperVoice;
    if (!voice || piperReady || download.status === 'downloading') return;
    const controller = new AbortController();
    downloadAbort.current = controller;
    setDownload({ status: 'downloading', loaded: 0, error: null });
    const total = estimateBytes(voice);
    void downloadPiperVoice(voice.id, {
      signal: controller.signal,
      expectedBytes: total,
      onProgress: loaded => {
        // Chunks arrive far faster than anyone can read them; repaint a few times a second.
        if (Date.now() - lastProgress.current < 200 && loaded < total) return;
        lastProgress.current = Date.now();
        setDownload(current => current.status === 'downloading' ? { ...current, loaded } : current);
      },
    }).then(() => {
      setStoredIds(ids => ids.includes(voice.id) ? ids : [...ids, voice.id]);
      setDownload({ status: 'idle', loaded: 0, error: null });
      warmPiperRuntime();
    }).catch((failure: unknown) => {
      if (isAbortError(failure) || controller.signal.aborted) setDownload({ status: 'idle', loaded: 0, error: null });
      else setDownload({ status: 'error', loaded: 0, error: 'piperDownloadFailed' });
    }).finally(() => { if (downloadAbort.current === controller) downloadAbort.current = null; });
  }

  function cancelDownload() {
    downloadAbort.current?.abort();
    downloadAbort.current = null;
    setDownload(current => current.status === 'downloading' ? { ...current, status: 'idle', loaded: 0 } : current);
  }

  /** `force` is for an explicit click on a "read aloud" button; automatic tutor comments obey the tutor-voice setting. */
  function speak(text: string, force = false) {
    if (!supported && !(piperVoice && piperReady)) return;
    if (!text || (!force && !settings.tutorVoice)) return;
    cancel();
    setError(null);
    // An offline voice only speaks once its model has been downloaded explicitly — no silent swap to another voice.
    if (piperVoice) {
      if (!piperReady) return;
      void speakPiper(text, piperVoice.id).catch((failure: unknown) => {
        if (isAbortError(failure)) return;
        const kind = classifyPiperError(failure);
        setError(kind === 'offline' ? 'piperOffline' : kind === 'memory' ? 'piperMemory' : 'piperFailed');
        onVoiceChange?.('');
      });
      return;
    }
    if (!systemChosen) return;
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = systemChosen; utterance.lang = settings.locale === 'cs' ? 'cs-CZ' : 'en-US'; utterance.rate = settings.rate;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = e => { setSpeaking(false); if (e.error !== 'interrupted' && e.error !== 'canceled') setError('speechError'); };
    speechSynthesis.speak(utterance);
  }

  function cancel() {
    cancelPiperSpeech();
    if (supported) speechSynthesis.cancel();
    setSpeaking(false);
  }

  const systemOptions: VoiceOption[] = sorted.map(v => ({ voiceURI: v.voiceURI, name: v.name, lang: v.lang }));
  const piperOptions: VoiceOption[] = availablePiperVoices.map(piperOption);
  const warning: MessageKey | null = error
    ?? (piperVoice && !piperReady ? 'piperDownloadNeeded' : null)
    ?? (!supported ? 'voiceUnavailable' : !systemChosen ? (settings.locale === 'cs' ? 'noCzechVoice' : 'noEnglishVoice') : null);
  const piper: PiperVoiceState = {
    voice: piperVoice,
    status: !piperVoice ? 'hidden' : piperReady ? 'ready' : download.status,
    loaded: download.loaded,
    total: piperVoice ? estimateBytes(piperVoice) : 0,
    error: download.error,
    start: startDownload,
    cancel: cancelDownload,
  };
  return { voices: [...systemOptions, ...piperOptions], systemVoices: systemOptions, piperVoices: piperOptions,
    piper, warning, available: piperVoice ? piperReady : supported && !!systemChosen, speaking, speak, cancel };
}

interface RecognitionResult { results: ArrayLike<ArrayLike<{ transcript: string }>> }
interface Recognition {
  lang: string; interimResults: boolean; maxAlternatives: number;
  onresult: ((e: RecognitionResult) => void) | null; onend: (() => void) | null; onerror: (() => void) | null;
  start(): void; stop(): void;
}
type RecognitionCtor = new () => Recognition;

/** Push-to-talk through the browser's own speech recognition. Hidden where the browser has none (no model download, no cloud key). */
export function useMic(locale: Settings['locale']) {
  const w = typeof window === 'undefined' ? undefined : window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  const Ctor = w?.SpeechRecognition ?? w?.webkitSpeechRecognition;
  const [listening, setListening] = useState(false);
  const active = useRef<Recognition | null>(null);
  useEffect(() => () => { active.current?.stop(); }, []);
  function toggle(onText: (text: string) => void) {
    if (!Ctor) return;
    if (active.current) { active.current.stop(); return; }
    const rec = new Ctor();
    rec.lang = locale === 'cs' ? 'cs-CZ' : 'en-US'; rec.interimResults = false; rec.maxAlternatives = 1;
    rec.onresult = e => { const text = e.results[0]?.[0]?.transcript?.trim(); if (text) onText(text); };
    rec.onend = () => { active.current = null; setListening(false); };
    rec.onerror = () => { active.current = null; setListening(false); };
    active.current = rec; setListening(true); rec.start();
  }
  return { available: !!Ctor, listening, toggle };
}
