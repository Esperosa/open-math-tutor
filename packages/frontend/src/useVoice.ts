import { useEffect, useRef, useState } from 'react';
import type { Settings } from './storage';
import type { MessageKey } from './i18n';
export function useVoice(settings: Settings) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  useEffect(() => {
    if (!supported) return;
    const refresh = () => setVoices(speechSynthesis.getVoices().filter(v => v.localService));
    refresh(); speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => { speechSynthesis.removeEventListener('voiceschanged', refresh); speechSynthesis.cancel(); };
  }, [supported]);
  const matching = voices.filter(v => v.lang.toLowerCase().startsWith(settings.locale));
  const chosen = matching.find(v => v.voiceURI === settings.voiceURI) ?? matching[0];
  const warning: MessageKey | null = !supported ? 'voiceUnavailable' : !chosen ? (settings.locale === 'cs' ? 'noCzechVoice' : 'noEnglishVoice') : error ? 'speechError' : null;
  /** `force` is for an explicit click on a "read aloud" button; automatic tutor comments obey the tutor-voice setting. */
  function speak(text: string, force = false) {
    if (!supported || !chosen || !text || (!force && !settings.tutorVoice)) return;
    speechSynthesis.cancel(); setError(false);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = chosen; utterance.lang = settings.locale === 'cs' ? 'cs-CZ' : 'en-US'; utterance.rate = settings.rate;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = e => { setSpeaking(false); if (e.error !== 'interrupted' && e.error !== 'canceled') setError(true); };
    speechSynthesis.speak(utterance);
  }
  return { voices: matching, warning, available: supported && !!chosen, speaking, speak,
    cancel: () => { if (supported) speechSynthesis.cancel(); setSpeaking(false); } };
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
