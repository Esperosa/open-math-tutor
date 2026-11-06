import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { BoardActivity, PEN_PAUSE_MS } from './activity';
import { useSettledValue } from './settled';
import { useTween } from './useTween';
import { Tutor, type TutorMood } from './Tutor';
import { TutorHud } from './TutorHud';
import { ChatPanel, type ChatProps } from './chat/ChatPanel';
import { chatMessages } from './chat/messages';
import { messages } from './i18n';

let clock = 0;
beforeEach(() => { vi.useFakeTimers(); clock = 0; });
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
const advance = (ms: number) => act(() => { clock += ms; vi.advanceTimersByTime(ms); });

it('holds a verdict back until a pen-written line has had its pause, but shows typed lines at once', () => {
  const activity = new BoardActivity(() => clock);
  const { result, rerender } = renderHook(({ value }) => useSettledValue(value, activity, 'board'), { initialProps: { value: 'old' } });
  expect(result.current).toBe('old');
  activity.penStart({ x: 1, y: 1 }); activity.penEnd();
  rerender({ value: 'new' });
  expect(result.current).toBe('old');
  advance(PEN_PAUSE_MS - 10);
  expect(result.current).toBe('old');
  advance(40);
  expect(result.current).toBe('new');
  activity.key(true);
  rerender({ value: 'typed' });
  expect(result.current).toBe('typed');
});

it('switching board drops the held value at once instead of showing another board\'s marks', () => {
  const activity = new BoardActivity(() => clock);
  const { result, rerender } = renderHook(({ value, scope }) => useSettledValue(value, activity, scope), { initialProps: { value: 'a', scope: 'one' } });
  activity.penStart({ x: 1, y: 1 }); activity.penEnd();
  rerender({ value: 'b', scope: 'two' });
  expect(result.current).toBe('b');
});

