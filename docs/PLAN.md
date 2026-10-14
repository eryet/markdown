# Markdown Book: product plan

Turn a Markdown file into something that reads like a physical book: two-page spreads, a page that bends when you flip it, a sound when it lands, paper that has grain.

## Why

Memory is context-bound. Readers who grew up with paper have thousands of sensory anchors (where on the page, how deep into the book, the feel of the paper, the sound of the turn) and those anchors make recall easier. Scrolling documents give the brain almost none of them. The product thesis: restore those anchors for the writing people actually produce, which is Markdown.

## Competitive landscape (checked 2026-10-14)

| Project | What it is | Threat |
| --- | --- | --- |
| araix/Markdown-Flipbook | React markdown flipbook. 1 star, no license, last push Aug 2025. | Low. Proof of concept, abandoned. Do not copy code (no license). |
| Readest | Active open-source ebook reader (25k stars, AGPL). Reads Markdown, paginated mode, page-turn animation. No sound or texture. | Medium. Great pagination, but a general reader. Do not fork (AGPL). |
| BookLike | Chrome extension: reader mode with page flips for web pages. | Low. |
| Paperturn, Flipsnack, AnyFlip, FlipBuilder | Commercial PDF to flipbook. | Sets the visual bar for flip quality. Different input. |

Differentiation: sensory realism and the learning thesis, not "markdown in, pages out."

## Phase 0: spike (this build)

Question to answer: does flipping a Markdown doc with sound actually feel better?

- Vite + React 19 + TypeScript + Tailwind v4. Client-only, no backend.
- Markdown via unified: remark-gfm, remark-math, rehype-sanitize (before katex/shiki so author HTML is stripped but generated markup survives), rehype-katex, @shikijs/rehype.
- Pagination: CSS multi-column flow, one column per page, pages are clipped windows onto the flow. Fonts and images awaited before measuring. Re-laid out on resize, position kept as a fraction.
- Flip: StPageFlip (`page-flip`, MIT). Fallback if it misbehaves: hand-rolled CSS 3D two-face flip.
- Sound: six CC0 page-turn recordings from Freesound (`public/sounds/`, credits in `docs/LICENSES.md`), pre-decoded at startup, peak-normalized, played with random pitch and gain variation. Sound is off until the user accepts the prompt on the cover, which also satisfies the browser's gesture requirement. Drags trigger the sound on release (the engine never enters its "flipping" state for a drag), keyboard and buttons on the state change.
- Virtualization: all page shells exist, content only populated within 4 pages of the current spread.
- Input: bundled sample, drag and drop, or Open button.

## Phase 1a: spatial landmarks (done 2026-10-14)

The memory thesis needs every place in the book to look different. Built:

- Chapters split at the top-level heading (H1 if several, else H2), paginated separately, each opening on a right-hand page with a chapter label, an ornament and an accent colour derived from the title, a centered title with a rule, and a drop cap. Blank versos are inserted as a printer would.
- Running heads: chapter title on left pages, current section on right pages, none on opener pages.
- Page-edge stacks either side whose thickness tracks pages before and after the current spread.
- Resume button on the cover that jumps to the previous session's spread. (A visual ribbon bookmark was tried and removed the same day.)
- Dog-ears were tried and removed on 2026-10-14: the fold did not look convincing and double-click was not discoverable. Bookmarks will return as part of margin notes in Tier 2.
- Locked geometry per document (keyed by a hash of the markdown): page size and font size are fixed on first open and the book is scaled to fit, so page numbers never change between sessions. The A−/A+ controls deliberately re-lock.
- Page 1 is the first right-hand page after the contents, as in print.

## Phase 1b: remaining prototype items

- Title page from frontmatter beyond title/subtitle/author (date, edition).
- Themes: paper, sepia, night.
- Mobile: single-page mode exists via scaling; swipe gestures still untested on touch.
- Load from URL (GitHub raw, gists).
- Audition and prune the six samples down to the three or four that sound best; add a distinct, heavier sound for the hard cover.
- Reduced-motion and screen-reader paths.
- Chapter splitting currently treats content before the first heading as an untitled chapter headed by the book title.

## Phase 2: product (weeks 3 to 6)

- Folder or zip of Markdown becomes a multi-chapter book (Obsidian vaults, docs repos).
- Local library in IndexedDB. Reading position stored as a content anchor, never a page number.
- Bookmarks, highlights, margin notes.
- Installable PWA, offline.
- Export to EPUB and print PDF.
- Landing page with a live demo as the hero.

Later: embed widget for docs sites, Obsidian plugin, paid tier for sync and custom themes.

## Mistakes designed out

- Measure after `document.fonts.ready` and after images have dimensions.
- Audio only after a user gesture; never promise sound on load.
- Content taller than a page: images capped at 70% of text height, code wraps instead of scrolling, blocks use `break-inside: avoid`.
- Long documents: virtualize from day one.
- Respect `prefers-reduced-motion`.
- Check licenses on every sound and font. Avoid AGPL dependencies in the core.
- Sanitize all author-supplied Markdown before rendering.

## Open risks to watch in Phase 0

- StPageFlip is lightly maintained (last push Jan 2024). If HTML mode fights with our clipped-clone pages, switch to the CSS 3D fallback.
- Column-based pagination can drift between the probe and the real pages if any CSS differs. Both must use the same `.flow` class and CSS vars.
- Odd page counts are padded to even for spreads; the trailing blank page is visible.
