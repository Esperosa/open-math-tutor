import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { CustomSourcesPanel } from './CustomSourcesPanel';
import { cs } from './i18n';
import type { CustomSource } from './customSources';

vi.mock('./textExtract', () => ({
  extractText: vi.fn(async (file: File) => {
    if (file.name === 'empty.txt') throw new (class extends Error {})('empty');
    return 'extracted text content';
  }),
  TextExtractError: class extends Error {},
}));

afterEach(cleanup);

const sources: CustomSource[] = [{ id: 's1', title: 'My notes.txt', addedAt: 0, chunks: [] }];

describe('CustomSourcesPanel', () => {
  it('extracts text from an uploaded file and calls onAdd', async () => {
    const onAdd = vi.fn();
    render(<CustomSourcesPanel t={cs} sources={[]} onAdd={onAdd} onRemove={vi.fn()} />);
    const input = screen.getByLabelText(cs.addSource) as HTMLInputElement;
    const file = new File(['hello'], 'notes.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith('notes.txt', 'extracted text content'));
  });

  it('lists existing sources and removes one on request', () => {
    const onRemove = vi.fn();
    render(<CustomSourcesPanel t={cs} sources={sources} onAdd={vi.fn()} onRemove={onRemove} />);
    expect(screen.getByText('My notes.txt')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: cs.removeSource }));
    expect(onRemove).toHaveBeenCalledWith('s1');
  });
});
