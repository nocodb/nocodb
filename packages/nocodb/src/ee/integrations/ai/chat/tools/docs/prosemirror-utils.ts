import { marked } from 'marked';

// ---------------------------------------------------------------------------
// ProseMirror JSON ↔ Markdown conversion utilities
//
// The frontend's tiptap-markdown requires a DOM/Editor instance, and
// prosemirror-markdown needs a full ProseMirror schema — neither can run
// on the backend. Instead we use:
//
//   Read (PM→MD):  Custom recursive JSON walker → markdown string
//   Write (MD→PM): Pre-process fenced directives, then marked.lexer() →
//                   token AST → ProseMirror JSON
//
// NocoDocs-specific nodes use fenced directive syntax for roundtrip support:
//
//   ::: columns {ratio=33}
//   ::: column
//   Left content
//   :::
//   ::: column
//   Right content
//   :::
//   :::
//
//   ::: callout warning
//   Be careful!
//   :::
//
// Other custom nodes (embed, fileAttachment, inlineMath) gracefully degrade.
// ---------------------------------------------------------------------------

// ── PM → Markdown ──────────────────────────────────────────────────────────

/**
 * Convert a ProseMirror JSON document to a Markdown string.
 */
export function prosemirrorToMarkdown(doc: Record<string, any>): string {
  if (!doc || !doc.content) return '';
  return renderNodes(doc.content, '').trimEnd();
}

function renderNodes(nodes: Record<string, any>[], indent: string): string {
  let out = '';
  for (const node of nodes) {
    out += renderNode(node, indent);
  }
  return out;
}

function renderNode(node: Record<string, any>, indent: string): string {
  switch (node.type) {
    case 'heading': {
      const hashes = '#'.repeat(node.attrs?.level || 1);
      return `${hashes} ${renderInline(node.content)}\n\n`;
    }

    case 'paragraph':
      return `${indent}${renderInline(node.content)}\n\n`;

    case 'bulletList':
      return renderList(node.content, indent, false);

    case 'orderedList':
      return renderList(node.content, indent, true);

    case 'taskList':
      return renderTaskList(node.content, indent);

    case 'listItem':
      return renderNodes(node.content || [], indent);

    case 'blockquote': {
      const inner = renderNodes(node.content || [], '');
      return (
        inner
          .split('\n')
          .map((line) => `> ${line}`)
          .join('\n') + '\n'
      );
    }

    case 'codeBlock': {
      const lang = node.attrs?.language || '';
      const code = extractText(node.content);
      return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
    }

    case 'horizontalRule':
      return '---\n\n';

    case 'table':
      return renderTable(node.content) + '\n';

    case 'image': {
      const alt = node.attrs?.alt || '';
      const src = node.attrs?.src || '';
      return `![${alt}](${src})\n\n`;
    }

    // NocoDocs-specific nodes — fenced directive syntax
    case 'callout': {
      const calloutType = node.attrs?.type || 'note';
      const inner = renderNodes(node.content || [], '').trimEnd();
      return `::: callout ${calloutType}\n${inner}\n:::\n\n`;
    }

    case 'columns': {
      const ratio = node.attrs?.ratio ?? 50;
      const columns = node.content || [];
      let out = `::: columns {ratio=${ratio}}\n`;
      for (const col of columns) {
        out += `::: column\n`;
        out += renderNodes(col.content || [], '').trimEnd();
        out += `\n:::\n`;
      }
      out += `:::\n\n`;
      return out;
    }

    case 'column':
      // Handled inside 'columns' — standalone fallback
      return renderNodes(node.content || [], indent);

    case 'inlineMath':
      return `$${node.attrs?.latex || ''}$`;

    case 'embed': {
      const src = node.attrs?.src || '';
      return `[Embed](${src})\n\n`;
    }

    case 'fileAttachment': {
      const fileName = node.attrs?.fileName || 'file';
      const src = node.attrs?.src || '';
      return `[${fileName}](${src})\n\n`;
    }

    case 'hardBreak':
      return '\n';

    default:
      // Unknown node — try to render children
      if (node.content) {
        return renderNodes(node.content, indent);
      }
      return '';
  }
}

