import { useEffect, useMemo, useRef } from 'react';
import { createBook, type BookHandle, type FlipInfo } from '../lib/book';
import { splitChapters } from '../lib/chapters';
import { computeGeometry, fitScale } from '../lib/geometry';
import { playFlip, unlockAudio } from '../lib/audio';
import type { DocMeta } from '../lib/markdown';
import { loadState, saveState } from '../lib/storage';

export interface BookApi {
  goTo: (index: number) => void;
  resume: { index: number; label: string } | null;
}

interface Props {
  html: string;
  meta: DocMeta;
  /** localStorage key for this document's layout, position and marks. */
  storageKey: string;
  fontScale: number;
  soundOn: boolean;
  onProgress: (info: FlipInfo) => void;
  onStatus: (status: 'laying-out' | 'ready') => void;
  onReady: (api: BookApi) => void;
}

export function BookView({ html, meta, storageKey, fontScale, soundOn, onProgress, onStatus, onReady }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const mountRef = useRef<HTMLDivElement>(null);
  const bookRef = useRef<BookHandle | null>(null);
  const soundRef = useRef(soundOn);
  soundRef.current = soundOn;
  const progressRef = useRef(onProgress);
  progressRef.current = onProgress;
  const statusRef = useRef(onStatus);
  statusRef.current = onStatus;
  const readyRef = useRef(onReady);
  readyRef.current = onReady;
  const metaRef = useRef(meta);
  metaRef.current = meta;

  const chapters = useMemo(() => splitChapters(html, meta.title), [html, meta.title]);

  useEffect(() => {
    const stage = stageRef.current;
    const mount = mountRef.current;
    if (!stage || !mount) return;

    let cancelled = false;
    let timer: number | undefined;
    // Where the previous session ended; read once per document for the resume button.
    const resumeAt = loadState(storageKey).position;

    const build = async () => {
      statusRef.current('laying-out');
      const rect = stage.getBoundingClientRect();

      // Lock geometry per document so page numbers stay stable; only a font
      // size change (fontScale) re-lays the book out.
      const state = loadState(storageKey);
      let g = state.layout;
      if (!g || state.fontScale !== fontScale) {
        g = computeGeometry(rect.width, rect.height, fontScale);
        saveState(storageKey, { ...state, layout: g, fontScale });
      }
      const fit = fitScale(g, rect.width, rect.height);

      const prev = bookRef.current;
      const startPage = prev ? prev.current() : 0;
      if (prev) {
        prev.destroy();
        bookRef.current = null;
      }

      const handle = await createBook(mount, {
        chapters,
        meta: metaRef.current,
        geometry: g,
        fit,
        startPage,
        resumeAt,
        onFlipStart: () => {
          if (soundRef.current) playFlip();
        },
        onFlip: (info) => {
          progressRef.current(info);
          if (info.inBody) {
            const s = loadState(storageKey);
            if (s.position !== info.index) saveState(storageKey, { ...s, position: info.index });
          }
        },
      });
      if (cancelled) {
        handle.destroy();
        return;
      }
      bookRef.current = handle;
      statusRef.current('ready');
      readyRef.current({ goTo: handle.goTo, resume: handle.resume });
    };

    void build();

    const ro = new ResizeObserver(() => {
      window.clearTimeout(timer);
      timer = window.setTimeout(() => void build(), 250);
    });
    ro.observe(stage);

    const onKey = (e: KeyboardEvent) => {
      const b = bookRef.current;
      if (!b) return;
      if (e.key === 'ArrowRight' || e.key === ' ' || e.key === 'PageDown') {
        e.preventDefault();
        unlockAudio();
        b.next();
      } else if (e.key === 'ArrowLeft' || e.key === 'PageUp') {
        e.preventDefault();
        unlockAudio();
        b.prev();
      } else if (e.key === 'Home') {
        b.goTo(0);
      } else if (e.key === 'End') {
        b.goTo(b.pageCount - 1);
      }
    };
    window.addEventListener('keydown', onKey);
    const onPointer = () => unlockAudio();
    stage.addEventListener('pointerdown', onPointer);

    return () => {
      cancelled = true;
      ro.disconnect();
      window.clearTimeout(timer);
      window.removeEventListener('keydown', onKey);
      stage.removeEventListener('pointerdown', onPointer);
      bookRef.current?.destroy();
      bookRef.current = null;
    };
  }, [chapters, storageKey, fontScale]);

  const nav = (dir: 'prev' | 'next') => {
    unlockAudio();
    const b = bookRef.current;
    if (!b) return;
    if (dir === 'next') b.next();
    else b.prev();
  };

  return (
    <div ref={stageRef} className="book-stage">
      <div ref={mountRef} className="book-mount" />
      <button type="button" className="nav nav--prev" aria-label="Previous page" onClick={() => nav('prev')}>
        ‹
      </button>
      <button type="button" className="nav nav--next" aria-label="Next page" onClick={() => nav('next')}>
        ›
      </button>
    </div>
  );
}
