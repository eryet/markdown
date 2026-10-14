// page-flip ships no .d.ts in its npm package; this covers the surface we use.
declare module 'page-flip' {
  export type FlipState = 'read' | 'flipping' | 'user_fold' | 'fold_corner';
  export type Orientation = 'portrait' | 'landscape';

  export interface FlipSettings {
    startPage: number;
    size: 'fixed' | 'stretch';
    width: number;
    height: number;
    minWidth: number;
    maxWidth: number;
    minHeight: number;
    maxHeight: number;
    drawShadow: boolean;
    flippingTime: number;
    usePortrait: boolean;
    startZIndex: number;
    autoSize: boolean;
    maxShadowOpacity: number;
    showCover: boolean;
    mobileScrollSupport: boolean;
    swipeDistance: number;
    clickEventForward: boolean;
    useMouseEvents: boolean;
    showPageCorners: boolean;
    disableFlipByClick: boolean;
  }

  export interface FlipEvent<T = unknown> {
    data: T;
    object: PageFlip;
  }

  export class PageFlip {
    constructor(element: HTMLElement, settings: Partial<FlipSettings>);
    loadFromHTML(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    updateFromHtml(items: NodeListOf<HTMLElement> | HTMLElement[]): void;
    loadFromImages(urls: string[]): void;
    flipNext(corner?: 'top' | 'bottom'): void;
    flipPrev(corner?: 'top' | 'bottom'): void;
    turnToPage(page: number): void;
    turnToNextPage(): void;
    turnToPrevPage(): void;
    getCurrentPageIndex(): number;
    getPageCount(): number;
    getOrientation(): Orientation;
    getState(): FlipState;
    getSettings(): FlipSettings;
    on(event: 'flip', cb: (e: FlipEvent<number>) => void): PageFlip;
    on(event: 'changeState', cb: (e: FlipEvent<FlipState>) => void): PageFlip;
    on(event: 'changeOrientation', cb: (e: FlipEvent<Orientation>) => void): PageFlip;
    on(event: 'init' | 'update', cb: (e: FlipEvent<{ page: number; mode: Orientation }>) => void): PageFlip;
    off(event: string): void;
    update(): void;
    clear(): void;
    destroy(): void;
  }
}
