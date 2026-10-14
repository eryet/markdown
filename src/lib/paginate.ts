import type { PageGeometry } from './geometry';

/**
 * Pagination strategy:
 * A chapter is laid out once in a CSS multi-column flow whose column width ==
 * page text width and whose height == page text height. The browser does all
 * line breaking; each overflow column is one page. A page element is a
 * clipped view onto that flow, shifted by N columns.
 *
 * measureChapter builds a hidden probe, waits for fonts and images, counts
 * the columns, and records which column each sub-heading starts in so the
 * table of contents and running heads carry real page numbers. The probe
 * must use the SAME class, attributes and CSS vars as the real page flows.
 */
export function applyFlowVars(el: HTMLElement, g: PageGeometry): void {
  el.style.setProperty('--page-w', `${g.pageWidth}px`);
  el.style.setProperty('--page-h', `${g.pageHeight}px`);
  el.style.setProperty('--inner-w', `${g.innerWidth}px`);
  el.style.setProperty('--inner-h', `${g.innerHeight}px`);
  el.style.setProperty('--gap', `${g.gap}px`);
  el.style.setProperty('--fs', `${g.fontSize}px`);
  el.style.setProperty('--pad', `${g.padding}px`);
  el.style.setProperty('--footer-h', `${g.footerHeight}px`);
}

export interface Section {
  text: string;
  /** 0-based page (column) within the chapter the heading starts on. */
  page: number;
}

export interface ChapterLayout {
  pageCount: number;
  sections: Section[];
}

export interface FlowOptions {
  /** Style the first heading as a chapter opener (affects layout, so the probe needs it too). */
  opener: boolean;
  subTag: 'H2' | 'H3';
}

export async function measureChapter(html: string, g: PageGeometry, opts: FlowOptions): Promise<ChapterLayout> {
  const probe = document.createElement('div');
  probe.className = 'flow flow--probe';
  probe.lang = 'en';
  if (opts.opener) probe.dataset.opener = '1';
  applyFlowVars(probe, g);
  probe.innerHTML = html;
  document.body.appendChild(probe);
  try {
    await document.fonts.ready;
    await waitForImages(probe);
    const stride = g.innerWidth + g.gap;
    const pageCount = Math.max(1, Math.round((probe.scrollWidth + g.gap) / stride));
    const left0 = probe.getBoundingClientRect().left;
    const sections: Section[] = [];
    for (const h of Array.from(probe.querySelectorAll<HTMLElement>(opts.subTag))) {
      const dx = h.getBoundingClientRect().left - left0;
      const page = Math.min(pageCount - 1, Math.max(0, Math.round(dx / stride)));
      sections.push({ text: (h.textContent ?? '').trim(), page });
    }
    return { pageCount, sections };
  } finally {
    probe.remove();
  }
}

export function waitForImages(root: ParentNode): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete) return resolve();
          const done = () => resolve();
          img.addEventListener('load', done, { once: true });
          img.addEventListener('error', done, { once: true });
        }),
    ),
  ).then(() => undefined);
}
