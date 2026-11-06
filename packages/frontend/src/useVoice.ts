import { useEffect, useState } from 'react';
import type { Settings } from './storage';
import type { MessageKey } from './i18n';
export function useVoice(settings: Settings) {
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!supported) return;
    const refresh = () => setVoices(speechSynthesis.getVoices().filter(v => v.localService));
    refresh(); speechSynthesis.addEventListener('voiceschanged', refresh);
    return () => { speechSynthesis.removeEventListener('voiceschanged', refresh); speechSynthesis.cancel(); };
  }, [supported]);
  const matching = voices.filter(v => v.lang.toLowerCase().startsWith(settings.locale));
  const chosen = matching.find(v => v.voiceURI === settings.voiceURI) ?? matching[0];
  const warning: MessageKey | null = !supported ? 'voiceUnavailable' : !chosen ? (settings.locale === 'cs' ? 'noCzechVoice' : 'noEnglishVoice') : error ? 'speechError' : null;
  function speak(text: string) {
    if (!supported || !chosen || !text) return;
    speechSynthesis.cancel(); setError(false);
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.voice = chosen; utterance.lang = settings.locale === 'cs' ? 'cs-CZ' : 'en-US'; utterance.rate = settings.rate;
    utterance.onerror = e => { if (e.error !== 'interrupted' && e.error !== 'canceled') setError(true); };
    speechSynthesis.speak(utterance);
  }
  return { voices: matching, warning, available: supported && !!chosen, speak, cancel: () => { if (supported) speechSynthesis.cancel(); } };
}