function renderList(
  items: Record<string, any>[],
  indent: string,
  ordered: boolean,
): string {
  let out = '';
  for (let i = 0; i < (items || []).length; i++) {
    const item = items[i];
    const prefix = ordered ? `${i + 1}. ` : '- ';
    const children = item.content || [];

    for (let j = 0; j < children.length; j++) {
      const child = children[j];
      if (j === 0) {
        // First child gets the list prefix
        if (child.type === 'paragraph') {
          out += `${indent}${prefix}${renderInline(child.content)}\n`;
        } else {
          out += `${indent}${prefix}${renderNode(
            child,
            indent + '  ',
          ).trimEnd()}\n`;
        }
      } else if (
        child.type === 'bulletList' ||
        child.type === 'orderedList' ||
        child.type === 'taskList'
      ) {
        // Nested list
        out += renderNode(child, indent + '  ');
      } else {
        out += `${indent}  ${renderNode(child, indent + '  ').trimEnd()}\n`;
      }
    }
  }
  return out + '\n';
}

function renderTaskList(items: Record<string, any>[], indent: string): string {
  let out = '';
  for (const item of items || []) {
    const checked = item.attrs?.checked ? 'x' : ' ';
    const children = item.content || [];
    const firstPara = children[0];
    if (firstPara?.type === 'paragraph') {
      out += `${indent}- [${checked}] ${renderInline(firstPara.content)}\n`;
    } else {
      out += `${indent}- [${checked}] ${renderNodes(
        children,
        indent + '  ',
      ).trimEnd()}\n`;
    }
    // Render remaining children (nested lists, etc.)
    for (let j = 1; j < children.length; j++) {
      out += renderNode(children[j], indent + '  ');
    }
  }
  return out + '\n';
}

function renderTable(rows: Record<string, any>[]): string {
  if (!rows?.length) return '';

  const allRows: string[][] = [];

  for (const row of rows) {
    const cells: string[] = [];
    for (const cell of row.content || []) {
      const text = renderNodes(cell.content || [], '').trim();
      cells.push(text);
    }
    allRows.push(cells);
  }

  if (!allRows.length) return '';

  const lines: string[] = [];
  lines.push(`| ${allRows[0].join(' | ')} |`);
  // Markdown tables always need a separator row after the first row
  lines.push(`| ${allRows[0].map(() => '---').join(' | ')} |`);
  for (let i = 1; i < allRows.length; i++) {
    lines.push(`| ${allRows[i].join(' | ')} |`);
  }

  return lines.join('\n') + '\n';
}

/** Render inline content (text nodes with marks) to markdown. */
function renderInline(content?: Record<string, any>[]): string {
  if (!content) return '';
  let out = '';
  for (const node of content) {
    if (node.type === 'text') {
      out += applyMarks(node.text || '', node.marks);
    } else if (node.type === 'hardBreak') {
      out += '\n';
    } else if (node.type === 'inlineMath') {
      out += `$${node.attrs?.latex || ''}$`;
    } else if (node.type === 'image') {
      out += `![${node.attrs?.alt || ''}](${node.attrs?.src || ''})`;
    } else if (node.content) {
      out += renderInline(node.content);
    }
  }
  return out;
}

function applyMarks(text: string, marks?: Record<string, any>[]): string {
  if (!marks?.length) return text;
  let result = text;
  for (const mark of marks) {
    switch (mark.type) {
      case 'bold':
      case 'strong':
        result = `**${result}**`;
        break;
      case 'italic':
      case 'em':
        result = `*${result}*`;
        break;
      case 'strike':
        result = `~~${result}~~`;
        break;
      case 'code':
        result = `\`${result}\``;
        break;
      case 'link':
        result = `[${result}](${mark.attrs?.href || ''})`;
        break;
      case 'underline':
        result = `<u>${result}</u>`;
        break;
      // highlight, commentMark — no markdown equivalent, strip
    }
  }
  return result;
}

function extractText(content?: Record<string, any>[]): string {
  if (!content) return '';
  return content.map((n) => n.text || '').join('');
}

// ── Markdown → PM ──────────────────────────────────────────────────────────

