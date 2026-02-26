import type { Editor } from '@tiptap/vue-3'

/**
 * Download helpers for exporting document content as Markdown, HTML, or PDF.
 */
export function useDocumentExport({ editor, title }: { editor: Ref<Editor | undefined>; title: Ref<string> }) {
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

  const downloadMarkdown = () => {
    if (!editor.value) return
    const md = `# ${title.value || 'Untitled'}\n\n${htmlToMarkdown(editor.value.getHTML())}`
    downloadFile(md, 'md', 'text/markdown;charset=utf-8')
  }

  const downloadHTML = () => {
    if (!editor.value) return
    const safeTitle = escapeHtml(title.value || 'Untitled')
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<style>
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
</style>
</head>
<body>
<h1>${safeTitle}</h1>
${editor.value.getHTML()}
</body>
</html>`
    downloadFile(html, 'html', 'text/html;charset=utf-8')
  }

  const downloadPDF = () => {
    if (!editor.value) return
    const safeTitle = escapeHtml(title.value || 'Untitled')
    // Open a print-ready window with styled content, then trigger print-to-PDF
    const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${safeTitle}</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 700px; margin: 0 auto; padding: 40px 20px; color: #1f2937; line-height: 1.7; font-size: 14px; }
  h1 { font-size: 1.8em; margin-bottom: 0.5em; }
  table { border-collapse: collapse; width: 100%; margin: 1em 0; }
  td, th { border: 1px solid #d1d5db; padding: 6px 10px; text-align: left; }
  th { background: #f3f4f6; font-weight: 600; }
  blockquote { border-left: 3px solid #d1d5db; padding-left: 1em; color: #6b7280; }
  code { background: #f3f4f6; border-radius: 4px; padding: 2px 6px; font-size: 0.9em; }
  pre { background: #1f2937; color: #f9fafb; border-radius: 8px; padding: 16px; overflow-x: auto; }
  pre code { background: none; padding: 0; color: inherit; }
  hr { border: none; border-top: 1px solid #e5e7eb; margin: 2em 0; }
  a { color: #2563eb; text-decoration: underline; }
  @media print { body { padding: 0; } }
</style>
</head>
<body>
<h1>${safeTitle}</h1>
${editor.value.getHTML()}
<script>window.onload = function() { window.print(); }<\/script>
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
