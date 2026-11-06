import { afterEach, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { ExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import type { BinaryFiles } from '@excalidraw/excalidraw/types';
import { newBoard, type BoardState } from './boardState';
import { defaultSettings, save } from './storage';
const boardMock = vi.hoisted(() => ({ current: null as null | { board: BoardState; onCommit(elements: readonly ExcalidrawElement[], files: BinaryFiles): void } }));
// The real Excalidraw canvas is covered by Playwright. This isolates the accessible application shell.
vi.mock('./Board', () => ({ Board: (props: NonNullable<typeof boardMock.current>) => { boardMock.current = props; return <div>Canvas</div>; } }));
import { App } from './App';
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });

function seedResult(text: string, mode: 'live' | 'final' | 'off' = 'live', wordProblem = true) {
  const board: BoardState = { ...newBoard(), statement: 'Urči hmotnost.', skillId: 'chem-moles',
    expected: { value: 175.5, unit: 'g', tolerance: 0.01, wordProblem, givens: [3, 58.5] },
    steps: [{ stepId: 'result', latexGuess: text, boardRevision: 1, box: { x: 0, y: 0, width: 1, height: 1 }, elementIds: ['result'] }] };
  save({ version: 1, boards: [board], activeId: board.id, settings: { ...defaultSettings, onboardingDismissed: true, coachMode: mode } });
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('No bridge')));
}
const masteryData = () => JSON.parse(localStorage.getItem('openmathtutor.mastery.v1') ?? '{}');
const profileData = () => JSON.parse(localStorage.getItem('openmathtutor.profile.v1') ?? '{}');

