import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { TutorHud } from './TutorHud';
import { messages } from './i18n';
const base = { t: messages.cs, mood: 'idle' as const, speaking: false, menuOpen: false, running: false, canRequest: false,
  lessonActive: false, mode: 'live' as const, voiceOn: false, micAvailable: false, listening: false,
  onToggleMenu: vi.fn(), onMode: vi.fn(), onVoice: vi.fn(), onMic: vi.fn(), onAction: vi.fn(), onChoice: vi.fn() };
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); });
it('reveals a sentence progressively, animates the pencil, and announces the full sentence only once', () => {
  vi.useFakeTimers();
  const message = { id: 'welcome', kind: 'info' as const, text: 'Piš rovnou na tabuli.' };
  const { rerender } = render(<TutorHud {...base} message={message} />);
  expect(screen.getByRole('status')).toHaveTextContent(message.text);
  expect(screen.getByTestId('tutor-typewriter').textContent).toBe('P');
  expect(screen.getByTestId('tutor')).toHaveAttribute('data-writing', 'true');
  act(() => vi.advanceTimersByTime(820));
  const partial = screen.getByTestId('tutor-typewriter').textContent!;
  expect(partial.length).toBeGreaterThan(1); expect(partial.length).toBeLessThan(message.text.length);
  // Parent re-renders must not restart an in-flight sentence.
  rerender(<TutorHud {...base} message={{ ...message }} />);
  expect(screen.getByTestId('tutor-typewriter').textContent).toBe(partial);
  act(() => vi.advanceTimersByTime(2000));
  expect(screen.getByTestId('tutor-typewriter')).toHaveTextContent(message.text);
  expect(screen.getByTestId('tutor')).toHaveAttribute('data-writing', 'false');
  rerender(<TutorHud {...base} message={{ id: 'new', kind: 'info', text: 'Nová věta.' }} />);
  expect(screen.getByTestId('tutor-typewriter').textContent).toBe('N');
});
it('shows the whole greeting immediately with reduced motion and cleans up timers when hidden', () => {
  vi.useFakeTimers();
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const { rerender } = render(<TutorHud {...base} message={{ id: 'hello', kind: 'info', text: 'Ahoj, piš na tabuli.' }} />);
  expect(screen.getByTestId('tutor-typewriter')).toHaveTextContent('Ahoj, piš na tabuli.');
  expect(screen.getByTestId('tutor')).toHaveAttribute('data-writing', 'false');
  rerender(<TutorHud {...base} quiet message={{ id: 'hello', kind: 'info', text: 'Ahoj, piš na tabuli.' }} />);
  expect(screen.queryByTestId('tutor-bubble')).not.toBeInTheDocument();
  expect(vi.getTimerCount()).toBe(0);
});
