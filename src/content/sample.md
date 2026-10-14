# Why Books Stick

*A short field guide to the idea behind this reader.*

Most of us learned to learn from paper. Long before anyone handed us a glowing rectangle, we sat with books that had weight, smell, and a particular sound when a page gave way under a thumb. Those sensations were not decoration. They were the scaffolding on which memory was built.

This document is the sample that ships with the reader. It exists so you can feel the thing before you judge it. Flip a page. Listen. Then open one of your own files and see whether it reads differently.

## The argument in one paragraph

Human memory is anchored to context. The brain stores not only *what* you read but *where* on the page it sat, how far into the book it was, how the paper felt, and what you heard as you turned to it. Screens strip most of that away. Every page of a scrolling document looks like every other page, and nothing marks progress but a thin grey bar. A book gives you a hundred tiny landmarks for free.

> "I remember it was on the left page, near the bottom, just after the diagram."
> Nobody has ever said this about a web page.

## What the reader does

The reader takes an ordinary Markdown file and lays it out the way a printer would: fixed pages, a left and a right, running page numbers, justified text with proper hyphenation. Then it lets you turn those pages with a drag or a key press, and it makes a sound when you do.

Three things matter most, in this order:

1. **Pagination that feels inevitable.** Headings do not dangle at the bottom of a page. Code blocks do not split in half. The text block is the same size on every page.
2. **A flip that behaves like paper.** The page bends from the corner you grab, casts a shadow on its neighbour, and lands with a small sound.
3. **Texture you barely notice.** The paper is not white. It has grain, a faint warmth, and a shadow near the spine. You should not be able to point at any of it, but you should miss it when it is gone.

### Things it deliberately does not do yet

- No table of contents, no cover, no chapter openers. Those arrive in the next phase.
- No bookmarks or highlights.
- No way to load a folder of files as one book.

## Markdown is the right input

Markdown is the lingua franca of notes, documentation, and drafts. Obsidian vaults, GitHub repositories, and most static-site generators all speak it. A reader that accepts Markdown accepts most of the writing people actually produce, without asking them to export anything.

Here is what a code block looks like on the page. It stays whole, wraps long lines rather than scrolling, and sits on the paper instead of in a white box:

```ts
export async function measurePageCount(html: string, g: PageGeometry) {
  const probe = document.createElement('div');
  probe.className = 'flow flow--probe';
  probe.innerHTML = html;
  document.body.appendChild(probe);
  await document.fonts.ready;
  const stride = g.innerWidth + g.gap;
  return Math.max(1, Math.round((probe.scrollWidth + g.gap) / stride));
}
```

Tables work too, within the limits of a narrow page:

| Sense     | Paper book            | Scrolling page       |
| --------- | --------------------- | -------------------- |
| Sight     | Fixed, two-page frame | Endless, uniform     |
| Touch     | Weight, grain, edge   | Glass                |
| Sound     | Rustle, thump         | Silence              |
| Position  | Left/right, depth     | A grey progress bar  |

And a little mathematics, because technical notes have equations in them. The classic forgetting curve can be written as

$$
R(t) = e^{-t/S}
$$

where $R$ is retrievability, $t$ is time, and $S$ is the stability of the memory. The claim of this project is modest: context raises $S$.

## How pagination works under the hood

The browser is very good at breaking lines and very bad at telling you where a page ends. So we cheat. The entire document is laid out once as a single CSS multi-column flow whose column width is the width of the text block and whose height is the height of the text block. The browser pours the content into column after column, and each column is one page.

A page on screen is then just a window onto that flow, shifted left by some number of columns. Fonts are awaited before measuring, images are awaited before measuring, and the whole thing is redone when the window changes size. The reader keeps your place as a fraction of the book so a resize does not throw you back to the start.

This approach has limits. A single image taller than the page gets scaled down. A table wider than the page is squeezed. A fifty-thousand-word document produces a few hundred pages, and only the pages near the one you are reading hold any real content. The rest are empty shells until you get close.

---

## A note on sound

There are no recordings in this build. The flip sound is synthesised on the fly: a short burst of pink noise, swept through a band-pass filter to mimic the rustle of a moving sheet, followed by a quiet low thump as the page lands. Each flip is slightly different, which is the point. A real book never sounds exactly the same twice.

Browsers refuse to play audio until you have interacted with the page. The first key press or click unlocks it, which is why the very first flip may be silent.

## What to try

Open one of your own Markdown files. A long README works well. So does a chapter of notes from a course. Read for five minutes with the sound on, then five minutes with it off, and notice which one you remember better an hour later.

If the answer is "the one with the sound," this project has a reason to exist.

### Credits

Set in Literata, a typeface designed for reading long texts on screens. Page turning by StPageFlip. Markdown parsed by the unified ecosystem, with KaTeX for mathematics and Shiki for code.

*End of sample.*