it.each(['live', 'final'] as const)('keeps mismatched word answers soft in %s, confirms failure exactly once even after correction', async mode => {
  seedResult('176,4', mode);
  render(<App />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Je to výsledek' })).toBeInTheDocument(), { timeout: 4000 });
  expect(masteryData()).toEqual({});
  expect(profileData().days ?? {}).toEqual({});
  fireEvent.click(screen.getByRole('button', { name: 'Je to výsledek' }));
  const first = masteryData();
  expect(first['chem-moles'].attempts).toBe(1);
  expect(first['chem-moles'].correctStreak).toBe(0);
  const firstProfile = profileData();
  expect(firstProfile.skillErrors['chem-moles'].wrong_final).toBe(1);
  // Correct the same board row through its normal commit callback.
  act(() => boardMock.current!.onCommit([{ id: 'result', type: 'text', text: '175,5 g', x: 0, y: 0, width: 100, height: 20,
    angle: 0, version: 2, versionNonce: 2, isDeleted: false } as unknown as ExcalidrawElement], {}));
  await waitFor(() => expect(screen.getByTestId('tutor-bubble')).toHaveAttribute('data-kind', 'solved'), { timeout: 4000 });
  expect(masteryData()).toEqual(first);
  expect(profileData()).toEqual(firstProfile);
});

it('records an admitted failure only once and ignores confirmations after coach is turned off', async () => {
  seedResult('176,4 g');
  localStorage.setItem('openmathtutor.mastery.v1', JSON.stringify({ 'chem-moles': { skillId: 'chem-moles', difficultyLevel: 5,
    correctStreak: 2, incorrectStreak: 0, attempts: 10, correctTotal: 10, masteredAt: 1, lastPracticedAt: 1 } }));
  render(<App />);
  await waitFor(() => expect(screen.getByRole('button', { name: 'Nevyšlo mi to' })).toBeInTheDocument(), { timeout: 3000 });
  fireEvent.click(screen.getByRole('button', { name: 'Nevyšlo mi to' }));
  expect(masteryData()['chem-moles'].attempts).toBe(11);
  expect(masteryData()['chem-moles'].masteredAt).toBeNull();
  expect(masteryData()['chem-moles'].correctStreak).toBe(0);
  cleanup(); localStorage.clear(); seedResult('176,4 g', 'off'); render(<App />);
  await act(async () => { await new Promise(resolve => setTimeout(resolve, 1300)); });
  expect(screen.queryByRole('button', { name: 'Je to výsledek' })).not.toBeInTheDocument();
  expect(masteryData()).toEqual({});
});

it('does not count a normal wrong_final followed by solved as a second attempt', async () => {
  seedResult('176,4', 'live', false); render(<App />);
  await waitFor(() => expect(screen.getByTestId('tutor-bubble')).toHaveAttribute('data-kind', 'wrong'), { timeout: 3000 });
  const first = masteryData(), firstProfile = profileData();
  expect(first['chem-moles'].attempts).toBe(1);
  act(() => boardMock.current!.onCommit([{ id: 'result', type: 'text', text: '175,5', x: 0, y: 0, width: 100, height: 20,
    angle: 0, version: 2, versionNonce: 2, isDeleted: false } as unknown as ExcalidrawElement], {}));
  await waitFor(() => expect(screen.getByTestId('tutor-bubble')).toHaveAttribute('data-kind', 'solved'), { timeout: 3000 });
  expect(masteryData()).toEqual(first); expect(profileData()).toEqual(firstProfile);
});

it('does not close the calculator when Escape finishes editing text', () => {
  seedResult('', 'off'); render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Kalkulačka' }));
  const host = document.createElement('div'); host.className = 'excalidraw';
  const text = document.createElement('textarea'); host.append(text); document.body.append(host);
  fireEvent.keyDown(text, { key: 'Escape' });
  expect(screen.getByRole('dialog', { name: 'Kalkulačka' })).toBeInTheDocument();
  host.remove(); fireEvent.keyDown(screen.getByRole('textbox', { name: 'Kalkulačka' }), { key: 'Escape' });
  expect(screen.queryByRole('dialog', { name: 'Kalkulačka' })).not.toBeInTheDocument();
});
it('keeps the board usable without a bridge and switches the complete shell to English', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('No bridge')));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }));
  await waitFor(() => expect(screen.getByText(/Lokální bridge není dostupný/)).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Upravit zadání' }));
  fireEvent.change(screen.getByLabelText('Zadání'), { target: { value: '2x = 8' } });
  expect(screen.getByTestId('revision')).toHaveTextContent('1');
  fireEvent.click(screen.getByRole('button', { name: 'Učitel' }));
  expect(screen.getByRole('menuitem', { name: 'Zkontrolovat' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Jazyk'), { target: { value: 'en' } });
  expect(screen.getByLabelText('Problem')).toHaveValue('2x = 8');
  expect(screen.getByText(/The local bridge is unavailable/)).toBeInTheDocument();
  expect(screen.getByRole('menuitem', { name: 'Show next step' })).toBeDisabled();
});

it('auto-selects the first installed, authenticated provider and its first model so nothing needs manual setup', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).endsWith('/health')) return new Response(JSON.stringify({ status: 'ok', verifier: 'ok' }), { status: 200 });
    if (String(url).endsWith('/providers')) {
      return new Response(JSON.stringify({ providers: [
        { id: 'codex', detect: { installed: false }, authStatus: { providerId: 'codex', authenticated: false, tutoringAvailable: false }, models: [] },
        { id: 'claude', detect: { installed: true }, authStatus: { providerId: 'claude', authenticated: true, tutoringAvailable: true },
          models: [{ id: 'sonnet', label: 'sonnet', supportsImageInput: false }, { id: 'opus', label: 'opus', supportsImageInput: false }] },
      ] }), { status: 200 });
    }
    throw new Error(`unexpected request: ${url}`);
  }));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Poskytovatel' })).toHaveValue('claude'));
  expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('sonnet');
});

it('prefers a provider that can actually tutor over one that is merely logged in, even if listed first', async () => {
  // Regression test: a provider can be installed and authenticated and still
  // be unconditionally fail-closed for every request (tutoringAvailable:
  // false) — auto-select must not default to it just because it's first and
  // "authenticated", or every check silently does nothing for the user.
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).endsWith('/health')) return new Response(JSON.stringify({ status: 'ok', verifier: 'ok' }), { status: 200 });
    if (String(url).endsWith('/providers')) {
      return new Response(JSON.stringify({ providers: [
        { id: 'codex', detect: { installed: true }, authStatus: { providerId: 'codex', authenticated: true, tutoringAvailable: false },
          models: [{ id: 'gpt-x', label: 'gpt-x', supportsImageInput: true }] },
        { id: 'claude', detect: { installed: true }, authStatus: { providerId: 'claude', authenticated: true, tutoringAvailable: true },
          models: [{ id: 'sonnet', label: 'sonnet', supportsImageInput: false }] },
      ] }), { status: 200 });
    }
    throw new Error(`unexpected request: ${url}`);
  }));
  render(<App />);
  fireEvent.click(screen.getByRole('button', { name: 'Přeskočit, chci jen volnou tabuli' }));
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Poskytovatel' })).toHaveValue('claude'));
  expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('sonnet');
});

