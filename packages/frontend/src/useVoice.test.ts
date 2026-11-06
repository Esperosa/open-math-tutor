import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, renderHook } from '@testing-library/react';
import { useVoice } from './useVoice';
import { defaultSettings } from './storage';

const piper = vi.hoisted(() => ({
  stored: vi.fn<() => Promise<string[]>>(),
  download: vi.fn<(id: string, options?: { onProgress?: (loaded: number, total: number) => void }) => Promise<void>>(),
  speak: vi.fn<(text: string, voiceId: string) => Promise<void>>(),
  cancel: vi.fn<() => void>(),
  speaking: null as ((speaking: boolean) => void) | null,
}));

vi.mock('./piperTts', async importOriginal => {
  const actual = await importOriginal<typeof import('./piperTts')>();
  return {
    ...actual,
    storedPiperVoices: () => piper.stored(),
    downloadPiperVoice: (id: string, options?: { onProgress?: (loaded: number, total: number) => void }) => piper.download(id, options),
    speakPiper: (text: string, voiceId: string) => piper.speak(text, voiceId),
    cancelPiperSpeech: () => piper.cancel(),
    onPiperSpeaking: (listener: (speaking: boolean) => void) => {
      piper.speaking = listener;
      return () => { if (piper.speaking === listener) piper.speaking = null; };
    },
    warmAudioContext: vi.fn(),
    warmPiperRuntime: vi.fn(),
  };
});

