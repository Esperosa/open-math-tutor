import { afterEach, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
// The real Excalidraw canvas is covered by Playwright. This isolates the accessible application shell.
vi.mock('./Board', () => ({ Board: () => <div>Canvas</div> }));
import { App } from './App';
afterEach(() => { cleanup(); localStorage.clear(); vi.unstubAllGlobals(); });
it('keeps the board usable without a bridge and switches the complete shell to English', async () => {
  vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('No bridge')));
  render(<App />);
  await waitFor(() => expect(screen.getByText(/Lokální bridge není dostupný/)).toBeInTheDocument());
  fireEvent.change(screen.getByLabelText('Zadání'), { target: { value: '2x = 8' } });
  expect(screen.getByTestId('revision')).toHaveTextContent('1');
  expect(screen.getByRole('button', { name: 'Zkontrolovat' })).toBeDisabled();
  fireEvent.change(screen.getByLabelText('Jazyk'), { target: { value: 'en' } });
  expect(screen.getByLabelText('Problem')).toHaveValue('2x = 8');
  expect(screen.getByText(/The local bridge is unavailable/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Show next step' })).toBeDisabled();
});

it('auto-selects the first installed, authenticated provider and its first model so nothing needs manual setup', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url: string) => {
    if (String(url).endsWith('/health')) return new Response(JSON.stringify({ status: 'ok', verifier: 'ok' }), { status: 200 });
    if (String(url).endsWith('/providers')) {
      return new Response(JSON.stringify({ providers: [
        { id: 'codex', detect: { installed: false }, authStatus: { providerId: 'codex', authenticated: false }, models: [] },
        { id: 'claude', detect: { installed: true }, authStatus: { providerId: 'claude', authenticated: true },
          models: [{ id: 'sonnet', label: 'sonnet', supportsImageInput: false }, { id: 'opus', label: 'opus', supportsImageInput: false }] },
      ] }), { status: 200 });
    }
    throw new Error(`unexpected request: ${url}`);
  }));
  render(<App />);
  await waitFor(() => expect(screen.getByRole('combobox', { name: 'Poskytovatel' })).toHaveValue('claude'));
  expect(screen.getByRole('combobox', { name: 'Model' })).toHaveValue('sonnet');
});
