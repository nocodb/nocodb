import type { Editor } from '@tiptap/vue-3'
import DOMPurify from 'isomorphic-dompurify'
import { buildColorCssVars } from '~/components/doc/DocColorConstants'

/**
 * Download helpers for exporting document content as Markdown, HTML, or PDF.
 */
export function useDocumentExport({
  editor,
  title,
  imageUrlBuilder,
}: {
  editor: Ref<Editor | undefined>
  title: Ref<string>
  /** Build an absolute image URL from a file reference ID. Used to replace blob/stripped src in exports. */
  imageUrlBuilder?: (fileRefId: string) => string
}) {
  /** Escape HTML special characters to prevent XSS in generated HTML documents. */
  const escapeHtml = (str: string) =>
    str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

  const fileName = computed(() => (title.value || 'Untitled').replace(/[/\\?%*:|"<>]/g, '-'))

  const downloadFile = (content: string, ext: string, mimeType: string) => {
    const blob = new Blob([content], { type: mimeType })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${fileName.value}.${ext}`
    a.click()
    URL.revokeObjectURL(url)
  }

  /** Convert an HTML string to markdown using DOM traversal. */
  const htmlToMarkdown = (html: string): string => {
    const div = document.createElement('div')
    div.innerHTML = html

    const convert = (node: Node): string => {
      if (node.nodeType === Node.TEXT_NODE) return node.textContent || ''

      if (node.nodeType !== Node.ELEMENT_NODE) return ''
      const el = node as HTMLElement
      const tag = el.tagName.toLowerCase()
      const children = Array.from(el.childNodes).map(convert).join('')

      switch (tag) {
        case 'h1':
          return `# ${children}\n\n`
        case 'h2':
          return `## ${children}\n\n`
        case 'h3':
          return `### ${children}\n\n`
        case 'p':
          return `${children}\n\n`
        case 'br':
          return '\n'
        case 'strong':
        case 'b':
          return `**${children}**`
        case 'em':
        case 'i':
          return `*${children}*`
        case 'u':
          return children
        case 's':
        case 'del':
          return `~~${children}~~`
        case 'code':
          // Inline code vs code inside pre
          if (el.parentElement?.tagName.toLowerCase() === 'pre') return children
          return `\`${children}\``
        case 'pre':
          return `\`\`\`\n${children}\n\`\`\`\n\n`
        case 'blockquote':
          return `${children
            .split('\n')
            .filter(Boolean)
            .map((l) => `> ${l}`)
            .join('\n')}\n\n`
        case 'hr':
          return '---\n\n'
        case 'a':
          return `[${children}](${el.getAttribute('href') || ''})`
        case 'img':
          return `![${el.getAttribute('alt') || ''}](${el.getAttribute('src') || ''})`
        case 'ul':
          return `${Array.from(el.children)
            .map((li) => `- ${convert(li).trim()}`)
            .join('\n')}\n\n`
        case 'ol':
          return `${Array.from(el.children)
            .map((li, i) => `${i + 1}. ${convert(li).trim()}`)
            .join('\n')}\n\n`
        case 'li':
          return children
        case 'table': {
          const rows = Array.from(el.querySelectorAll('tr'))
          if (!rows.length) return ''
          const toRow = (row: Element) => Array.from(row.querySelectorAll('td, th')).map((c) => convert(c).trim())
          const headerCells = toRow(rows[0])
          const separator = headerCells.map(() => '---')
          const body = rows
            .slice(1)
            .map((r) => `| ${toRow(r).join(' | ')} |`)
            .join('\n')
          return `| ${headerCells.join(' | ')} |\n| ${separator.join(' | ')} |\n${body}\n\n`
        }
        default:
          return children
      }
    }

    return Array.from(div.childNodes)
      .map(convert)
      .join('')
      .replace(/\n{3,}/g, '\n\n')
      .trim()
  }

  /** Sanitize editor HTML to prevent XSS in exported documents. */
  const sanitizeContent = (html: string) => DOMPurify.sanitize(html)

  /** Fix image sources: DOMPurify strips blob: URLs. Rebuild from data-id using imageUrlBuilder. */
  const fixImageSources = (html: string): string => {
    if (!imageUrlBuilder) return html
    const div = document.createElement('div')
    div.innerHTML = html
    div.querySelectorAll('img[data-id]').forEach((img) => {
      const fileRefId = img.getAttribute('data-id')
      if (fileRefId) img.setAttribute('src', imageUrlBuilder(fileRefId))
    })
    return div.innerHTML
  }

  const downloadMarkdown = () => {
    if (!editor.value) return
    const md = `# ${title.value || 'Untitled'}\n\n${htmlToMarkdown(editor.value.getHTML())}`
    downloadFile(md, 'md', 'text/markdown;charset=utf-8')
  }

  /** Generate :root CSS block with doc color variables (light mode for exports) */
  const colorVarsCss = () => {
    const vars = buildColorCssVars(false)
    return `:root { ${Object.entries(vars)
      .map(([k, v]) => `${k}: ${v}`)
      .join('; ')} }`
  }

  const downloadHTML = () => {
    if (!editor.value) return
    const safeTitle = escapeHtml(title.value || 'Untitled')
    const safeContent = fixImageSources(sanitizeContent(editor.value.getHTML()))
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<style>
  ${colorVarsCss()}
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #1f2937; line-height: 1.7; }
  h1 { font-size: 2em; margin-bottom: 0.5em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td, th { border: 1px solid #d1d5db; padding: 8px 12px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; color: #6b7280; }
  code { background: #f3f4f6; border-radius: 4px; padding: 2px 6px; font-size: 0.9em; }
  pre { background: #1f2937; color: #f9fafb; border-radius: 8px; padding: 16px; overflow-x: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
  a { color: #2563eb; }
  .nc-columns { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; margin: 0.75em 0; }
  .nc-column { min-width: 0; }
  .nc-column > *:first-child { margin-top: 0; }
  .nc-column > *:last-child { margin-bottom: 0; }
</style>
</head>
<body>
<h1>${safeTitle}</h1>
${safeContent}
</body>
</html>`
    downloadFile(html, 'html', 'text/html;charset=utf-8')
  }

  const downloadPDF = () => {
    if (!editor.value) return
    const safeTitle = escapeHtml(title.value || 'Untitled')
    const safeContent = fixImageSources(sanitizeContent(editor.value.getHTML()))
    // Open a print-ready window with styled content, then trigger print-to-PDF
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.css" onerror="this.remove()">
<script src="https://cdn.jsdelivr.net/npm/katex@0.16.11/dist/katex.min.js" onload="window.__katexReady=true" onerror="window.__katexFailed=true"><\/script>
<style>
  ${colorVarsCss()}
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #1f2937; line-height: 1.7; font-size: 14px; -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Headings — clear size hierarchy */
  h1 { font-size: 2em; margin: 1em 0 0.5em; font-weight: 700; }
  h2 { font-size: 1.5em; margin: 0.8em 0 0.4em; font-weight: 700; }
  h3 { font-size: 1.2em; margin: 0.6em 0 0.3em; font-weight: 600; }

  /* Tables — match editor styling */
  table { border-collapse: separate; border-spacing: 0; width: 100%; margin: 1em 0; page-break-inside: avoid; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; }
  td, th { border-right: 1px solid #e5e7eb; border-bottom: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; vertical-align: top; line-height: 1.4; }
  td p, th p { margin: 0; }
  td:last-child, th:last-child { border-right: none; }
  tr:last-child td, tr:last-child th { border-bottom: none; }
  th { background: #f3f4f6; font-weight: 600; }
  tr:first-child th:first-child, tr:first-child td:first-child { border-top-left-radius: 7px; }
  tr:first-child th:last-child, tr:first-child td:last-child { border-top-right-radius: 7px; }
  tr:last-child td:first-child, tr:last-child th:first-child { border-bottom-left-radius: 7px; }
  tr:last-child td:last-child, tr:last-child th:last-child { border-bottom-right-radius: 7px; }

  /* Blockquote */
  blockquote { border-left: 4px solid #6b7280; padding-left: 1em; margin-left: 0; color: #4b5563; }

  /* Code */
  code { background: #f3f4f6; border-radius: 4px; padding: 2px 6px; font-size: 0.9em; }
  pre { background: #1f2937 !important; color: #f9fafb !important; border-radius: 8px; padding: 16px; overflow-x: auto; page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  pre code { background: none !important; padding: 0; color: inherit !important; }

  /* Highlights & text colors — force background in print */
  mark { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  span[data-text-color] { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

  /* Horizontal rule */
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }

  /* Images */
  img { max-width: 100%; height: auto; border-radius: 4px; margin: 0.5em 0; }

  /* Links */
  a { color: #2563eb; text-decoration: underline; }

  /* Columns */
  .nc-columns { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 24px; margin: 0.75em 0; }
  .nc-column { min-width: 0; }
  .nc-column > *:first-child { margin-top: 0; }
  .nc-column > *:last-child { margin-bottom: 0; }

  /* Callouts */
  .nc-callout { border-radius: 8px; padding: 12px 16px; margin: 0.75em 0; page-break-inside: avoid; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  .nc-callout-icon { display: none; }
  .nc-callout-content > *:first-child { margin-top: 0; }
  .nc-callout-content > *:last-child { margin-bottom: 0; }
  .nc-callout-note { background: #eff6ff; border-left: 4px solid #3b82f6; }
  .nc-callout-warning { background: #fffbeb; border-left: 4px solid #f59e0b; }
  .nc-callout-tip { background: #f0fdf4; border-left: 4px solid #22c55e; }
  .nc-callout-important { background: #fef2f2; border-left: 4px solid #ef4444; }

  /* Lists — tighten spacing, align left */
  ul, ol { margin: 0.5em 0; padding-left: 1.5em; }
  li { margin: 0; }
  li p { margin: 0.15em 0; }

  /* Task lists */
  ul[data-type="taskList"] { list-style: none; padding-left: 0; }
  ul[data-type="taskList"] li { display: flex; align-items: flex-start; gap: 8px; margin: 0.15em 0; }
  ul[data-type="taskList"] li label { display: none; }
  ul[data-type="taskList"] li::before { content: ""; display: inline-block; width: 14px; height: 14px; min-width: 14px; margin-top: 7px; border: 1.5px solid #d1d5db; border-radius: 3px; box-sizing: border-box; }
  ul[data-type="taskList"] li[data-checked="true"]::before { background: #3b82f6; border-color: #3b82f6; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 16 16' fill='white'%3E%3Cpath d='M12.207 4.793a1 1 0 010 1.414l-5 5a1 1 0 01-1.414 0l-2-2a1 1 0 011.414-1.414L6.5 9.086l4.293-4.293a1 1 0 011.414 0z'/%3E%3C/svg%3E"); background-size: 12px; background-position: center; background-repeat: no-repeat; }
  ul[data-type="taskList"] li[data-checked="true"] > div { text-decoration: line-through; color: #9ca3af; }

  /* Tabs — show all tabs stacked with title + underline (Notion style) */
  .nc-doc-tabs { margin: 0.75em 0; padding-left: 1em; }
  .nc-doc-tab { padding: 0.25em 0; }
  .nc-doc-tab::before { content: attr(data-tab-title); display: block; font-weight: 600; font-size: 1em; color: #1f2937; padding-bottom: 4px; border-bottom: 1px solid #e5e7eb; margin-bottom: 4px; }

  /* Math — KaTeX renders these; hide raw element */
  .nc-inline-math { display: none; }

  /* Embeds — show as link */
  div[data-type="embed"]::before { content: "🔗 " attr(data-url); color: #2563eb; text-decoration: underline; display: block; margin: 0.5em 0; }

  /* File attachments — show filename */
  div[data-type="file-attachment"]::before { content: "📎 " attr(data-file-name); display: block; margin: 0.5em 0; padding: 8px 12px; background: #f9fafb; border: 1px solid #e5e7eb; border-radius: 6px; font-size: 0.9em; }

  /* Mentions — show as inline text */
  span[data-type="mention"] { background: #eff6ff; padding: 1px 4px; border-radius: 4px; }

  /* Print */
  @media print {
    body { padding: 0; }
    pre, .nc-callout, table { page-break-inside: avoid; }
    a { color: #2563eb !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  }
</style>
</head>
<body>
<h1>${safeTitle}</h1>
${safeContent}
<script>
// Render math with KaTeX, wait for images, then print
function renderMath() {
  if (typeof katex === 'undefined') return;
  document.querySelectorAll('.nc-inline-math[data-latex]').forEach(function(el) {
    var latex = el.getAttribute('data-latex');
    if (!latex) return;
    var rendered = document.createElement('span');
    try { katex.renderToString(latex, { throwOnError: false, output: 'html' }); }
    catch(e) {}
    try {
      rendered.innerHTML = katex.renderToString(latex, { throwOnError: false });
      el.parentNode.insertBefore(rendered, el);
    } catch(e) {
      el.style.display = 'inline';
    }
  });
}
// Wait for images, render math, then print after two animation frames (let layout settle)
window.onload = function() {
  if (!window.__katexFailed && window.__katexReady) renderMath();
  Promise.all(Array.from(document.images).filter(function(img) { return !img.complete; }).map(function(img) {
    return new Promise(function(resolve) { img.onload = img.onerror = resolve; });
  })).then(function() {
    requestAnimationFrame(function() { requestAnimationFrame(function() { window.print(); }); });
  });
};
<\/script>
</body>
</html>`
    const printWindow = window.open('', '_blank')
    if (printWindow) {
      printWindow.document.write(html)
      printWindow.document.close()
    }
  }

  return {
    downloadMarkdown,
    downloadHTML,
    downloadPDF,
  }
}
