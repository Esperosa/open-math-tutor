import { useRef } from 'react';
import type { MessageKey } from './i18n';

export interface UploadedImage { dataUrl: string; width: number; height: number }

interface Props {
  t: Record<MessageKey, string>;
  disabled: boolean;
  onUpload: (image: UploadedImage) => void;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new Error('read failed'));
    reader.readAsDataURL(file);
  });
}

function imageSize(dataUrl: string): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ width: img.naturalWidth, height: img.naturalHeight });
    img.onerror = () => reject(new Error('decode failed'));
    img.src = dataUrl;
  });
}

export function UploadBoard({ t, disabled, onUpload }: Props) {
  const input = useRef<HTMLInputElement>(null);
  async function handleFile(file: File) {
    const dataUrl = await readAsDataUrl(file);
    const { width, height } = await imageSize(dataUrl);
    onUpload({ dataUrl, width, height });
  }
  return <label className="upload-board">
    {t.uploadScan}
    <input ref={input} type="file" accept="image/png,image/jpeg,image/webp" disabled={disabled}
      onChange={e => {
        const file = e.target.files?.[0];
        if (file) void handleFile(file);
        if (input.current) input.current.value = '';
      }} />
  </label>;
}
