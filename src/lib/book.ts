import { PageFlip } from 'page-flip';
import type { Chapter } from './chapters';
import type { Fit, PageGeometry } from './geometry';
import type { DocMeta } from './markdown';
import { applyFlowVars, measureChapter, type ChapterLayout } from './paginate';

/**
 * Imperative book engine. Owns the DOM under `container` so React and
 * StPageFlip never fight over the same nodes.
 *
 * Page order (absolute indices; even = right-hand/recto, odd = left/verso):
 *   0            front cover            (hard, alone on the right)
 *   1            front endpaper, blank  (hard)
 *   2 ..         table of contents      (roman numerals)
 *   bodyBase ..  chapters, each starting on a recto; blank versos inserted
 *                as needed; body pages numbered from 1
 *   [blank]      if needed so the back endpaper is a verso
 *   n-2          back endpaper          (hard)
 *   n-1          back cover             (hard)
 *
 * Around the engine sit page-edge stacks whose thickness shows how deep you are.
 */
export interface BookOptions {
  chapters: Chapter[];
  meta: DocMeta;
  geometry: PageGeometry;
  fit: Fit;
  /** Page to open on (0 = cover). */
  startPage?: number;
  /** Saved position from the previous session, offered as a resume target. */
  resumeAt?: number;
  onFlip?: (info: FlipInfo) => void;
  onFlipStart?: () => void;
}

export interface FlipInfo {
  index: number;
  total: number;
  /** Human label for the toolbar, e.g. "Cover", "Contents", "12–13 of 40". */
  label: string;
  /** True when the spread shows document pages (worth remembering as a position). */
  inBody: boolean;
}

export interface BookHandle {
  readonly pageCount: number;
  /** Resume target, if the previous session ended inside the body. */
  readonly resume: { index: number; label: string } | null;
  current(): number;
  next(): void;
  prev(): void;
  goTo(index: number): void;
  pageLabel(index: number): string;
  destroy(): void;
}

type Kind = 'cover' | 'endpaper' | 'toc' | 'body' | 'blank' | 'back';

interface PageRec {
  index: number;
  kind: Kind;
  el: HTMLElement;
  skin: HTMLElement;
  chapter?: Chapter;
  column?: number;
  flow?: HTMLElement;
}

const WINDOW = 4;
const EDGE_MAX = 30; // px, displayed
const EDGE_PER_PAGE = 0.6;