it('onboarding: picking a track immediately starts a lesson and shows a "where am I" breadcrumb', async () => {
  const manuals: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/health')) return new Response(JSON.stringify({ status: 'ok', verifier: 'ok' }), { status: 200 });
    if (String(url).endsWith('/providers')) {
      return new Response(JSON.stringify({ providers: [{ id: 'claude', detect: { installed: true },
        authStatus: { providerId: 'claude', authenticated: true, tutoringAvailable: true },
        models: [{ id: 'sonnet', label: 'sonnet', supportsImageInput: false }] }] }), { status: 200 });
    }
    if (String(url).endsWith('/continue-lesson')) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      manuals.push(body);
      return new Response(JSON.stringify({
        requestId: body.requestId, boardRevision: body.boardRevision, recognizedSteps: [], confidence: 1,
        firstErrorStepId: null, verifierStatus: 'needs_domain_check', pedagogicalResponse: 'ok', ttsText: 'ok',
        boardActions: [], needsClarification: null,
      }), { status: 200 });
    }
    throw new Error(`unexpected request: ${url}`);
  }));
  render(<App />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Na co se připravuješ?' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /Chystám se na střední školu/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Přijímačky na střední školu/ }));
  await waitFor(() => expect(screen.getByTestId('track-breadcrumb')).toBeInTheDocument());
  expect(manuals).toHaveLength(0);
  expect(screen.getByTestId('track-breadcrumb')).toHaveTextContent('Přijímačky na střední školu');
  expect(screen.getByTestId('task-text')).not.toHaveTextContent(/^$/);
  expect(screen.getByTestId('task-text')).not.toHaveTextContent('Klikni na tabuli');
});

it('switching to a new track starts a fresh board, not the previous lesson\'s canvas and history', async () => {
  // Regression: startLesson used to edit the currently active board in
  // place, leaving the previous problem's handwriting and explanation
  // history visible underneath the new one.
  const manuals: Record<string, unknown>[] = [];
  vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
    if (String(url).endsWith('/health')) return new Response(JSON.stringify({ status: 'ok', verifier: 'ok' }), { status: 200 });
    if (String(url).endsWith('/providers')) {
      return new Response(JSON.stringify({ providers: [{ id: 'claude', detect: { installed: true },
        authStatus: { providerId: 'claude', authenticated: true, tutoringAvailable: true },
        models: [{ id: 'sonnet', label: 'sonnet', supportsImageInput: false }] }] }), { status: 200 });
    }
    if (String(url).endsWith('/continue-lesson')) {
      const body = JSON.parse(String(init?.body)) as Record<string, unknown>;
      manuals.push(body);
      return new Response(JSON.stringify({
        requestId: body.requestId, boardRevision: body.boardRevision, recognizedSteps: [], confidence: 1,
        firstErrorStepId: null, verifierStatus: 'needs_domain_check', pedagogicalResponse: 'ok', ttsText: 'ok',
        boardActions: [], needsClarification: null,
      }), { status: 200 });
    }
    throw new Error(`unexpected request: ${url}`);
  }));
  render(<App />);
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Na co se připravuješ?' })).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: /Chystám se na střední školu/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Přijímačky na střední školu/ }));
  await waitFor(() => expect(screen.getByTestId('track-breadcrumb')).toBeInTheDocument());
  fireEvent.click(screen.getByRole('button', { name: 'Změnit kurz' }));
  fireEvent.click(screen.getByRole('button', { name: /Studuju vysokou školu/ }));
  fireEvent.click(screen.getByRole('button', { name: /^Vysoká škola — základy algebry/ }));
  await waitFor(() => expect(screen.getByTestId('track-breadcrumb')).toHaveTextContent('Vysoká škola'));
  expect(manuals).toHaveLength(0);

  // Starting a lesson is local (no AI call) and always gets a fresh, empty board.
  expect(screen.queryAllByTestId('explanation')).toHaveLength(0);
  expect(screen.getByTestId('task-text')).not.toHaveTextContent(/^$/);
  expect(screen.getByTestId('task-text')).not.toHaveTextContent('Klikni na tabuli');
});
