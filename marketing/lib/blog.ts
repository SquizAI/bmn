import fs from 'fs';
import path from 'path';

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

export interface BlogPost {
  slug: string;
  title: string;
  date: string;
  author: string;
  excerpt: string;
  tags: string[];
  readingTime: string;
  coverImage?: string;
  content: string;
}

/* ------------------------------------------------------------------ */
/*  Paths                                                              */
/* ------------------------------------------------------------------ */

const CONTENT_DIR = path.join(process.cwd(), 'content', 'blog');

/* ------------------------------------------------------------------ */
/*  Frontmatter parser (no external deps)                              */
/* ------------------------------------------------------------------ */

function parseFrontmatter(raw: string): { data: Record<string, unknown>; content: string } {
  const FM_REGEX = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
  const match = raw.match(FM_REGEX);

  if (!match) {
    return { data: {}, content: raw };
  }

  const yamlBlock = match[1];
  const content = match[2];
  const data: Record<string, unknown> = {};

  for (const line of yamlBlock.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const colonIdx = trimmed.indexOf(':');
    if (colonIdx === -1) continue;

    const key = trimmed.slice(0, colonIdx).trim();
    let value: unknown = trimmed.slice(colonIdx + 1).trim();

    // Strip surrounding quotes
    if (typeof value === 'string') {
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = (value as string).slice(1, -1);
      }
    }

    // Parse arrays: ["a", "b"]
    if (typeof value === 'string' && value.startsWith('[') && value.endsWith(']')) {
      try {
        value = JSON.parse(value);
      } catch {
        // keep as string
      }
    }

    data[key] = value;
  }

  return { data, content };
}

/* ------------------------------------------------------------------ */
/*  Markdown to HTML (lightweight, no deps)                            */
/* ------------------------------------------------------------------ */

export function markdownToHtml(md: string): string {
  let html = md;

  // Headings (must come before paragraph wrapping)
  html = html.replace(/^######\s+(.+)$/gm, '<h6 id="$slug">$1</h6>');
  html = html.replace(/^#####\s+(.+)$/gm, '<h5 id="$slug">$1</h5>');
  html = html.replace(/^####\s+(.+)$/gm, '<h4 id="$slug">$1</h4>');
  html = html.replace(/^###\s+(.+)$/gm, '<h3>$1</h3>');
  html = html.replace(/^##\s+(.+)$/gm, '<h2>$1</h2>');
  html = html.replace(/^#\s+(.+)$/gm, '<h1>$1</h1>');

  // Add id slugs to h2 and h3 for table of contents
  html = html.replace(/<h2>(.*?)<\/h2>/g, (_match, text) => {
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `<h2 id="${id}">${text}</h2>`;
  });
  html = html.replace(/<h3>(.*?)<\/h3>/g, (_match, text) => {
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    return `<h3 id="${id}">${text}</h3>`;
  });

  // Horizontal rules
  html = html.replace(/^---$/gm, '<hr />');

  // Bold + italic
  html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
  html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

  // Inline code
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Images
  html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1" />');

  // Links
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Blockquotes
  html = html.replace(/^>\s+(.+)$/gm, '<blockquote><p>$1</p></blockquote>');
  // Merge adjacent blockquotes
  html = html.replace(/<\/blockquote>\s*<blockquote>/g, '');

  // Unordered lists
  html = html.replace(/^[-*]\s+(.+)$/gm, '<li>$1</li>');
  html = html.replace(/((?:<li>.*<\/li>\s*)+)/g, '<ul>$1</ul>');

  // Ordered lists
  html = html.replace(/^\d+\.\s+(.+)$/gm, '<li>$1</li>');

  // Paragraphs: wrap standalone text lines
  const lines = html.split('\n');
  const result: string[] = [];
  let inBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      result.push('');
      continue;
    }
    // Check if line is already wrapped in a block-level element
    if (/^<(h[1-6]|ul|ol|li|blockquote|hr|pre|div|table|img)/.test(trimmed)) {
      inBlock = true;
      result.push(line);
      continue;
    }
    if (inBlock && /^<\/(ul|ol|blockquote|pre|div|table)>/.test(trimmed)) {
      inBlock = false;
      result.push(line);
      continue;
    }
    if (inBlock) {
      result.push(line);
      continue;
    }
    result.push(`<p>${trimmed}</p>`);
  }

  return result.join('\n');
}

/* ------------------------------------------------------------------ */
/*  Extract headings for table of contents                             */
/* ------------------------------------------------------------------ */

export interface TocEntry {
  level: number;
  text: string;
  id: string;
}

export function extractToc(md: string): TocEntry[] {
  const headings: TocEntry[] = [];
  const regex = /^(#{2,3})\s+(.+)$/gm;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(md)) !== null) {
    const level = match[1].length;
    const text = match[2].trim();
    const id = text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    headings.push({ level, text, id });
  }

  return headings;
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

export function getPostSlugs(): string[] {
  if (!fs.existsSync(CONTENT_DIR)) return [];
  return fs
    .readdirSync(CONTENT_DIR)
    .filter((f) => f.endsWith('.mdx') || f.endsWith('.md'))
    .map((f) => f.replace(/\.mdx?$/, ''));
}

export function getPostBySlug(slug: string): BlogPost | null {
  const mdxPath = path.join(CONTENT_DIR, `${slug}.mdx`);
  const mdPath = path.join(CONTENT_DIR, `${slug}.md`);
  const filePath = fs.existsSync(mdxPath) ? mdxPath : fs.existsSync(mdPath) ? mdPath : null;

  if (!filePath) return null;

  const raw = fs.readFileSync(filePath, 'utf-8');
  const { data, content } = parseFrontmatter(raw);

  return {
    slug,
    title: (data.title as string) ?? slug,
    date: (data.date as string) ?? '',
    author: (data.author as string) ?? 'Brand Me Now Team',
    excerpt: (data.excerpt as string) ?? '',
    tags: Array.isArray(data.tags) ? (data.tags as string[]) : [],
    readingTime: (data.readingTime as string) ?? '',
    coverImage: (data.coverImage as string) ?? undefined,
    content: content.trim(),
  };
}

export function getAllPosts(): BlogPost[] {
  const slugs = getPostSlugs();
  const posts = slugs
    .map((slug) => getPostBySlug(slug))
    .filter((p): p is BlogPost => p !== null);

  // Sort by date, newest first
  posts.sort((a, b) => {
    const dateA = new Date(a.date).getTime() || 0;
    const dateB = new Date(b.date).getTime() || 0;
    return dateB - dateA;
  });

  return posts;
}
