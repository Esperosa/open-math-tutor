import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useVoice } from './useVoice';
import { defaultSettings } from './storage';
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
it('warns specifically when local Czech speech is missing and never falls back to another language/cloud voice', () => {
  const speak = vi.fn();
  vi.stubGlobal('speechSynthesis', { getVoices: () => [
    { lang: 'cs-CZ', voiceURI: 'cloud-cs', name: 'Cloud', localService: false },
    { lang: 'en-US', voiceURI: 'local-en', name: 'English', localService: true },
  ], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), speak });
  const { result } = renderHook(() => useVoice(defaultSettings));
  expect(result.current.warning).toBe('noCzechVoice');
  act(() => result.current.speak('Ahoj')); expect(speak).not.toHaveBeenCalled();
});
it('uses selected local Czech voice, explicit cs-CZ language and chosen rate', () => {
  const voice = { lang: 'cs-CZ', voiceURI: 'local-cs', name: 'Czech', localService: true };
  const speak = vi.fn();
  vi.stubGlobal('speechSynthesis', { getVoices: () => [voice], addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), speak });
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  const { result } = renderHook(() => useVoice({ ...defaultSettings, voiceURI: 'local-cs', rate: 0.8 }));
  expect(result.current.warning).toBe(null);
  act(() => result.current.speak('Odečti tři.'));
  expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Odečti tři.', lang: 'cs-CZ', rate: 0.8, voice }));
});