export async function createBook(container: HTMLElement, opts: BookOptions): Promise<BookHandle> {
  const { chapters, meta, geometry: g, fit } = opts;
  const scale = fit.scale;
  const dispW = Math.round(g.pageWidth * scale);
  const dispH = Math.round(g.pageHeight * scale);

  // ---- measure every chapter ------------------------------------------------
  const layouts: ChapterLayout[] = [];
  const chapterHtml: string[] = [];
  for (const c of chapters) {
    const html = openerHtml(c) + c.html;
    chapterHtml.push(html);
    layouts.push(await measureChapter(html, g, { opener: c.number !== null, subTag: c.subTag }));
  }

  // ---- plan the page sequence ----------------------------------------------
  interface TocEntry {
    level: 1 | 2;
    text: string;
    target: number;
    number: number;
  }
  const tocDraft: { level: 1 | 2; text: string; chapter: number; column: number }[] = [];
  chapters.forEach((c, ci) => {
    if (c.number === null) return;
    tocDraft.push({ level: 1, text: c.title, chapter: ci, column: 0 });
    for (const s of layouts[ci].sections) tocDraft.push({ level: 2, text: s.text, chapter: ci, column: s.page });
  });
  const tocPages = chunkToc(tocDraft.length, g);
  const tocCount = tocPages.length;
  const bodyBase = 2 + tocCount;

  let cursor = bodyBase;
  const chapterStart: number[] = [];
  const blanks = new Set<number>();
  layouts.forEach((l) => {
    if (cursor % 2 === 1) blanks.add(cursor++);
    chapterStart.push(cursor);
    cursor += l.pageCount;
  });
  const bodyEnd = cursor; // first index after the last chapter page
  // Page 1 is the first right-hand page of the body, as in a printed book; a
  // blank verso directly after the contents carries no number.
  const numberBase = bodyBase + (bodyBase % 2);
  const bodyCount = bodyEnd - numberBase;
  if (cursor % 2 === 0) blanks.add(cursor++);
  const backEndpaper = cursor;
  const backCover = cursor + 1;
  const total = cursor + 2;

  const toc: TocEntry[] = tocDraft.map((d) => {
    const target = chapterStart[d.chapter] + d.column;
    return { level: d.level, text: d.text, target, number: target - numberBase + 1 };
  });

  // ---- build DOM ------------------------------------------------------------
  const wrap = document.createElement('div');
  wrap.className = 'book-wrap';
  wrap.style.width = `${fit.portrait ? dispW : dispW * 2}px`;
  wrap.style.height = `${dispH}px`;

  const edgeL = document.createElement('div');
  edgeL.className = 'edge edge--left';
  const edgeR = document.createElement('div');
  edgeR.className = 'edge edge--right';
  const root = document.createElement('div');
  root.className = 'book';
  root.style.width = wrap.style.width;
  root.style.height = wrap.style.height;
  wrap.append(edgeL, edgeR, root);
  container.replaceChildren(wrap);

  const pages: PageRec[] = [];

  const shell = (index: number, kind: Kind, hard = false): PageRec => {
    // StPageFlip overwrites the page element's inline style wholesale, so all
    // CSS variables and the visual scale live on an inner "skin" it never touches.
    const el = document.createElement('div');
    el.className = `page page--${kind}`;
    if (hard) el.dataset.density = 'hard';
    const skin = document.createElement('div');
    skin.className = `page-skin page-skin--${kind}`;
    skin.dataset.side = index % 2 === 1 ? 'left' : 'right';
    applyFlowVars(skin, g);
    skin.style.setProperty('--scale', String(scale));
    el.appendChild(skin);
    root.appendChild(el);
    const rec: PageRec = { index, kind, el, skin };
    pages.push(rec);
    return rec;
  };

  // Front cover + endpaper
  {
    const { skin } = shell(0, 'cover', true);
    skin.innerHTML = `
      <div class="cover-rule"></div>
      <div class="cover-title">${esc(meta.title)}</div>
      ${meta.subtitle ? `<div class="cover-subtitle">${esc(meta.subtitle)}</div>` : ''}
      ${meta.author ? `<div class="cover-author">${esc(meta.author)}</div>` : ''}
      <div class="cover-rule cover-rule--bottom"></div>`;
  }
  shell(1, 'endpaper', true);

  // Table of contents
  tocPages.forEach((range, t) => {
    const { skin } = shell(2 + t, 'toc');
    const inner = document.createElement('div');
    inner.className = 'page-inner';
    if (t === 0) {
      const h = document.createElement('div');
      h.className = 'toc-title';
      h.textContent = 'Contents';
      inner.appendChild(h);
    }
    const list = document.createElement('ol');
    list.className = 'toc';
    for (const e of toc.slice(range[0], range[1])) {
      const li = document.createElement('li');
      li.className = `toc-entry toc-entry--l${e.level}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.dataset.target = String(e.target);
      btn.innerHTML = `<span class="toc-text">${esc(e.text)}</span><span class="toc-dots"></span><span class="toc-num">${e.number}</span>`;
      li.appendChild(btn);
      list.appendChild(li);
    }
    inner.appendChild(list);
    skin.append(inner, footer(roman(t + 1)));
  });

  // Body
  chapters.forEach((c, ci) => {
    const start = chapterStart[ci];
    const titled = c.number !== null;
    const accent = `hsl(${c.accentHue} 38% 36%)`;
    for (let k = 0; k < layouts[ci].pageCount; k++) {
      const index = start + k;
      const rec = shell(index, 'body');
      rec.chapter = c;
      rec.column = k;
      rec.skin.style.setProperty('--chapter-accent', accent);

      const isOpener = titled && k === 0;
      if (!isOpener) {
        const head = document.createElement('div');
        head.className = 'page-head';
        const isLeft = index % 2 === 1;
        head.textContent = isLeft || !titled ? (titled ? c.title : meta.title) : sectionAt(layouts[ci], k) ?? c.title;
        rec.skin.appendChild(head);
      }

      const inner = document.createElement('div');
      inner.className = 'page-inner';
      const flow = document.createElement('div');
      flow.className = 'flow';
      flow.lang = 'en';
      if (titled) flow.dataset.opener = '1';
      flow.style.transform = `translateX(${-k * (g.innerWidth + g.gap)}px)`;
      inner.appendChild(flow);
      rec.flow = flow;
      rec.skin.append(inner, footer(String(index - numberBase + 1)));
    }
  });
  for (const b of blanks) shell(b, 'blank');

  // Back endpaper + cover
  shell(backEndpaper, 'endpaper', true);
  {
    const { skin } = shell(backCover, 'back', true);
    skin.innerHTML = `<div class="cover-colophon">${esc(meta.title)}<br><span>Markdown Book</span></div>`;
  }

  pages.sort((a, b) => a.index - b.index);
  const pageEls = pages.map((p) => p.el);
  for (const el of pageEls) root.appendChild(el); // re-append in index order

  // ---- virtualization -----------------------------------------------------------
  const populate = (center: number) => {
    for (const rec of pages) {
      if (!rec.flow || !rec.chapter) continue;
      const near = Math.abs(rec.index - center) <= WINDOW;
      const has = rec.flow.childNodes.length > 0;
      if (near && !has) rec.flow.innerHTML = chapterHtml[chapters.indexOf(rec.chapter)];
      else if (!near && has) rec.flow.replaceChildren();
    }
  };

  // ---- labels -------------------------------------------------------------------
  const spreadOf = (i: number) => Math.min(total - 1, i % 2 === 1 ? i + 1 : i);
  const num = (i: number): number | null => (i >= numberBase && i < bodyEnd ? i - numberBase + 1 : null);
  const pageLabel = (index: number): string => {
    if (index <= 0) return 'Cover';
    if (index >= backCover) return 'Back cover';
    if (fit.portrait) {
      const n = num(index);
      if (n !== null) return `${n} of ${bodyCount}`;
      return index < bodyBase ? 'Contents' : index >= backEndpaper ? 'Back cover' : '';
    }
    const s = spreadOf(index);
    const a = num(s - 1);
    const b = num(s);
    if (a !== null && b !== null) return `${a}–${b} of ${bodyCount}`;
    if (a !== null) return `${a} of ${bodyCount}`;
    if (b !== null) return `${b} of ${bodyCount}`;
    if (s - 1 < bodyBase && s - 1 >= 2) return 'Contents';
    if (s >= backEndpaper) return 'Back cover';
    return 'Contents';
  };

  // ---- resume target ------------------------------------------------------------
  const resumeAt = opts.resumeAt !== undefined && opts.resumeAt >= numberBase && opts.resumeAt < bodyEnd ? spreadOf(opts.resumeAt) : null;
  const resumeInfo = resumeAt !== null ? { index: resumeAt, label: pageLabel(resumeAt) } : null;

  // ---- furniture: edge stacks ----------------------------------------------------
  const updateFurniture = (index: number) => {
    const s = fit.portrait ? index : spreadOf(index);
    const leftCount = fit.portrait ? Math.max(0, s) : Math.max(0, s - 1);
    const rightCount = Math.max(0, total - 1 - s);
    const wL = leftCount === 0 ? 0 : Math.max(3, Math.min(EDGE_MAX, leftCount * EDGE_PER_PAGE));
    const wR = rightCount === 0 ? 0 : Math.max(3, Math.min(EDGE_MAX, rightCount * EDGE_PER_PAGE));
    edgeL.style.width = `${wL}px`;
    edgeR.style.width = `${wR}px`;
    edgeL.style.left = `${-wL}px`;
    edgeR.style.right = `${-wR}px`;
  };

  // ---- engine -------------------------------------------------------------------
  const start = Math.min(Math.max(0, opts.startPage ?? 0), total - 1);
  populate(start);
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const flip = new PageFlip(root, {
    width: dispW,
    height: dispH,
    size: 'fixed',
    startPage: start,
    showCover: true,
    usePortrait: true,
    autoSize: false,
    drawShadow: true,
    maxShadowOpacity: 0.45,
    flippingTime: reduceMotion ? 120 : 800,
    mobileScrollSupport: false,
    showPageCorners: true,
    useMouseEvents: true,
    // Clicks must not flip: contents entries are buttons. Corner drags still work.
    disableFlipByClick: true,
  });

  // Programmatic flips and corner clicks enter the "flipping" state.
  flip.on('changeState', (e) => {
    if (e.data === 'flipping') opts.onFlipStart?.();
  });
  // A dragged page never enters "flipping": on release the engine animates it
  // home while the state stays "user_fold" and only reports the page change at
  // the end. The release is when the paper starts moving on its own, so that
  // is when the sound belongs. The engine's own listeners run first.
  const onRelease = () => {
    if (flip.getState() === 'user_fold') opts.onFlipStart?.();
  };
  window.addEventListener('mouseup', onRelease);
  window.addEventListener('touchend', onRelease);

  const info = (index: number): FlipInfo => {
    const s = fit.portrait ? index : spreadOf(index);
    const inBody = num(s) !== null || num(s - 1) !== null;
    return { index, total, label: pageLabel(index), inBody };
  };
  flip.on('flip', () => {
    const index = flip.getCurrentPageIndex();
    populate(index);
    updateFurniture(index);
    opts.onFlip?.(info(index));
  });

  flip.loadFromHTML(pageEls);
  updateFurniture(flip.getCurrentPageIndex());
  opts.onFlip?.(info(flip.getCurrentPageIndex()));
  if (import.meta.env.DEV) (globalThis as { __markdownBookFlip?: PageFlip }).__markdownBookFlip = flip;

  const goTo = (i: number) => {
    const target = Math.min(Math.max(0, i), total - 1);
    populate(target);
    opts.onFlipStart?.();
    flip.turnToPage(target);
  };

  const onClick = (ev: Event) => {
    const btn = (ev.target as HTMLElement).closest<HTMLElement>('button[data-target]');
    if (!btn) return;
    ev.preventDefault();
    goTo(Number(btn.dataset.target));
  };
  wrap.addEventListener('click', onClick);
  let destroyed = false;
  return {
    pageCount: total,
    resume: resumeInfo,
    current: () => flip.getCurrentPageIndex(),
    next: () => {
      opts.onFlipStart?.();
      flip.flipNext();
    },
    prev: () => {
      opts.onFlipStart?.();
      flip.flipPrev();
    },
    goTo,
    pageLabel,
    destroy: () => {
      if (destroyed) return;
      destroyed = true;
      wrap.removeEventListener('click', onClick);
      window.removeEventListener('mouseup', onRelease);
      window.removeEventListener('touchend', onRelease);
      try {
        flip.destroy();
      } catch {
        // StPageFlip can throw if destroyed mid-animation; the DOM is gone either way.
      }
      container.replaceChildren();
    },
  };
}

function openerHtml(c: Chapter): string {
  if (c.number === null) return '';
  return `<div class="chapter-opener"><span class="chapter-number">Chapter ${c.number}</span><span class="chapter-ornament">${c.ornament}</span></div>`;
}

function sectionAt(layout: ChapterLayout, column: number): string | null {
  let best: string | null = null;
  for (const s of layout.sections) {
    if (s.page <= column) best = s.text;
    else break;
  }
  return best;
}

/** Split N contents entries into page ranges using the fixed entry height from book.css. */
function chunkToc(count: number, g: PageGeometry): [number, number][] {
  if (count === 0) return [];
  const entryH = g.fontSize * 2.1;
  const titleH = g.fontSize * 3.6;
  const firstCap = Math.max(1, Math.floor((g.innerHeight - titleH) / entryH));
  const restCap = Math.max(1, Math.floor(g.innerHeight / entryH));
  const ranges: [number, number][] = [];
  let i = 0;
  while (i < count) {
    const cap = ranges.length === 0 ? firstCap : restCap;
    ranges.push([i, Math.min(count, i + cap)]);
    i += cap;
  }
  return ranges;
}

function footer(text: string): HTMLElement {
  const f = document.createElement('div');
  f.className = 'page-footer';
  f.textContent = text;
  return f;
}

function roman(n: number): string {
  const map: [number, string][] = [
    [10, 'x'],
    [9, 'ix'],
    [5, 'v'],
    [4, 'iv'],
    [1, 'i'],
  ];
  let out = '';
  for (const [v, s] of map) {
    while (n >= v) {
      out += s;
      n -= v;
    }
  }
  return out;
}

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);
}