it('glides a percentage to its new value and shows it at once with reduced motion', () => {
  const frames: FrameRequestCallback[] = [];
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => frames.push(cb));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  vi.stubGlobal('matchMedia', () => ({ matches: false, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  vi.spyOn(performance, 'now').mockReturnValue(0);
  const { result, rerender } = renderHook(({ value }) => useTween(value, 600), { initialProps: { value: 10 } });
  expect(result.current).toBe(10);
  rerender({ value: 50 });
  act(() => frames.shift()!(300));
  expect(result.current).toBeGreaterThan(10); expect(result.current).toBeLessThan(50);
  act(() => frames.shift()!(700));
  expect(result.current).toBe(50);
  cleanup();
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  const reduced = renderHook(({ value }) => useTween(value), { initialProps: { value: 5 } });
  reduced.rerender({ value: 90 });
  expect(reduced.result.current).toBe(90);
});

it.each<[TutorMood, string]>([['idle', 'tutor-idle'], ['watching', 'tutor-watching'], ['checking', 'tutor-checking'], ['thinking', 'tutor-thinking'],
  ['concerned', 'tutor-concerned'], ['happy', 'tutor-happy'], ['waving', 'tutor-waving']])('mascot state %s has its own class, and dots only while checking or thinking', (mood, cls) => {
  const { container } = render(<Tutor mood={mood} />);
  expect(container.querySelector('svg')).toHaveClass(cls);
  expect(!!container.querySelector('.tutor-dots')).toBe(mood === 'checking' || mood === 'thinking');
});

it('throws confetti only for a celebrated success, and points only when asked to', () => {
  const happy = render(<Tutor mood="happy" />);
  expect(happy.container.querySelector('.tutor-confetti')).toBeNull();
  happy.rerender(<Tutor mood="happy" celebrate pointing />);
  expect(happy.container.querySelectorAll('.tutor-confetti rect').length).toBeGreaterThan(4);
  expect(screen.getByTestId('tutor')).toHaveAttribute('data-pointing', 'true');
  happy.rerender(<Tutor mood="concerned" celebrate />);
  expect(happy.container.querySelector('.tutor-confetti')).toBeNull();
});

const hud = { t: messages.cs, mood: 'idle' as const, speaking: false, menuOpen: false, running: false, canRequest: true,
  lessonActive: false, mode: 'live' as const, voiceOn: false, micAvailable: false, listening: false,
  onToggleMenu: vi.fn(), onMode: vi.fn(), onVoice: vi.fn(), onMic: vi.fn(), onAction: vi.fn(), onChoice: vi.fn() };
const c = chatMessages.cs;

it('while the AI works the bubble shows animated dots and a cancel button, and says so when it takes long', () => {
  const onChoice = vi.fn();
  const message = { id: 'thinking', kind: 'thinking' as const, text: 'Přemýšlím…' };
  const { rerender } = render(<TutorHud {...hud} running message={message} onChoice={onChoice} />);
  expect(screen.getByTestId('tutor-bubble')).toHaveAttribute('data-kind', 'thinking');
  expect(document.querySelector('.think-dots')).not.toBeNull();
  expect(screen.getByTestId('tutor-bubble')).toHaveTextContent('Přemýšlím');
  fireEvent.click(screen.getByRole('button', { name: c.cancelRequest }));
  expect(onChoice).toHaveBeenCalledWith('cancel');
  rerender(<TutorHud {...hud} running slow message={message} onChoice={onChoice} />);
  expect(screen.getByTestId('tutor-bubble')).toHaveTextContent(c.stillThinking.replace('…', ''));
  rerender(<TutorHud {...hud} running={false} message={message} onChoice={onChoice} />);
  expect(screen.queryByRole('button', { name: c.cancelRequest })).toBeNull();
});

it('waves while greeting, then settles; no wave for ordinary remarks or with reduced motion', () => {
  const welcome = { id: 'welcome', kind: 'info' as const, text: 'Ahoj.' };
  const { rerender } = render(<TutorHud {...hud} message={welcome} />);
  expect(screen.getByTestId('tutor')).toHaveAttribute('data-mood', 'waving');
  act(() => vi.advanceTimersByTime(3000));
  expect(screen.getByTestId('tutor')).toHaveAttribute('data-mood', 'idle');
  rerender(<TutorHud {...hud} message={{ id: 'other', kind: 'info', text: 'Jo.' }} />);
  expect(screen.getByTestId('tutor')).toHaveAttribute('data-mood', 'idle');
  cleanup();
  vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
  render(<TutorHud {...hud} message={welcome} />);
  expect(screen.getByTestId('tutor')).toHaveAttribute('data-mood', 'idle');
});

const chatProps = (over: Partial<ChatProps> = {}): ChatProps => ({ locale: 'cs', thread: [], chips: ['hint', 'faq_marks'], busy: false, slow: false, large: false,
  micAvailable: true, listening: false, onChip: vi.fn(), onSend: vi.fn(), onMic: vi.fn(), onCollapse: vi.fn(), onToggleSize: vi.fn(), onClear: vi.fn(), onCancel: vi.fn(), ...over });

it('the chat shows the history, has the message field ready, and sends on submit', () => {
  const props = chatProps({ thread: [{ id: '1', role: 'tutor', text: 'Ten výsledek nesedí.', at: 1 }, { id: '2', role: 'student', text: 'proč?', at: 2 }] });
  render(<ChatPanel {...props} />);
  expect(screen.getByRole('log', { name: c.chatLog })).toHaveTextContent('Ten výsledek nesedí.');
  expect(screen.getAllByRole('listitem').map(li => li.getAttribute('data-role'))).toEqual(['tutor', 'student']);
  const input = screen.getByRole('textbox', { name: c.composeLabel });
  expect(input).toHaveFocus();
  expect(screen.getByRole('button', { name: c.composeSend })).toBeDisabled();
  fireEvent.change(input, { target: { value: '  co je zlomek  ' } });
  fireEvent.submit(input.closest('form')!);
  expect(props.onSend).toHaveBeenCalledWith('co je zlomek');
  expect(input).toHaveValue('');
  fireEvent.keyDown(input, { key: 'Escape' });
  expect(screen.queryByRole('textbox')).toBeNull();
});

it('chips, microphone, size, clear, collapse and cancel call back; the mic is hidden when the browser has no speech recognition', () => {
  const props = chatProps({ busy: true, thread: [{ id: '1', role: 'tutor', text: 'Ahoj', at: 1 }] });
  const { rerender } = render(<ChatPanel {...props} />);
  fireEvent.click(screen.getByRole('button', { name: c.chipHint })); expect(props.onChip).toHaveBeenCalledWith('hint');
  fireEvent.click(screen.getByRole('button', { name: c.chipFaqMarks })); expect(props.onChip).toHaveBeenCalledWith('faq_marks');
  fireEvent.click(screen.getByRole('button', { name: c.micHold })); expect(props.onMic).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: c.chatBigger })); expect(props.onToggleSize).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: c.chatClear })); expect(props.onClear).toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: c.chatClose })); expect(props.onCollapse).toHaveBeenCalled();
  expect(screen.getByTestId('chat-typing')).toHaveTextContent(c.thinkingStart);
  fireEvent.click(screen.getByRole('button', { name: c.cancelRequest })); expect(props.onCancel).toHaveBeenCalled();
  rerender(<ChatPanel {...props} micAvailable={false} listening={false} busy={false} />);
  expect(screen.queryByRole('button', { name: c.micHold })).toBeNull();
  expect(screen.queryByTestId('chat-typing')).toBeNull();
  rerender(<ChatPanel {...props} locale="en" busy={false} thread={[]} />);
  expect(screen.getByText(chatMessages.en.chatEmpty)).toBeInTheDocument();
});

it('the conversation window replaces the bubble, stays put (no visit) and hides while a drawer is open', () => {
  const chat = { ...chatProps(), open: true, onToggle: vi.fn() };
  const message = { id: 'row', kind: 'wrong' as const, text: 'Chyba.', stepId: 'line-1' };
  const { rerender } = render(<TutorHud {...hud} chat={chat} locateStep={() => ({ x: 500, y: 300, width: 100, height: 30 })} message={message} />);
  expect(screen.getByTestId('chat')).toBeInTheDocument();
  expect(screen.queryByTestId('tutor-bubble')).toBeNull();
  expect(screen.getByTestId('tutor-hud')).toHaveAttribute('data-visiting', 'false');
  rerender(<TutorHud {...hud} chat={chat} quiet message={message} />);
  expect(screen.queryByTestId('chat')).toBeNull();
  expect(screen.getByRole('button', { name: c.chatOpen })).toBeDisabled();
  rerender(<TutorHud {...hud} chat={{ ...chat, open: false }} message={message} />);
  expect(screen.getByRole('button', { name: c.chatOpen })).toHaveAttribute('aria-expanded', 'false');
  fireEvent.click(screen.getByRole('button', { name: c.chatOpen }));
  expect(chat.onToggle).toHaveBeenCalled();
});

it('offers one-tap answers inside the bubble after an AI answer', () => {
  const onChip = vi.fn();
  render(<TutorHud {...hud} answerChips={['understand', 'lost']} onChip={onChip} message={{ id: 'a', kind: 'info', text: 'Zkus to rozložit.' }} />);
  fireEvent.click(screen.getByRole('button', { name: c.chipLost }));
  expect(onChip).toHaveBeenCalledWith('lost');
});
