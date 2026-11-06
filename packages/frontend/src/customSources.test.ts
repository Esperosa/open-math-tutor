import { afterEach, describe, expect, it } from 'vitest';
import { loadSources, saveSources, addSource, removeSource, allChunks, MAX_SOURCES } from './customSources';

afterEach(() => localStorage.clear());

describe('customSources', () => {
  it('adds a source and chunks its text', () => {
    const next = addSource([], 'My notes.txt', 'Linear equations isolate the variable by moving terms to the other side.');
    expect(next).toHaveLength(1);
    expect(next[0]!.title).toBe('My notes.txt');
    expect(next[0]!.chunks.length).toBeGreaterThan(0);
    expect(next[0]!.chunks[0]!.sourceTitle).toBe('My notes.txt');
  });

  it('round-trips through localStorage', () => {
    const sources = addSource([], 'Notes', 'Some text about fractions and percentages.');
    expect(saveSources(sources)).toBe(true);
    expect(loadSources()).toEqual(sources);
  });

  it('ignores corrupted storage', () => {
    localStorage.setItem('openmathtutor.sources.v1', 'not json');
    expect(loadSources()).toEqual([]);
  });

  it('removes a source by id', () => {
    const sources = addSource([], 'Notes', 'Some text.');
    const id = sources[0]!.id;
    expect(removeSource(sources, id)).toHaveLength(0);
  });

  it('caps the number of retained sources', () => {
    let sources = [] as ReturnType<typeof addSource>;
    for (let i = 0; i < MAX_SOURCES + 5; i++) sources = addSource(sources, `Source ${i}`, 'Some text here.');
    expect(sources).toHaveLength(MAX_SOURCES);
    expect(sources[0]!.title).toBe(`Source ${5}`);
  });

  it('flattens chunks across all sources', () => {
    const sources = addSource(addSource([], 'A', 'Text about equations.'), 'B', 'Text about fractions.');
    expect(allChunks(sources).length).toBe(sources[0]!.chunks.length + sources[1]!.chunks.length);
  });
});
