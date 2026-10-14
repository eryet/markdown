# Markdown Book

Read Markdown files like a physical book: two-page spreads, page flips, paper texture, and a sound when the page lands.

## Run

```sh
pnpm install
pnpm dev
```

Open the printed URL, then drag a `.md` file onto the window or use **Open .md**.

| Action | How |
| --- | --- |
| Flip | Arrow keys, space, the side arrows, or drag a page corner |
| Jump | Click a contents entry, or Resume on the cover |
| Text size | A− / A+ in the toolbar (re-lays the book out, so page numbers change) |
| Sound | Accept the prompt on the cover, or the toolbar toggle |

Page numbers are locked per document on first open, so a page keeps its number across sessions and window sizes.

## Scripts

| Command          | What it does                      |
| ---------------- | --------------------------------- |
| `pnpm dev`       | Dev server with hot reload        |
| `pnpm build`     | Type check, then production build |
| `pnpm preview`   | Serve the production build        |
| `pnpm typecheck` | Type check only                   |

## Layout

```
src/
  lib/
    markdown.ts   Markdown -> sanitized HTML (unified, katex, shiki)
    geometry.ts   Page size from the viewport
    paginate.ts   CSS-column probe that counts pages
    chapters.ts   Split HTML into chapters; accent colour and ornament per chapter
    book.ts       Page assembly (cover, contents, chapters), flip engine, edge stacks
    storage.ts    Per-document layout lock and reading position in localStorage
    audio.ts      Page-turn samples (CC0) with pitch/gain variation
  components/     React chrome: BookView, Toolbar, DropZone
  styles/         globals.css (UI), book.css (paper + typography)
  content/        Bundled sample document
docs/PLAN.md      Phased product plan and risks
```

See `docs/PLAN.md` for the roadmap.
