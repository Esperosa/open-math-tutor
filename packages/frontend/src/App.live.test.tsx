import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { newBoard, type BoardState } from './boardState';
import { defaultSettings, save } from './storage';
import { chatMessages } from './chat/messages';
import { PEN_PAUSE_MS } from './activity';
// The real Excalidraw canvas is covered by Playwright. This isolates the application shell and its timing.
vi.mock('./Board', () => ({ Board: () => <div>Canvas</div> }));
import { App } from './App';
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); document.querySelectorAll('.board-surface').forEach(e => e.remove()); });

const c = chatMessages.cs;
function seed(text: string | null, over: Partial<typeof defaultSettings> = {}) {
  const board: BoardState = { ...newBoard(), statement: '5+1',
    steps: text ? [{ stepId: 's1', latexGuess: text, boardRevision: 1, box: { x: 0, y: 0, width: 1, height: 1 }, elementIds: ['s1'] }] : [] };
  save({ version: 1, boards: [board], activeId: board.id, settings: { ...defaultSettings, onboardingDismissed: true, ...over } });
  const fetchMock = vi.fn().mockRejectedValue(new TypeError('No bridge'));
  vi.stubGlobal('fetch', fetchMock);
  return { board, fetchMock };
}
function surface() {
  const el = document.createElement('div');
  el.className = 'board-surface'; el.dataset.tool = 'freedraw';
  document.body.appendChild(el);
  return el;
}

it('does not comment on a line while the pen is down and comments one pen pause after it lifts', async () => {
  seed('5+1=8');
  const pad = surface();
  render(<App />);
  act(() => { fireEvent.pointerDown(pad, { clientX: 200, clientY: 200 }); });
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1000)); });
  expect(screen.queryByTestId('tutor-bubble')).toHaveAttribute('data-kind', expect.not.stringMatching(/^wrong$/));
  expect(screen.getByTestId('tutor')).toHaveAttribute('data-mood', 'watching');
  const lifted = Date.now();
  act(() => { fireEvent.pointerUp(pad); });
  expect(screen.getByTestId('tutor')).toHaveAttribute('data-mood', 'checking'); // looks at once, comments after the pause
  await waitFor(() => expect(screen.getByTestId('tutor-bubble')).toHaveAttribute('data-kind', 'wrong'), { timeout: 3000 });
  const waited = Date.now() - lifted;
  expect(waited).toBeGreaterThanOrEqual(PEN_PAUSE_MS - 60);
  expect(waited).toBeLessThan(1400);
});

it('answers app questions locally, says plainly that the AI is missing for the rest, and remembers the thread per board', async () => {
  const { board, fetchMock } = seed(null, { coachMode: 'off' });
  const { unmount } = render(<App />);
  await waitFor(() => expect(fetchMock).toHaveBeenCalled());
  fireEvent.click(screen.getByRole('button', { name: c.chatOpen }));
  expect(screen.getByTestId('chat')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: c.chipFaqMarks }));
  const log = screen.getByTestId('chat-log');
  await waitFor(() => expect(within(log).getByText(/řádku vidíš/)).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: c.composeOpen }));
  const input = screen.getByRole('textbox', { name: c.composeLabel });
  fireEvent.change(input, { target: { value: 'Proč se mění znaménko u zlomku?' } });
  fireEvent.submit(input.closest('form')!);
  await waitFor(() => expect(within(log).getByText(/AI učitel teď není připojený/)).toBeInTheDocument());
  expect(within(log).getByText('Proč se mění znaménko u zlomku?')).toBeInTheDocument();
  // No question left the app: only the startup probes of the bridge were made.
  expect(fetchMock.mock.calls.every(([url]) => /\/(providers|health)$/.test(String(url)))).toBe(true);
  await waitFor(() => expect(JSON.parse(localStorage.getItem('openmathtutor.chat.v1') ?? '{}')[board.id]).toHaveLength(5));
  unmount();
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: c.chatOpen }));
  expect(within(screen.getByTestId('chat-log')).getByText(/řádku vidíš/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: c.chipFaqMarks })).toBeInTheDocument(); // local help stays on offer without an AI
});

it('a thank-you typed into the chat is answered locally, with no AI connected', async () => {
  seed(null, { coachMode: 'off' });
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: c.chatOpen }));
  fireEvent.click(screen.getByRole('button', { name: c.chipFaqMarks }));
  fireEvent.click(screen.getByRole('button', { name: c.composeOpen }));
  const input = screen.getByRole('textbox', { name: c.composeLabel });
  fireEvent.change(input, { target: { value: 'díky' } });
  fireEvent.submit(input.closest('form')!);
  await waitFor(() => expect(within(screen.getByTestId('chat-log')).getByText(/Rádo se stalo/)).toBeInTheDocument());
});
