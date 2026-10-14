import { useRef } from 'react';

interface Props {
  title: string;
  pageLabel: string;
  status: 'idle' | 'parsing' | 'laying-out' | 'ready';
  soundOn: boolean;
  fontScale: number;
  onToggleSound: () => void;
  onFontScale: (next: number) => void;
  onOpenFile: (file: File) => void;
}

const FONT_STEPS = [0.85, 1, 1.15, 1.3];

export function Toolbar({ title, pageLabel, status, soundOn, fontScale, onToggleSound, onFontScale, onOpenFile }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const stepIndex = FONT_STEPS.findIndex((s) => Math.abs(s - fontScale) < 0.01);
  const canSmaller = stepIndex > 0;
  const canLarger = stepIndex >= 0 && stepIndex < FONT_STEPS.length - 1;

  return (
    <header className="toolbar">
      <div className="toolbar-left">
        <span className="brand">Markdown Book</span>
        <span className="title" title={title}>
          {title}
        </span>
      </div>
      <div className="toolbar-center">
        {status === 'ready' ? <span className="pages">{pageLabel}</span> : <span className="pages muted">{statusLabel(status)}</span>}
      </div>
      <div className="toolbar-right">
        <span className="hint">← → flip · drag a corner</span>
        <span className="btn-group" title="Text size. Changing it re-lays the book out, so page numbers change.">
          <button type="button" className="btn" disabled={!canSmaller} onClick={() => onFontScale(FONT_STEPS[stepIndex - 1])} aria-label="Smaller text">
            A−
          </button>
          <button type="button" className="btn" disabled={!canLarger} onClick={() => onFontScale(FONT_STEPS[stepIndex + 1])} aria-label="Larger text">
            A+
          </button>
        </span>
        <button type="button" className="btn" onClick={onToggleSound} aria-pressed={soundOn}>
          {soundOn ? '🔊 Sound on' : '🔇 Sound off'}
        </button>
        <button type="button" className="btn btn-primary" onClick={() => inputRef.current?.click()}>
          Open .md
        </button>
        <input
          ref={inputRef}
          type="file"
          accept=".md,.markdown,.txt,text/markdown"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) onOpenFile(f);
            e.target.value = '';
          }}
        />
      </div>
    </header>
  );
}

function statusLabel(s: Props['status']): string {
  switch (s) {
    case 'parsing':
      return 'Rendering markdown…';
    case 'laying-out':
      return 'Laying out pages…';
    default:
      return '';
  }
}
