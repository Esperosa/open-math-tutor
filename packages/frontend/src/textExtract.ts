import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.mjs?url';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export const MAX_SOURCE_TEXT_LENGTH = 2_000_000;

export class TextExtractError extends Error {}

async function extractPdfText(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const doc = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages: string[] = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber++) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map(item => ('str' in item ? item.str : '')).join(' '));
  }
  return pages.join('\n\n');
}

function readAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error ?? new TextExtractError('read failed'));
    reader.readAsText(file);
  });
}

/** Extracts plain text from a locally uploaded .txt or .pdf file. Never sends the file anywhere. */
export async function extractText(file: File): Promise<string> {
  const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
  const text = isPdf ? await extractPdfText(file) : await readAsText(file);
  if (text.length === 0) throw new TextExtractError('empty document');
  return text.slice(0, MAX_SOURCE_TEXT_LENGTH);
}
