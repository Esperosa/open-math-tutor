/**
 * Minimal lexical (TF-IDF) retrieval over locally-chunked text, used for the
 * NotebookLM-style "custom course from my own sources" feature. Deliberately
 * not a neural-embedding retriever: it needs no model download, no API call,
 * and no extra runtime dependency, which matches the project's
 * bring-your-own-subscription / minimal-dependency stance. It is a ranking
 * aid only — the matched chunk text is handed to the provider as context,
 * never treated as a verified mathematical fact by itself.
 */

export interface TextChunk {
  sourceId: string;
  sourceTitle: string;
  chunkIndex: number;
  text: string;
}

export interface ScoredChunk extends TextChunk {
  score: number;
}

const STOPWORDS = new Set([
  "a", "the", "is", "are", "of", "to", "in", "on", "for", "and", "or", "it",
  "se", "je", "na", "do", "pro", "a", "je", "to", "že", "s", "k", "v", "o", "z",
]);

function tokenize(text: string): string[] {
  return (text.toLowerCase().match(/[a-zá-žα-ωA-ZÁ-Ž0-9]+/gu) ?? []).filter(
    t => t.length > 1 && !STOPWORDS.has(t),
  );
}

/** Splits `text` into overlapping chunks of roughly `targetWords` words each. */
export function chunkText(sourceId: string, sourceTitle: string, text: string, targetWords = 180): TextChunk[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [];
  const chunks: TextChunk[] = [];
  const overlap = Math.floor(targetWords * 0.15);
  let start = 0;
  let chunkIndex = 0;
  while (start < words.length) {
    const end = Math.min(start + targetWords, words.length);
    chunks.push({ sourceId, sourceTitle, chunkIndex, text: words.slice(start, end).join(" ") });
    chunkIndex++;
    if (end >= words.length) break;
    start = end - overlap;
  }
  return chunks;
}

/** Ranks `chunks` against `query` using TF-IDF cosine-ish scoring; returns the top `topK`. */
export function retrieveTopChunks(chunks: readonly TextChunk[], query: string, topK = 5): ScoredChunk[] {
  if (chunks.length === 0) return [];
  const queryTerms = tokenize(query);
  if (queryTerms.length === 0) return [];

  const docTermCounts = chunks.map(c => {
    const counts = new Map<string, number>();
    for (const term of tokenize(c.text)) counts.set(term, (counts.get(term) ?? 0) + 1);
    return counts;
  });

  const docFrequency = new Map<string, number>();
  for (const term of new Set(queryTerms)) {
    let count = 0;
    for (const doc of docTermCounts) if (doc.has(term)) count++;
    docFrequency.set(term, count);
  }

  const scored = chunks.map((chunk, i) => {
    const counts = docTermCounts[i]!;
    const totalTerms = Array.from(counts.values()).reduce((a, b) => a + b, 0) || 1;
    let score = 0;
    for (const term of queryTerms) {
      const termFrequency = (counts.get(term) ?? 0) / totalTerms;
      const docFreq = docFrequency.get(term) ?? 0;
      const idf = Math.log((chunks.length + 1) / (docFreq + 1)) + 1;
      score += termFrequency * idf;
    }
    return { ...chunk, score };
  });

  return scored
    .filter(c => c.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}
