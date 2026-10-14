import { useCallback, useEffect, useMemo, useState } from 'react';
import { BookView, type BookApi } from './components/BookView';
import { Toolbar } from './components/Toolbar';
import { DropZone } from './components/DropZone';
import { markdownToHtml, prepareDocument, type DocMeta } from './lib/markdown';
import { playFlip, prefetchSamples, unlockAudio } from './lib/audio';
import { docKey, loadState, saveState } from './lib/storage';
import sample from './content/sample.md?raw';

prefetchSamples();

type Status = 'idle' | 'parsing' | 'laying-out' | 'ready';

interface Source {
  markdown: string;
  name: string;
}

const SOUND_KEY = 'markdown-book.sound';

function readSoundPref(): boolean {
  try {
    return localStorage.getItem(SOUND_KEY) === 'on';
  } catch {
    return false;
  }
}

function writeSoundPref(on: boolean): void {
  try {
    localStorage.setItem(SOUND_KEY, on ? 'on' : 'off');
  } catch {
    // private mode or blocked storage: the choice just lasts for this visit
  }
}

export default function App() {
  const [source, setSource] = useState<Source>({ markdown: sample, name: 'Untitled' });
  const [doc, setDoc] = useState<{ html: string; meta: DocMeta; key: string } | null>(null);
  const [status, setStatus] = useState<Status>('idle');
  const [pageLabel, setPageLabel] = useState('');
  const [pageIndex, setPageIndex] = useState(0);
  const [soundOn, setSoundOn] = useState(readSoundPref);
  const [justEnabled, setJustEnabled] = useState(false);
  const [fontScale, setFontScale] = useState(1);
  const [api, setApi] = useState<BookApi | null>(null);

  const storageKey = useMemo(() => docKey(source.markdown), [source.markdown]);

  useEffect(() => {
    let cancelled = false;
    setStatus('parsing');
    setApi(null);
    setFontScale(loadState(storageKey).fontScale);
    const prepared = prepareDocument(source.markdown, source.name);
    markdownToHtml(prepared.body)
      .then((html) => {
        if (!cancelled) setDoc({ html, meta: prepared.meta, key: storageKey });
      })
      .catch((err) => {
        console.error(err);
        if (!cancelled) {
          setDoc({
            html: `<p><strong>Could not render this file.</strong></p><pre>${String(err)}</pre>`,
            meta: prepared.meta,
            key: storageKey,
          });
        }
      });
    return () => {
      cancelled = true;
    };
  }, [source, storageKey]);

  const openFile = useCallback((file: File) => {
    file.text().then((text) => {
      setSource({ markdown: text, name: file.name.replace(/\.(md|markdown|txt)$/i, '') });
    });
  }, []);

  const title = doc?.meta.title ?? '';
  useEffect(() => {
    document.title = title ? `${title} · Markdown Book` : 'Markdown Book';
  }, [title]);

  const setSound = (on: boolean) => {
    if (on) {
      // Called from a click handler, so this is a valid user gesture:
      // unlock the context and play one flip so the user can confirm output.
      unlockAudio();
      playFlip();
      setJustEnabled(true);
      window.setTimeout(() => setJustEnabled(false), 1600);
    }
    setSoundOn(on);
    writeSoundPref(on);
  };

  const changeFontScale = (next: number) => {
    if (!doc) return;
    saveState(doc.key, { ...loadState(doc.key), fontScale: next });
    setFontScale(next);
  };

  const onCover = status === 'ready' && pageIndex === 0;
  const showSoundPrompt = onCover && (!soundOn || justEnabled);
  const showResume = onCover && !!api?.resume;

  return (
    <div className="app">
      <Toolbar
        title={title}
        pageLabel={pageLabel}
        status={status}
        soundOn={soundOn}
        fontScale={fontScale}
        onToggleSound={() => setSound(!soundOn)}
        onFontScale={changeFontScale}
        onOpenFile={openFile}
      />
      <main className="stage-wrap">
        {doc && (
          <BookView
            html={doc.html}
            meta={doc.meta}
            storageKey={doc.key}
            fontScale={fontScale}
            soundOn={soundOn}
            onProgress={(info) => {
              setPageLabel(info.label);
              setPageIndex(info.index);
            }}
            onStatus={setStatus}
            onReady={setApi}
          />
        )}
        {(showSoundPrompt || showResume) && (
          <div className="cover-prompts">
            {showResume && api?.resume && (
              <button type="button" className="resume-btn" onClick={() => api.goTo(api.resume!.index)}>
                Resume at page {api.resume.label}
              </button>
            )}
            {showSoundPrompt && (
              <div className={`sound-prompt${justEnabled ? ' sound-prompt--done' : ''}`} role="status">
                {justEnabled ? (
                  <span className="sound-prompt-done">🔊 Sound is on</span>
                ) : (
                  <>
                    <button type="button" className="sound-prompt-btn" onClick={() => setSound(true)}>
                      🔈 Turn page sounds on
                    </button>
                    <span className="sound-prompt-hint">
                      Browsers keep audio off until you click. No sound after clicking? Check the tab is not muted and
                      the volume is up.
                    </span>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </main>
      <DropZone onFile={openFile} />
    </div>
  );
}
