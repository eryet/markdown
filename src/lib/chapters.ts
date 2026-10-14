/**
 * Split rendered HTML into chapters at the top-level heading (H1 if the
 * document has several, otherwise H2). Each chapter is paginated on its own
 * and starts on a right-hand page, which is what lets every chapter look and
 * sit differently in the book: the spatial anchors memory hangs on.
 */
export interface Chapter {
  /** 1-based among titled chapters; null for untitled front material. */
  number: number | null;
  title: string;
  html: string;
  /** Heading tag used for the table-of-contents sub-entries inside this chapter. */
  subTag: 'H2' | 'H3';
  accentHue: number;
  ornament: string;
}

const ORNAMENTS = ['❦', '✦', '❧', '☙', '✣', '❖', '✤', '✥', '❈', '✧'];

export function splitChapters(html: string, bookTitle: string): Chapter[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const nodes = Array.from(doc.body.childNodes);
  const hasH1 = nodes.some((n) => n.nodeName === 'H1');
  const tag = hasH1 ? 'H1' : 'H2';
  const subTag: 'H2' | 'H3' = hasH1 ? 'H2' : 'H3';

  const chapters: Chapter[] = [];
  let bucket: ChildNode[] = [];
  let title: string | null = null;

  const flush = () => {
    if (bucket.length === 0) return;
    const div = doc.createElement('div');
    for (const n of bucket) div.appendChild(n);
    const content = div.innerHTML;
    bucket = [];
    if (!content.trim()) return;
    const t = title ?? bookTitle;
    chapters.push({
      number: title === null ? null : 0,
      title: t,
      html: content,
      subTag,
      accentHue: hashString(t) % 360,
      ornament: ORNAMENTS[hashString(t + '~') % ORNAMENTS.length],
    });
  };

  for (const n of nodes) {
    if (n.nodeName === tag) {
      flush();
      title = (n.textContent ?? '').trim() || 'Untitled';
      bucket = [n];
    } else {
      bucket.push(n);
    }
  }
  flush();

  if (chapters.length === 0) {
    chapters.push({
      number: null,
      title: bookTitle,
      html: html || '<p></p>',
      subTag,
      accentHue: hashString(bookTitle) % 360,
      ornament: ORNAMENTS[0],
    });
  }

  let k = 0;
  for (const c of chapters) if (c.number !== null) c.number = ++k;
  return chapters;
}

/** Small, stable string hash (FNV-1a) used for colours, ornaments and storage keys. */
export function hashString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}
