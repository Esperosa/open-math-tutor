import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import type { CourseCatalog } from '@openmathtutor/shared';
import { CoursesPanel } from './CoursesPanel';
import { cs, en } from '../i18n';

afterEach(cleanup);

const catalog: CourseCatalog = {
  tracks: [{
    id: 'track-1', title: { cs: 'Testovací kurz', en: 'Test track' },
    description: { cs: 'Popis', en: 'Description' }, examFamily: 'custom', topicIds: ['topic-1'],
  }],
  topics: [{ id: 'topic-1', title: { cs: 'Téma 1', en: 'Topic 1' }, skillIds: ['skill-a', 'skill-b'] }],
  skills: [
    { id: 'skill-a', title: { cs: 'Dovednost A', en: 'Skill A' }, prerequisiteSkillIds: [], problemTemplateIds: ['t-a'] },
    { id: 'skill-b', title: { cs: 'Dovednost B', en: 'Skill B' }, prerequisiteSkillIds: ['skill-a'], problemTemplateIds: ['t-b'] },
  ],
  problemTemplates: [
    { id: 't-a', skillId: 'skill-a', difficultyLevel: 1, topic: 'topic-1', statementTemplate: '2+3' },
    { id: 't-b', skillId: 'skill-b', difficultyLevel: 1, topic: 'topic-1', statementTemplate: 'x+1=2' },
  ],
};

describe('CoursesPanel', () => {
  it('walks track -> topic -> skill and starts an unlocked skill', () => {
    const onStartLesson = vi.fn();
    render(<CoursesPanel catalog={catalog} mastery={{}} t={cs} locale="cs" onStartLesson={onStartLesson} activeSkillId={null} />);
    fireEvent.change(screen.getByLabelText(cs.track), { target: { value: 'track-1' } });
    fireEvent.change(screen.getByLabelText(cs.lessonTopic), { target: { value: 'topic-1' } });
    expect(screen.getByText('Dovednost A')).toBeInTheDocument();
    expect(screen.getByText('Dovednost B')).toBeInTheDocument();
    fireEvent.click(screen.getAllByRole('button', { name: cs.startNextSkill })[0]!);
    expect(onStartLesson).toHaveBeenCalledWith(expect.objectContaining({
      skillId: 'skill-a',
      statementText: '2+3',
      curriculumContext: { trackId: 'track-1', topicId: 'topic-1', skillId: 'skill-a', difficultyLevel: 1 },
    }));
  });

  it('locks a skill whose prerequisite is not yet mastered', () => {
    render(<CoursesPanel catalog={catalog} mastery={{}} t={cs} locale="cs" onStartLesson={vi.fn()} activeSkillId={null} />);
    fireEvent.change(screen.getByLabelText(cs.track), { target: { value: 'track-1' } });
    fireEvent.change(screen.getByLabelText(cs.lessonTopic), { target: { value: 'topic-1' } });
    const items = screen.getAllByTestId('skill-item');
    const skillB = items.find(li => li.textContent?.includes('Dovednost B'))!;
    expect(skillB.querySelector('button')).toBeDisabled();
    expect(skillB.textContent).toContain(cs.skillLocked);
  });

  it('shows English track/topic/skill titles when the locale is English, not Czech', () => {
    render(<CoursesPanel catalog={catalog} mastery={{}} t={en} locale="en" onStartLesson={vi.fn()} activeSkillId={null} />);
    expect(screen.getByText('Test track')).toBeInTheDocument();
    expect(screen.queryByText('Testovací kurz')).not.toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(en.track), { target: { value: 'track-1' } });
    expect(screen.getByText('Description')).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText(en.lessonTopic), { target: { value: 'topic-1' } });
    expect(screen.getByText('Skill A')).toBeInTheDocument();
    expect(screen.queryByText('Dovednost A')).not.toBeInTheDocument();
  });

  it('labels a locked skill honestly instead of the contradictory "practice again"', () => {
    render(<CoursesPanel catalog={catalog} mastery={{}} t={cs} locale="cs" onStartLesson={vi.fn()} activeSkillId={null} />);
    fireEvent.change(screen.getByLabelText(cs.track), { target: { value: 'track-1' } });
    fireEvent.change(screen.getByLabelText(cs.lessonTopic), { target: { value: 'topic-1' } });
    const items = screen.getAllByTestId('skill-item');
    const skillB = items.find(li => li.textContent?.includes('Dovednost B'))!;
    expect(skillB.querySelector('button')).toHaveTextContent(cs.skillLocked);
    expect(skillB.querySelector('button')).not.toHaveTextContent(cs.practiceSkill);
  });
});
