import { afterEach, describe, expect, it } from 'vitest';
import { createMasteryState } from '@openmathtutor/shared';
import { loadMastery, saveMastery, getOrCreateMastery } from './curriculumStorage';

afterEach(() => localStorage.clear());

describe('curriculumStorage', () => {
  it('round-trips a mastery map through localStorage', () => {
    const state = createMasteryState('skill-1', 1000);
    expect(saveMastery({ 'skill-1': state })).toBe(true);
    expect(loadMastery()).toEqual({ 'skill-1': state });
  });

  it('returns an empty map when nothing is stored', () => {
    expect(loadMastery()).toEqual({});
  });

  it('ignores corrupted storage instead of throwing', () => {
    localStorage.setItem('openmathtutor.mastery.v1', '{not valid json');
    expect(loadMastery()).toEqual({});
  });

  it('drops malformed entries but keeps valid ones', () => {
    const good = createMasteryState('skill-good', 1000);
    localStorage.setItem('openmathtutor.mastery.v1', JSON.stringify({ 'skill-good': good, 'skill-bad': { nonsense: true } }));
    expect(loadMastery()).toEqual({ 'skill-good': good });
  });

  it('creates a fresh state for a skill with no recorded attempt', () => {
    const created = getOrCreateMastery({}, 'skill-new', 500);
    expect(created.skillId).toBe('skill-new');
    expect(created.attempts).toBe(0);
  });

  it('returns the existing state when one is already recorded', () => {
    const existing = { ...createMasteryState('skill-1', 0), attempts: 3 };
    expect(getOrCreateMastery({ 'skill-1': existing }, 'skill-1', 999)).toBe(existing);
  });
});
