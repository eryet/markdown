import { hashString } from './chapters';
import type { PageGeometry } from './geometry';

/**
 * Per-document state in localStorage. Keyed by a hash of the markdown source
 * so the same file opened again gets the same layout, position and marks.
 */
export interface BookState {
  /** Locked page geometry so page numbers stay stable across sessions. */
  layout?: PageGeometry;
  fontScale: number;
  /** Absolute page index of the last spread the reader was on. */
  position: number;
}

const PREFIX = 'markdown-book.doc.';

export function docKey(markdown: string): string {
  return PREFIX + hashString(markdown).toString(36) + '-' + markdown.length.toString(36);
}

export function loadState(key: string): BookState {
  try {
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<BookState>;
      return {
        layout: parsed.layout,
        fontScale: typeof parsed.fontScale === 'number' ? parsed.fontScale : 1,
        position: typeof parsed.position === 'number' ? parsed.position : 0,
      };
    }
  } catch {
    // unreadable or blocked storage: fall through to defaults
  }
  return { fontScale: 1, position: 0 };
}

export function saveState(key: string, state: BookState): void {
  try {
    localStorage.setItem(key, JSON.stringify(state));
  } catch {
    // private mode or quota: state just lasts for this visit
  }
}
