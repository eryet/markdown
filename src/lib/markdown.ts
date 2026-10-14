import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkRehype from 'remark-rehype';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import rehypeKatex from 'rehype-katex';
import rehypeShiki from '@shikijs/rehype';
import rehypeStringify from 'rehype-stringify';

/**
 * Markdown -> sanitized HTML string.
 *
 * Order matters: sanitize runs BEFORE katex and shiki. Both of those generate
 * markup purely from text content, so their output is trusted, while anything
 * the author wrote (raw HTML, odd attributes) is stripped first. Running the
 * sanitizer after them would strip katex/shiki styles and break rendering.
 */
const processor = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkMath)
  .use(remarkRehype)
  .use(rehypeSanitize, {
    ...defaultSchema,
    // The default GitHub schema already allows `language-*`, `math-inline`
    // and `math-display` classes on <code>, which is what katex/shiki need.
    clobberPrefix: '',
  })
  .use(rehypeKatex)
  .use(rehypeShiki, {
    theme: 'github-light',
    fallbackLanguage: 'text',
    defaultLanguage: 'text',
    onError: (err) => console.warn('[shiki]', err),
  })
  .use(rehypeStringify);

export async function markdownToHtml(markdown: string): Promise<string> {
  const file = await processor.process(markdown);
  return String(file);
}

export interface DocMeta {
  title: string;
  subtitle?: string;
  author?: string;
}

export interface PreparedDoc {
  meta: DocMeta;
  /** Markdown body with frontmatter and the title heading removed. */
  body: string;
}

/**
 * Split a Markdown source into book metadata and body.
 *
 * - YAML-ish frontmatter (`title`, `subtitle`, `author`) is read and removed.
 * - If the document has exactly one H1 and it comes first, that H1 is the
 *   book title and is lifted onto the cover. An italic-only line right after
 *   it becomes the subtitle. With several H1s they are chapters and stay put.
 */
export function prepareDocument(source: string, fallbackTitle: string): PreparedDoc {
  let text = source.replace(/^﻿/, '');
  const fm: Record<string, string> = {};
  const fmMatch = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (fmMatch) {
    for (const line of fmMatch[1].split(/\r?\n/)) {
      const kv = line.match(/^([A-Za-z_][\w-]*)\s*:\s*(.*)$/);
      if (kv) fm[kv[1].toLowerCase()] = kv[2].trim().replace(/^(["'])(.*)\1$/, '$2');
    }
    text = text.slice(fmMatch[0].length);
  }

  const lines = text.split(/\r?\n/);
  const h1s: number[] = [];
  let inFence = false;
  lines.forEach((l, i) => {
    if (/^\s*(```|~~~)/.test(l)) {
      inFence = !inFence;
      return;
    }
    if (!inFence && /^#\s+\S/.test(l)) h1s.push(i);
  });

  let title = fm.title;
  let subtitle = fm.subtitle;
  const author = fm.author;

  if (h1s.length === 1 && lines.slice(0, h1s[0]).every((l) => l.trim() === '')) {
    const i = h1s[0];
    title ??= lines[i].replace(/^#\s+/, '').replace(/\s+#+\s*$/, '').trim();
    lines.splice(i, 1);
    let j = i;
    while (j < lines.length && lines[j].trim() === '') j++;
    const sub = lines[j]?.match(/^\s*([*_])(.+)\1\s*$/);
    if (sub) {
      subtitle ??= sub[2].trim();
      lines.splice(j, 1);
    }
  }

  return {
    meta: {
      title: (title ?? fallbackTitle).replace(/[*_`]/g, '').trim() || fallbackTitle,
      subtitle: subtitle?.replace(/[*_`]/g, '').trim() || undefined,
      author: author?.trim() || undefined,
    },
    body: lines.join('\n'),
  };
}