beforeEach(() => {
  piper.stored.mockReset().mockResolvedValue([]);
  piper.download.mockReset();
  piper.speak.mockReset();
  piper.cancel.mockReset();
  piper.speaking = null;
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

function stubSystemVoices(...voices: Array<{ lang: string; voiceURI: string; name: string; localService: boolean }>) {
  const speak = vi.fn();
  vi.stubGlobal('speechSynthesis', {
    getVoices: () => voices, addEventListener: vi.fn(), removeEventListener: vi.fn(), cancel: vi.fn(), speak,
  });
  return speak;
}

it('warns specifically when local Czech speech is missing and never falls back to another language/cloud voice', () => {
  const speak = stubSystemVoices(
    { lang: 'cs-CZ', voiceURI: 'cloud-cs', name: 'Cloud', localService: false },
    { lang: 'en-US', voiceURI: 'local-en', name: 'English', localService: true },
  );
  const { result } = renderHook(() => useVoice(defaultSettings));
  expect(result.current.warning).toBe('noCzechVoice');
  act(() => result.current.speak('Ahoj')); expect(speak).not.toHaveBeenCalled();
});

it('uses selected local Czech voice, explicit cs-CZ language and chosen rate', () => {
  const voice = { lang: 'cs-CZ', voiceURI: 'local-cs', name: 'Czech', localService: true };
  const speak = stubSystemVoices(voice);
  vi.stubGlobal('SpeechSynthesisUtterance', class { constructor(public text: string) {} });
  const { result } = renderHook(() => useVoice({ ...defaultSettings, voiceURI: 'local-cs', rate: 0.8, tutorVoice: true }));
  expect(result.current.warning).toBe(null);
  act(() => result.current.speak('Odečti tři.'));
  expect(speak).toHaveBeenCalledWith(expect.objectContaining({ text: 'Odečti tři.', lang: 'cs-CZ', rate: 0.8, voice }));
});

it('offers the offline voices as their own group next to the system voices', () => {
  stubSystemVoices({ lang: 'cs-CZ', voiceURI: 'local-cs', name: 'Czech', localService: true });
  const { result } = renderHook(() => useVoice(defaultSettings));
  expect(result.current.systemVoices.map(v => v.voiceURI)).toEqual(['local-cs']);
  expect(result.current.piperVoices.map(v => v.voiceURI)).toEqual(['piper:cs_CZ-jirka-medium']);
  expect(result.current.voices.map(v => v.voiceURI)).toEqual(['local-cs', 'piper:cs_CZ-jirka-medium']);
  expect(result.current.piper.status).toBe('hidden');
});

it('holds a selected offline voice back until it has been downloaded', async () => {
  stubSystemVoices({ lang: 'cs-CZ', voiceURI: 'local-cs', name: 'Czech', localService: true });
  const { result } = renderHook(() => useVoice({ ...defaultSettings, voiceURI: 'piper:cs_CZ-jirka-medium' }));
  await act(async () => {});
  expect(result.current.piper.status).toBe('idle');
  expect(result.current.warning).toBe('piperDownloadNeeded');
  expect(result.current.available).toBe(false);
});

it('downloads the selected offline voice with progress and counts it as ready', async () => {
  stubSystemVoices({ lang: 'cs-CZ', voiceURI: 'local-cs', name: 'Czech', localService: true });
  let finish: (() => void) | undefined;
  piper.download.mockImplementation((_id, options) => {
    options?.onProgress?.(31_603_207, 63_206_414);
    return new Promise<void>(resolve => { finish = resolve; });
  });
  const { result } = renderHook(() => useVoice({ ...defaultSettings, voiceURI: 'piper:cs_CZ-jirka-medium' }));
  await act(async () => {});
  act(() => result.current.piper.start());
  expect(piper.download).toHaveBeenCalledWith('cs_CZ-jirka-medium', expect.objectContaining({ expectedBytes: 63_206_414 }));
  expect(result.current.piper.status).toBe('downloading');
  expect(result.current.piper.loaded).toBe(31_603_207);
  expect(result.current.warning).toBe('piperDownloadNeeded');

  await act(async () => { finish?.(); await Promise.resolve(); });
  expect(result.current.piper.status).toBe('ready');
  expect(result.current.available).toBe(true);
  expect(result.current.warning).toBe(null);
});

it('lets the user stop a running download', async () => {
  piper.download.mockImplementation(() => new Promise<void>(() => {}));
  const { result } = renderHook(() => useVoice({ ...defaultSettings, voiceURI: 'piper:cs_CZ-jirka-medium' }));
  await act(async () => {});
  act(() => result.current.piper.start());
  expect(result.current.piper.status).toBe('downloading');
  act(() => result.current.piper.cancel());
  expect(result.current.piper.status).toBe('idle');
});

it('reports a failed download so the user can try again', async () => {
  piper.download.mockRejectedValue(new TypeError('Failed to fetch'));
  const { result } = renderHook(() => useVoice({ ...defaultSettings, voiceURI: 'piper:cs_CZ-jirka-medium' }));
  await act(async () => {});
  act(() => result.current.piper.start());
  await act(async () => { await Promise.resolve(); });
  expect(result.current.piper.status).toBe('error');
  expect(result.current.piper.error).toBe('piperDownloadFailed');
  expect(result.current.piper.voice?.id).toBe('cs_CZ-jirka-medium');
});

it('speaks with the offline voice once its model is stored, never through the system engine', async () => {
  piper.stored.mockResolvedValue(['cs_CZ-jirka-medium']);
  piper.speak.mockResolvedValue(undefined);
  const systemSpeak = stubSystemVoices({ lang: 'cs-CZ', voiceURI: 'local-cs', name: 'Czech', localService: true });
  const { result } = renderHook(() => useVoice({ ...defaultSettings, voiceURI: 'piper:cs_CZ-jirka-medium', tutorVoice: true }));
  await act(async () => {});
  expect(result.current.available).toBe(true);
  act(() => result.current.speak('Ahoj'));
  await act(async () => { await Promise.resolve(); });
  expect(piper.speak).toHaveBeenCalledWith('Ahoj', 'cs_CZ-jirka-medium');
  expect(systemSpeak).not.toHaveBeenCalled();
});

it('switches back to the system voice when the offline voice cannot play', async () => {
  const { PiperError } = await import('./piperTts');
  piper.stored.mockResolvedValue(['cs_CZ-jirka-medium']);
  piper.speak.mockRejectedValue(new PiperError('offline'));
  stubSystemVoices({ lang: 'cs-CZ', voiceURI: 'local-cs', name: 'Czech', localService: true });
  const onVoiceChange = vi.fn();
  const { result } = renderHook(() => useVoice(
    { ...defaultSettings, voiceURI: 'piper:cs_CZ-jirka-medium', tutorVoice: true },
    onVoiceChange,
  ));
  await act(async () => {});
  act(() => result.current.speak('Ahoj'));
  await act(async () => { await Promise.resolve(); await Promise.resolve(); });
  expect(result.current.warning).toBe('piperOffline');
  expect(onVoiceChange).toHaveBeenCalledWith('');
});

it('stops both engines when the tutor is told to be quiet', async () => {
  piper.stored.mockResolvedValue(['cs_CZ-jirka-medium']);
  stubSystemVoices({ lang: 'cs-CZ', voiceURI: 'local-cs', name: 'Czech', localService: true });
  const { result } = renderHook(() => useVoice({ ...defaultSettings, voiceURI: 'piper:cs_CZ-jirka-medium' }));
  await act(async () => {});
  act(() => result.current.cancel());
  expect(piper.cancel).toHaveBeenCalled();
  expect(result.current.speaking).toBe(false);
});
