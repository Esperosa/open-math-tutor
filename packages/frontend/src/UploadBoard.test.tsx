import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { UploadBoard } from './UploadBoard';
import { cs } from './i18n';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

class FakeFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL() {
    this.result = 'data:image/png;base64,fake';
    queueMicrotask(() => this.onload?.());
  }
}

class FakeImage {
  naturalWidth = 400;
  naturalHeight = 300;
  onload: (() => void) | null = null;
  set src(_value: string) {
    queueMicrotask(() => this.onload?.());
  }
}

describe('UploadBoard', () => {
  it('converts an uploaded image to a data URL and reports its dimensions', async () => {
    vi.stubGlobal('FileReader', FakeFileReader);
    vi.stubGlobal('Image', FakeImage);
    const onUpload = vi.fn();
    render(<UploadBoard t={cs} disabled={false} onUpload={onUpload} />);
    const input = screen.getByLabelText(cs.uploadScan) as HTMLInputElement;
    const file = new File(['fake-bytes'], 'problem.png', { type: 'image/png' });
    fireEvent.change(input, { target: { files: [file] } });
    await waitFor(() => expect(onUpload).toHaveBeenCalledWith({ dataUrl: 'data:image/png;base64,fake', width: 400, height: 300 }));
  });

  it('disables the file input when disabled', () => {
    render(<UploadBoard t={cs} disabled={true} onUpload={vi.fn()} />);
    expect(screen.getByLabelText(cs.uploadScan)).toBeDisabled();
  });
});
