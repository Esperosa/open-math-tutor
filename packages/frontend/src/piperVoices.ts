import type { Locale } from '@openmathtutor/shared';

/** Offline Piper voices get their own URI namespace so they never collide with speechSynthesis voiceURIs. */
export const PIPER_URI_PREFIX = 'piper:';
/** Size of the `.onnx.json` sidecar that ships next to every model; only used for the pre-download hint. */
export const PIPER_CONFIG_BYTES = 5120;

export interface PiperVoice {
  id: string;
  name: string;
  lang: string;
  locale: Locale;
  /** `.onnx` size in bytes from the package's own voices() catalog. */
  sizeBytes: number;
}

/** Shape App.tsx needs from both engines: speechSynthesis voices satisfy it as they are. */
export interface VoiceOption { voiceURI: string; name: string; lang: string }

/**
 * The voices offered in Nastavení → Hlas. Every id was checked against `tts.voices()`
 * from @diffusionstudio/vits-web 1.0.3 (124 catalog entries) and is a key of its
 * `PATH_MAP`; sizeBytes comes from that same catalog (verified by HTTP HEAD as well).
 * The catalog is a copy of the rhasspy/piper-voices layout, so model cards there apply.
 */
export const PIPER_VOICES: readonly PiperVoice[] = [
  { id: 'cs_CZ-jirka-medium', name: 'Jirka', lang: 'cs-CZ', locale: 'cs', sizeBytes: 63_201_294 },
  { id: 'en_US-lessac-medium', name: 'Lessac', lang: 'en-US', locale: 'en', sizeBytes: 63_201_294 },
  { id: 'en_US-amy-medium', name: 'Amy', lang: 'en-US', locale: 'en', sizeBytes: 63_201_294 },
  { id: 'en_GB-alba-medium', name: 'Alba', lang: 'en-GB', locale: 'en', sizeBytes: 63_201_294 },
];

/** Model plus its config sidecar, i.e. what the download bar counts. */
export function estimateBytes(voice: PiperVoice): number {
  return voice.sizeBytes + PIPER_CONFIG_BYTES;
}

export function piperVoicesFor(locale: Locale): PiperVoice[] {
  return PIPER_VOICES.filter(v => v.locale === locale);
}

export function isPiperUri(uri: string): boolean {
  return uri.startsWith(PIPER_URI_PREFIX);
}

export function piperOption(voice: PiperVoice): VoiceOption {
  return { voiceURI: PIPER_URI_PREFIX + voice.id, name: voice.name, lang: voice.lang };
}

/** Only voices that belong to the current locale count as selected, so a stale URI silently falls back to the system voice. */
export function piperVoiceByUri(uri: string, locale: Locale): PiperVoice | null {
  if (!isPiperUri(uri)) return null;
  const id = uri.slice(PIPER_URI_PREFIX.length);
  return piperVoicesFor(locale).find(v => v.id === id) ?? null;
}

export function formatSize(bytes: number, locale: Locale): string {
  const mb = bytes / (1024 * 1024);
  const rounded = mb >= 100 ? mb.toFixed(0) : mb.toFixed(1);
  return `${locale === 'cs' ? rounded.replace('.', ',') : rounded} MB`;
}

export function downloadPercent(loaded: number, total: number): number {
  if (!Number.isFinite(total) || !(total > 0) || !Number.isFinite(loaded)) return 0;
  return Math.max(0, Math.min(100, Math.round((loaded / total) * 100)));
}
