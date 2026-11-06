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
