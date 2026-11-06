import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import { TutorHud } from './TutorHud';
import { messages } from './i18n';
const base = { t: messages.cs, mood: 'idle' as const, speaking: false, menuOpen: false, running: false, canRequest: false,
  lessonActive: false, mode: 'live' as const, voiceOn: false, micAvailable: false, listening: false,
  onToggleMenu: vi.fn(), onMode: vi.fn(), onVoice: vi.fn(), onMic: vi.fn(), onAction: vi.fn(), onChoice: vi.fn() };
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
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
it('keeps all actions disabled through the return transition and cancels a visit when a panel opens', () => {
  vi.useFakeTimers();
  vi.stubGlobal('innerWidth', 1440); vi.stubGlobal('innerHeight', 1000);
  vi.spyOn(HTMLElement.prototype, 'offsetLeft', 'get').mockReturnValue(1104);
  vi.spyOn(HTMLElement.prototype, 'offsetTop', 'get').mockReturnValue(700);
  vi.spyOn(HTMLElement.prototype, 'offsetWidth', 'get').mockReturnValue(320);
  vi.spyOn(HTMLElement.prototype, 'offsetHeight', 'get').mockReturnValue(200);
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (this: HTMLElement) {
    const match = /translate\((-?[\d.]+)px, (-?[\d.]+)px\)/.exec(this.style.transform);
    const x = 1104 + Number(match?.[1] ?? 0), y = 700 + Number(match?.[2] ?? 0);
    return { x, y, width: 320, height: 200, left: x, right: x + 320, top: y, bottom: y + 200, toJSON: () => ({}) };
  });
  const locateStep = () => ({ x: 560, y: 350, width: 160, height: 32 });
  const message = { id: 'row', kind: 'wrong' as const, text: 'Chyba.', stepId: 'line-1' };
  const { rerender } = render(<TutorHud {...base} locateStep={locateStep} message={message} />);
  expect(screen.getByTestId('tutor-hud')).toHaveAttribute('data-visiting', 'true');
  expect(screen.getByRole('button', { name: 'Učitel' })).toBeDisabled();
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByTestId('tutor-hud')).toHaveAttribute('data-returning', 'true');
  expect(screen.getByRole('button', { name: 'Učitel' })).toBeDisabled();
  act(() => vi.advanceTimersByTime(700));
  expect(screen.getByRole('button', { name: 'Učitel' })).toBeEnabled();
  rerender(<TutorHud {...base} locateStep={locateStep} message={{ ...message, id: 'new' }} />);
  expect(screen.getByTestId('tutor-hud')).toHaveAttribute('data-visiting', 'true');
  rerender(<TutorHud {...base} quiet locateStep={locateStep} message={{ ...message, id: 'new' }} />);
  expect(screen.getByTestId('tutor-hud')).toHaveAttribute('data-visiting', 'false');
  expect(vi.getTimerCount()).toBe(0);
});
it('offers local, AI-free hint and retry buttons on a wrong line even when no AI is available', () => {
  vi.useFakeTimers();
  const onChoice = vi.fn();
  render(<TutorHud {...base} canRequest={false} onChoice={onChoice} message={{ id: 'w', kind: 'wrong', text: 'Chyba.', stepId: 'line-1' }} />);
  act(() => vi.advanceTimersByTime(4000));
  screen.getByRole('button', { name: messages.cs.offerRetryLine }).click();
  screen.getByRole('button', { name: messages.cs.offerLocalHint }).click();
  expect(onChoice.mock.calls.map(c => c[0])).toEqual(['retry_line', 'local_hint']);
  expect(screen.getByRole('button', { name: messages.cs.offerHint })).toBeDisabled();
});