// Directive placeholder prefix — must not collide with real content.
// We replace ::: blocks with HTML comments that survive marked.lexer(),
// then resolve them in a post-pass.
const DIRECTIVE_PLACEHOLDER = '<!--__ncdirective_';

interface DirectiveBlock {
  type: 'columns' | 'callout';
  attrs: Record<string, any>;
  /** Raw markdown body (for callout) or column bodies (for columns) */
  body: string | string[];
}

/**
 * Find a ::: directive match that is NOT inside a fenced code block.
 * Returns a RegExpMatchArray-like object with `index` or null.
 */
function findDirectiveOutsideCodeFence(text: string): RegExpExecArray | null {
  // Build a set of ranges covered by fenced code blocks
  const codeFenceRanges: Array<[number, number]> = [];
  const fenceRe = /^(`{3,}|~{3,})[^\n]*\n[\s\S]*?\n\1\s*$/gm;
  let fm: RegExpExecArray | null;
  while ((fm = fenceRe.exec(text)) !== null) {
    codeFenceRanges.push([fm.index, fm.index + fm[0].length]);
  }

  // Search for directive matches, skipping those inside code fences
  const directiveRe = /^(:::)\s+(columns|callout)\b([^\n]*)\n/gm;
  let dm: RegExpExecArray | null;
  while ((dm = directiveRe.exec(text)) !== null) {
    const pos = dm.index;
    const insideFence = codeFenceRanges.some(
      ([start, end]) => pos >= start && pos < end,
    );
    if (!insideFence) return dm;
  }
  return null;
}

/**
 * Extract ::: fenced directives from markdown, replacing them with
 * placeholder HTML comments. Returns the cleaned markdown and a map
 * of placeholder ID → directive definition.
 *
 * Supports:
 *   ::: columns {ratio=33}
 *   ::: column
 *   ...
 *   :::
 *   ::: column
 *   ...
 *   :::
 *   :::
 *
 *   ::: callout warning
 *   ...
 *   :::
 */
function extractDirectives(markdown: string): {
  cleaned: string;
  directives: Map<string, DirectiveBlock>;
} {
  const directives = new Map<string, DirectiveBlock>();
  let counter = 0;

  // Process from the outermost ::: blocks inward
  let cleaned = markdown;
  let safety = 100; // prevent infinite loops

  while (safety-- > 0) {
    // Find the first outermost ::: directive (columns or callout)
    // but skip matches that fall inside fenced code blocks (``` ... ```)
    const match = findDirectiveOutsideCodeFence(cleaned);
    if (!match) break;

    const startIdx = match.index!;
    const directiveType = match[2] as 'columns' | 'callout';
    const attrStr = match[3].trim();

    // Find the matching closing ::: by tracking nesting depth
    const afterOpen = startIdx + match[0].length;
    let depth = 1;
    let pos = afterOpen;
    const lines = cleaned.slice(afterOpen).split('\n');
    let lineOffset = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (
        trimmed.startsWith('::: ') ||
        trimmed === ':::columns' ||
        trimmed === ':::column'
      ) {
        // Opening a nested directive (e.g. ::: column inside ::: columns)
        if (/^:::\s+(columns|column|callout)\b/.test(trimmed)) {
          depth++;
        }
      }
      if (trimmed === ':::') {
        depth--;
        if (depth === 0) {
          // Found the matching close
          pos = afterOpen + lineOffset + line.length;
          break;
        }
      }
      lineOffset += line.length + 1; // +1 for \n
    }

    if (depth !== 0) {
      // Malformed — no matching close, skip this directive
      break;
    }

    const innerRaw = cleaned.slice(afterOpen, afterOpen + lineOffset).trimEnd();
    const id = `d${counter++}`;

    if (directiveType === 'callout') {
      const calloutType = attrStr || 'note';
      directives.set(id, {
        type: 'callout',
        attrs: { type: calloutType },
        body: innerRaw,
      });
    } else {
      // columns — parse ratio and extract column bodies
      let ratio = 50;
      const ratioMatch = attrStr.match(/\{?\s*ratio\s*=\s*(\d+)\s*\}?/);
      if (ratioMatch) {
        ratio = Math.max(15, Math.min(85, parseInt(ratioMatch[1], 10)));
      }

      // Split inner content by ::: column markers
      const columnBodies = splitColumnBodies(innerRaw);

      directives.set(id, {
        type: 'columns',
        attrs: { ratio },
        body: columnBodies,
      });
    }

    // Replace the entire directive block with a placeholder
    const placeholder = `${DIRECTIVE_PLACEHOLDER}${id}-->`;
    cleaned =
      cleaned.slice(0, startIdx) + placeholder + '\n' + cleaned.slice(pos + 1); // +1 to skip the \n after :::
  }

  return { cleaned, directives };
}

/**
 * Split the inner content of a ::: columns block into individual column bodies.
 * Each ::: column ... ::: section becomes one entry.
 */
function splitColumnBodies(inner: string): string[] {
  const bodies: string[] = [];
  const lines = inner.split('\n');
  let current: string[] | null = null;
  let depth = 0;

  for (const line of lines) {
    const trimmed = line.trim();

    if (/^:::\s+column\b/.test(trimmed) && depth === 0) {
      // Start a new column
      if (current !== null) {
        bodies.push(current.join('\n').trim());
      }
      current = [];
      depth = 1;
      continue;
    }

    if (current !== null) {
      if (/^:::\s+(columns|column|callout)\b/.test(trimmed)) {
        depth++;
        current.push(line);
      } else if (trimmed === ':::') {
        depth--;
        if (depth === 0) {
          // End of this column
          bodies.push(current.join('\n').trim());
          current = null;
        } else {
          current.push(line);
        }
      } else {
        current.push(line);
      }
    }
    // Lines outside ::: column markers are ignored (shouldn't happen in valid input)
  }

  // Handle unclosed column
  if (current !== null) {
    bodies.push(current.join('\n').trim());
  }

  // Ensure exactly 2 columns (NocoDocs enforces this)
  while (bodies.length < 2) {
    bodies.push('');
  }

  return bodies.slice(0, 2);
}

/**
 * Convert a Markdown string to a ProseMirror JSON document.
 *
 * Supports standard Markdown plus NocoDocs fenced directives:
 *   ::: columns {ratio=50}   — 2-column layout (ratio = left column %)
 *   ::: callout note|warning|tip|important — callout box
 */
export function markdownToProseMirror(markdown: string): Record<string, any> {
  if (!markdown?.trim()) {
    return { type: 'doc', content: [{ type: 'paragraph' }] };
  }

  // 1. Extract fenced directives into placeholders
  const { cleaned, directives } = extractDirectives(markdown);

  // 2. Tokenize the cleaned markdown (directives replaced with HTML comments)
  const tokens = marked.lexer(cleaned);
  const content = tokensToNodes(tokens);

  // 3. Resolve directive placeholders into PM nodes
  const resolved = resolveDirectivePlaceholders(content, directives);

  return {
    type: 'doc',
    content: resolved.length ? resolved : [{ type: 'paragraph' }],
  };
}

/**
 * Walk the PM node tree and replace directive placeholder paragraphs
 * with actual columns/callout nodes.
 */
function resolveDirectivePlaceholders(
  nodes: Record<string, any>[],
  directives: Map<string, DirectiveBlock>,
): Record<string, any>[] {
  const result: Record<string, any>[] = [];

  for (const node of nodes) {
    // Check if this node is a placeholder paragraph (or html node)
    const placeholderId = extractPlaceholderId(node);
    if (placeholderId && directives.has(placeholderId)) {
      const directive = directives.get(placeholderId)!;
      result.push(directiveToNode(directive, directives));
      continue;
    }

    // Recurse into children
    if (node.content) {
      node.content = resolveDirectivePlaceholders(node.content, directives);
    }
    result.push(node);
  }

  return result;
}

/** Check if a node contains a directive placeholder and return its ID. */
function extractPlaceholderId(node: Record<string, any>): string | null {
  // Placeholder might appear as an HTML token or as text in a paragraph
  const text = getNodeTextContent(node);
  if (!text) return null;

  const match = text.match(/<!--__ncdirective_(d\d+)-->/);
  return match ? match[1] : null;
}

function getNodeTextContent(node: Record<string, any>): string {
  if (node.type === 'text') return node.text || '';
  if (node.type === 'html') return node.raw || node.text || '';
  if (!node.content) return '';
  return node.content.map((c: any) => getNodeTextContent(c)).join('');
}

/** Convert a DirectiveBlock into a ProseMirror node. */
function directiveToNode(
  directive: DirectiveBlock,
  _allDirectives: Map<string, DirectiveBlock>,
): Record<string, any> {
  if (directive.type === 'callout') {
    const body = directive.body as string;
    const innerDoc = body
      ? markdownToProseMirror(body)
      : { type: 'doc', content: [{ type: 'paragraph' }] };

    return {
      type: 'callout',
      attrs: directive.attrs,
      content: innerDoc.content,
    };
  }

  // columns
  const columnBodies = directive.body as string[];
  return {
    type: 'columns',
    attrs: directive.attrs,
    content: columnBodies.map((body) => {
      const innerDoc = body
        ? markdownToProseMirror(body)
        : { type: 'doc', content: [{ type: 'paragraph' }] };

      return {
        type: 'column',
        content: innerDoc.content,
      };
    }),
  };
}

function tokensToNodes(tokens: marked.Token[]): Record<string, any>[] {
  const nodes: Record<string, any>[] = [];

  for (const token of tokens) {
    const node = tokenToNode(token);
    if (node) {
      if (Array.isArray(node)) {
        nodes.push(...node);
      } else {
        nodes.push(node);
      }
    }
  }

  return nodes;
}

function tokenToNode(
  token: marked.Token,
): Record<string, any> | Record<string, any>[] | null {
  switch (token.type) {
    case 'heading':
      return {
        type: 'heading',
        attrs: { level: token.depth },
        content: inlineTokensToNodes(token.tokens || []),
      };

    case 'paragraph':
      return {
        type: 'paragraph',
        content: inlineTokensToNodes(token.tokens || []),
      };

    case 'list': {
      const listType = token.ordered ? 'orderedList' : 'bulletList';
      const isTask = token.items?.some((item: any) => item.task);

      if (isTask) {
        return {
          type: 'taskList',
          content: token.items.map((item: any) => ({
            type: 'taskItem',
            attrs: { checked: !!item.checked },
            content: listItemContent(item),
          })),
        };
      }

      return {
        type: listType,
        content: token.items.map((item: any) => ({
          type: 'listItem',
          content: listItemContent(item),
        })),
      };
    }

    case 'blockquote':
      return {
        type: 'blockquote',
        content: tokensToNodes(token.tokens || []),
      };

    case 'code':
      return {
        type: 'codeBlock',
        attrs: { language: token.lang || null },
        content: token.text ? [{ type: 'text', text: token.text }] : [],
      };

    case 'hr':
      return { type: 'horizontalRule' };

    case 'table': {
      const rows: Record<string, any>[] = [];

      // Header row
      if (token.header?.length) {
        rows.push({
          type: 'tableRow',
          content: token.header.map((cell: any) => ({
            type: 'tableHeader',
            attrs: { colspan: 1, rowspan: 1 },
            content: [
              {
                type: 'paragraph',
                content: inlineTokensToNodes(cell.tokens || []),
              },
            ],
          })),
        });
      }

      // Body rows
      for (const row of token.rows || []) {
        rows.push({
          type: 'tableRow',
          content: row.map((cell: any) => ({
            type: 'tableCell',
            attrs: { colspan: 1, rowspan: 1 },
            content: [
              {
                type: 'paragraph',
                content: inlineTokensToNodes(cell.tokens || []),
              },
            ],
          })),
        });
      }

      return { type: 'table', content: rows };
    }

    case 'image':
      return {
        type: 'image',
        attrs: {
          src: (token as any).href || '',
          alt: (token as any).text || '',
          title: (token as any).title || null,
        },
      };

    case 'space':
      return null;

    case 'html':
      // Best-effort: treat raw HTML as a paragraph with text
      return {
        type: 'paragraph',
        content: [{ type: 'text', text: token.raw.trim() }],
      };

    default:
      // Unknown block tokens — try to render as paragraph with raw text
      if ((token as any).raw) {
        return {
          type: 'paragraph',
          content: [{ type: 'text', text: (token as any).raw.trim() }],
        };
      }
      return null;
  }
}

function listItemContent(item: any): Record<string, any>[] {
  const nodes: Record<string, any>[] = [];

  // List items can have both inline text and nested tokens
  if (item.tokens) {
    for (const t of item.tokens) {
      if (t.type === 'text' && t.tokens) {
        nodes.push({
          type: 'paragraph',
          content: inlineTokensToNodes(t.tokens),
        });
      } else if (t.type === 'list') {
        const nested = tokenToNode(t);
        if (nested) {
          if (Array.isArray(nested)) nodes.push(...nested);
          else nodes.push(nested);
        }
      } else {
        const n = tokenToNode(t);
        if (n) {
          if (Array.isArray(n)) nodes.push(...n);
          else nodes.push(n);
        }
      }
    }
  }

  // Ensure at least one paragraph
  if (!nodes.length) {
    nodes.push({ type: 'paragraph' });
  }

  return nodes;
}

function inlineTokensToNodes(tokens: marked.Token[]): Record<string, any>[] {
  const nodes: Record<string, any>[] = [];

  for (const token of tokens) {
    switch (token.type) {
      case 'text': {
        const text = (token as any).text || (token as any).raw || '';
        if (text) {
          // Split inline math $...$ into inlineMath nodes
          const mathParts = text.split(/\$([^$]+)\$/);
          for (let mi = 0; mi < mathParts.length; mi++) {
            if (mi % 2 === 0) {
              // Plain text segment
              if (mathParts[mi]) {
                nodes.push({ type: 'text', text: mathParts[mi] });
              }
            } else {
              // Math segment (odd indices from split capture group)
              nodes.push({
                type: 'inlineMath',
                attrs: { latex: mathParts[mi] },
              });
            }
          }
        }
        break;
      }

      case 'strong': {
        const inner = inlineTokensToNodes((token as any).tokens || []);
        for (const n of inner) {
          addMark(n, { type: 'bold' });
          nodes.push(n);
        }
        break;
      }

      case 'em': {
        const inner = inlineTokensToNodes((token as any).tokens || []);
        for (const n of inner) {
          addMark(n, { type: 'italic' });
          nodes.push(n);
        }
        break;
      }

      case 'del': {
        const inner = inlineTokensToNodes((token as any).tokens || []);
        for (const n of inner) {
          addMark(n, { type: 'strike' });
          nodes.push(n);
        }
        break;
      }

      case 'codespan':
        nodes.push({
          type: 'text',
          text: (token as any).text || '',
          marks: [{ type: 'code' }],
        });
        break;

      case 'link': {
        const inner = inlineTokensToNodes((token as any).tokens || []);
        for (const n of inner) {
          addMark(n, {
            type: 'link',
            attrs: { href: (token as any).href || '' },
          });
          nodes.push(n);
        }
        break;
      }

      case 'image':
        nodes.push({
          type: 'image',
          attrs: {
            src: (token as any).href || '',
            alt: (token as any).text || '',
            title: (token as any).title || null,
          },
        });
        break;

      case 'br':
        nodes.push({ type: 'hardBreak' });
        break;

      case 'escape':
        nodes.push({ type: 'text', text: (token as any).text || '' });
        break;

      case 'html': {
        // Handle <u>...</u> for underline roundtrip
        const htmlRaw = (token as any).raw || (token as any).text || '';
        const underlineMatch = htmlRaw.match(/^<u>([\s\S]*?)<\/u>$/);
        if (underlineMatch) {
          nodes.push({
            type: 'text',
            text: underlineMatch[1],
            marks: [{ type: 'underline' }],
          });
        } else if (htmlRaw.trim()) {
          nodes.push({ type: 'text', text: htmlRaw });
        }
        break;
      }

      default: {
        // Fallback: use raw text
        const raw = (token as any).text || (token as any).raw || '';
        if (raw) {
          nodes.push({ type: 'text', text: raw });
        }
        break;
      }
    }
  }

  return nodes;
}

function addMark(node: Record<string, any>, mark: Record<string, any>) {
  if (!node.marks) node.marks = [];
  node.marks.push(mark);
}
