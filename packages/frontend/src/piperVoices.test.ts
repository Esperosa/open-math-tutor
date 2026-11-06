import { describe, expect, it } from 'vitest';
import {
  downloadPercent, estimateBytes, formatSize, isPiperUri, PIPER_CONFIG_BYTES,
  PIPER_URI_PREFIX, PIPER_VOICES, piperOption, piperVoiceByUri, piperVoicesFor,
} from './piperVoices';

describe('piper voice catalog', () => {
  it('offers the four voices with unique ids and a size for every one', () => {
    expect(PIPER_VOICES.map(v => v.id)).toEqual(['cs_CZ-jirka-medium', 'en_US-lessac-medium', 'en_US-amy-medium', 'en_GB-alba-medium']);
    expect(new Set(PIPER_VOICES.map(v => v.id)).size).toBe(PIPER_VOICES.length);
    for (const voice of PIPER_VOICES) expect(voice.sizeBytes).toBeGreaterThan(0);
  });

  it('counts the config sidecar on top of the model', () => {
    const [voice] = PIPER_VOICES;
    expect(estimateBytes(voice)).toBe(voice.sizeBytes + PIPER_CONFIG_BYTES);
    expect(estimateBytes(voice)).toBeGreaterThan(60 * 1024 * 1024);
  });

  it('splits voices by locale so a stale selection never counts as ready', () => {
    expect(piperVoicesFor('cs').map(v => v.id)).toEqual(['cs_CZ-jirka-medium']);
    expect(piperVoicesFor('en').map(v => v.id)).toEqual(['en_US-lessac-medium', 'en_US-amy-medium', 'en_GB-alba-medium']);
    expect(piperVoiceByUri(`${PIPER_URI_PREFIX}cs_CZ-jirka-medium`, 'cs')?.name).toBe('Jirka');
    expect(piperVoiceByUri(`${PIPER_URI_PREFIX}cs_CZ-jirka-medium`, 'en')).toBeNull();
    expect(piperVoiceByUri(`${PIPER_URI_PREFIX}nope`, 'cs')).toBeNull();
    expect(piperVoiceByUri('local-cs', 'cs')).toBeNull();
  });

  it('recognises only its own namespace and renders options with it', () => {
    expect(isPiperUri(`${PIPER_URI_PREFIX}en_US-amy-medium`)).toBe(true);
    expect(isPiperUri('Microsoft Jirka')).toBe(false);
    expect(piperOption(PIPER_VOICES[0])).toEqual({
      voiceURI: `${PIPER_URI_PREFIX}cs_CZ-jirka-medium`, name: 'Jirka', lang: 'cs-CZ',
    });
  });
});

describe('download progress and sizes', () => {
  it('reports whole percentages only while a total is known', () => {
    expect(downloadPercent(0, 100)).toBe(0);
    expect(downloadPercent(31, 100)).toBe(31);
    expect(downloadPercent(50, 100)).toBe(50);
    expect(downloadPercent(200, 100)).toBe(100);
    expect(downloadPercent(5, 0)).toBe(0);
    expect(downloadPercent(-5, 100)).toBe(0);
    expect(downloadPercent(Number.NaN, 100)).toBe(0);
  });

  it('formats megabytes with a decimal comma in Czech and a point in English', () => {
    const model = PIPER_VOICES[0].sizeBytes;
    expect(formatSize(model, 'cs')).toBe('60,3 MB');
    expect(formatSize(model, 'en')).toBe('60.3 MB');
    expect(formatSize(5 * 1024 * 1024, 'en')).toBe('5.0 MB');
    expect(formatSize(5 * 1024 * 1024, 'cs')).toBe('5,0 MB');
    expect(formatSize(150 * 1024 * 1024, 'en')).toBe('150 MB');
    expect(formatSize(150 * 1024 * 1024, 'cs')).toBe('150 MB');
  });
});
