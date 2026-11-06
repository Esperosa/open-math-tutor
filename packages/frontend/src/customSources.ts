import { chunkText, type TextChunk } from '@openmathtutor/shared';

export interface CustomSource { id: string; title: string; addedAt: number; chunks: TextChunk[] }

const KEY = 'openmathtutor.sources.v1';
export const MAX_SOURCES = 20;

function isTextChunk(value: unknown): value is TextChunk {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.sourceId === 'string' && typeof v.sourceTitle === 'string'
    && Number.isSafeInteger(v.chunkIndex) && typeof v.text === 'string';
}

function isCustomSource(value: unknown): value is CustomSource {
  if (typeof value !== 'object' || value === null) return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === 'string' && typeof v.title === 'string' && Number.isSafeInteger(v.addedAt)
    && Array.isArray(v.chunks) && v.chunks.every(isTextChunk);
}

export function loadSources(): CustomSource[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter(isCustomSource) : [];
  } catch {
    return [];
  }
}

export function saveSources(sources: CustomSource[]): boolean {
  try { localStorage.setItem(KEY, JSON.stringify(sources)); return true; } catch { return false; }
}

export function addSource(sources: CustomSource[], title: string, text: string): CustomSource[] {
  const id = crypto.randomUUID();
  const chunks = chunkText(id, title.slice(0, 200), text);
  const source: CustomSource = { id, title: title.slice(0, 200), addedAt: Date.now(), chunks };
  return [...sources, source].slice(-MAX_SOURCES);
}

export function removeSource(sources: CustomSource[], id: string): CustomSource[] {
  return sources.filter(s => s.id !== id);
}

export function allChunks(sources: CustomSource[]): TextChunk[] {
  return sources.flatMap(s => s.chunks);
}
