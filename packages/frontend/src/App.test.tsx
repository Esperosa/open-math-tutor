import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
// The real Excalidraw canvas is covered by Playwright. This isolates the accessible application shell.
vi.mock('./Board', () => ({ Board: () => <div>Canvas</div> }));
import { App } from './App';
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
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
