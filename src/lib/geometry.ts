/**
 * Page geometry in layout pixels. Once computed for a document it is locked
 * (see storage.ts) so pagination, and therefore every page number, stays the
 * same across sessions and window sizes. The book is then scaled visually to
 * fit the current stage with fitScale().
 */
export interface PageGeometry {
  pageWidth: number;
  pageHeight: number;
  padding: number;
  footerHeight: number;
  innerWidth: number;
  innerHeight: number;
  /** Column gap between virtual pages in the flow. */
  gap: number;
  fontSize: number;
}

export interface Fit {
  scale: number;
  portrait: boolean;
}

const ASPECT = 1.45; // close to a 6x9in trade paperback
const STAGE_MARGIN = 40;
const EDGE_ROOM = 64; // space for the page-edge stacks either side

export function computeGeometry(stageWidth: number, stageHeight: number, fontScale = 1): PageGeometry {
  const availW = Math.max(240, stageWidth - STAGE_MARGIN - EDGE_ROOM);
  const availH = Math.max(320, stageHeight - STAGE_MARGIN);
  const portrait = stageWidth < 720;

  let pageWidth = portrait ? availW : Math.min(availW / 2, 640);
  let pageHeight = pageWidth * ASPECT;
  if (pageHeight > availH) {
    pageHeight = availH;
    pageWidth = pageHeight / ASPECT;
  }
  pageWidth = Math.floor(pageWidth);
  pageHeight = Math.floor(pageHeight);

  const padding = Math.round(clamp(pageWidth * 0.1, 22, 56));
  const footerHeight = 28;
  const fontSize = clamp(pageWidth / 34, 13, 19) * fontScale;

  return {
    pageWidth,
    pageHeight,
    padding,
    footerHeight,
    innerWidth: pageWidth - padding * 2,
    innerHeight: pageHeight - padding * 2 - footerHeight,
    gap: 48,
    fontSize,
  };
}

export function fitScale(g: PageGeometry, stageWidth: number, stageHeight: number): Fit {
  const portrait = stageWidth < 720;
  const availW = Math.max(200, stageWidth - (portrait ? 24 : STAGE_MARGIN + EDGE_ROOM));
  const availH = Math.max(200, stageHeight - (portrait ? 24 : STAGE_MARGIN));
  const bookW = portrait ? g.pageWidth : g.pageWidth * 2;
  // Never enlarge beyond the locked layout: upscaled text looks soft, and a
  // layout locked on a small screen is better fixed with the text-size control.
  const scale = clamp(Math.min(availW / bookW, availH / g.pageHeight), 0.3, 1);
  return { scale, portrait };
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
