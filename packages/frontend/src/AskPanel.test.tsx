import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { AskPanel } from './AskPanel';
import { cs } from './i18n';

afterEach(cleanup);

describe('AskPanel', () => {
  it('sends the typed question and clears the input', () => {
    const onAsk = vi.fn();
    render(<AskPanel t={cs} disabled={false} onAsk={onAsk} />);
    const input = screen.getByLabelText(cs.askLabel);
    fireEvent.change(input, { target: { value: 'Proč se mění znaménko?' } });
    fireEvent.click(screen.getByRole('button', { name: cs.askSend }));
    expect(onAsk).toHaveBeenCalledWith('Proč se mění znaménko?');
    expect(input).toHaveValue('');
  });

  it('does not send an empty or whitespace-only question', () => {
    const onAsk = vi.fn();
    render(<AskPanel t={cs} disabled={false} onAsk={onAsk} />);
    fireEvent.change(screen.getByLabelText(cs.askLabel), { target: { value: '   ' } });
    expect(screen.getByRole('button', { name: cs.askSend })).toBeDisabled();
  });

  it('disables the send button when the panel is disabled', () => {
    render(<AskPanel t={cs} disabled={true} onAsk={vi.fn()} />);
    fireEvent.change(screen.getByLabelText(cs.askLabel), { target: { value: 'Otázka' } });
    expect(screen.getByRole('button', { name: cs.askSend })).toBeDisabled();
  });
});
