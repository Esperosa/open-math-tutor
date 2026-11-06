import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CoursesPanel } from './curriculum/CoursesPanel';
import { catalog } from '@openmathtutor/content';
import { cs } from './i18n';

describe('D14: content, typesetting and courses panel guidance', () => {
  it('renders CoursesPanel guidance when catalog has no tracks or no selection', () => {
    // Empty tracks catalog
    const emptyCatalog = { tracks: [], topics: [], skills: [], problemTemplates: [] };
    const { rerender } = render(
      <CoursesPanel
        catalog={emptyCatalog}
        mastery={{}}
        t={cs}
        locale="cs"
        onStartLesson={() => {}}
        activeSkillId={null}
      />
    );
    expect(screen.getByText(cs.coursesEmptyGuide)).toBeInTheDocument();

    // Catalog with tracks but none chosen yet
    rerender(
      <CoursesPanel
        catalog={catalog}
        mastery={{}}
        t={cs}
        locale="cs"
        onStartLesson={() => {}}
        activeSkillId={null}
      />
    );
    expect(screen.getByText(cs.coursesGuide)).toBeInTheDocument();
  });

  it('all topics and skills in catalog have proper non-empty English translations without Czech characters', () => {
    for (const track of catalog.tracks) {
      expect(track.title.en.length).toBeGreaterThan(0);
      expect(track.title.en).not.toMatch(/[áéíóúýčďěňřšťžů]/i);
    }
    for (const topic of catalog.topics) {
      expect(topic.title.en.length).toBeGreaterThan(0);
      expect(topic.title.en).not.toMatch(/[áéíóúýčďěňřšťžů]/i);
    }
    for (const skill of catalog.skills) {
      expect(skill.title.en.length).toBeGreaterThan(0);
      expect(skill.title.en).not.toMatch(/[áéíóúýčďěňřšťžů]/i);
    }
  });

  it('translates TOPIC_NUMBERS correctly between CS and EN', () => {
    const topic = catalog.topics.find(t => t.id === 'zaklady-cisla');
    expect(topic).toBeDefined();
    expect(topic!.title.cs).toBe('Základy čísel');
    expect(topic!.title.en).toBe('Number basics');
  });
});
