/**
 * Minimal Markdown + XML Tag Parser for Chat Messages
 *
 * Outputs Vue VNodes (not HTML strings).
 * Supports: h1–h4, bold, italic, strikethrough, ordered list, unordered list,
 * blockquote, horizontal rule, inline code, code blocks, and custom XML tags.
 *
 * XML tags come in two forms:
 * - Block-level: <nc-records ... /> or <nc-data>...</nc-data> on their own line
 * - Inline: <nc-record-source recordIds='[...]' /> embedded within text
 *
 * The consumer maps tag names to Vue components via the xmlComponents option.
 */

import { type Component, type VNode, h } from 'vue'

// ─── Token Types ────────────────────────────────────────────────────────────

interface HeadingToken {
  type: 'heading'
  depth: 1 | 2 | 3 | 4
  children: InlineToken[]
}

interface ParagraphToken {
  type: 'paragraph'
  children: InlineToken[]
}

interface OrderedListToken {
  type: 'ordered_list'
  start: number
  items: ListItemToken[]
}

interface UnorderedListToken {
  type: 'unordered_list'
  items: ListItemToken[]
}

interface ListItemToken {
  type: 'list_item'
  children: BlockToken[]
}

interface BlockquoteToken {
  type: 'blockquote'
  children: BlockToken[]
}

interface HorizontalRuleToken {
  type: 'hr'
}

interface CodeBlockToken {
  type: 'code_block'
  lang: string
  code: string
}

interface XmlTagToken {
  type: 'xml_tag'
  tagName: string
  attrs: Record<string, string>
  children: string
}

interface TableToken {
  type: 'table'
  headers: InlineToken[][]
  alignments: Array<'left' | 'center' | 'right'>
  rows: InlineToken[][][]
}

type BlockToken =
  | HeadingToken
  | ParagraphToken
  | OrderedListToken
  | UnorderedListToken
  | BlockquoteToken
  | HorizontalRuleToken
  | CodeBlockToken
  | XmlTagToken
  | TableToken

// Inline tokens

interface TextToken {
  type: 'text'
  text: string
}

interface BoldToken {
  type: 'bold'
  children: InlineToken[]
}

interface ItalicToken {
  type: 'italic'
  children: InlineToken[]
}

interface StrikeToken {
  type: 'strike'
  children: InlineToken[]
}

interface InlineCodeToken {
  type: 'inline_code'
  code: string
}

interface LineBreakToken {
  type: 'br'
}

interface InlineXmlToken {
  type: 'inline_xml'
  tagName: string
  attrs: Record<string, string>
}

type InlineToken = TextToken | BoldToken | ItalicToken | StrikeToken | InlineCodeToken | LineBreakToken | InlineXmlToken

// ─── Shared Helpers ─────────────────────────────────────────────────────────

const RE_HEADING = /^(#{1,4})\s+(.+)$/
const RE_HR = /^(?:---|\*\*\*|___)(?:\s*)$/
const RE_ORDERED_LIST_ITEM = /^(\s*)\d+[.)]\s+(.*)$/
const RE_UNORDERED_LIST_ITEM = /^(\s*)[-*+]\s+(.*)$/
const RE_BLOCKQUOTE = /^>\s?(.*)$/
const RE_CODE_FENCE = /^```(\w*)$/
const RE_XML_SELF_CLOSING = /^<(nc-[\w-]+)((?:\s+[\w-]+(?:=(?:'[^']*'|"[^"]*"))?)*)\s*\/>$/
const RE_XML_OPEN = /^<(nc-[\w-]+)((?:\s+[\w-]+(?:=(?:'[^']*'|"[^"]*"))?)*)\s*>$/
const RE_XML_CLOSE = /^<\/(nc-[\w-]+)\s*>$/
const RE_TABLE_ROW = /^\|.+\|/
const RE_TABLE_DELIMITER_ROW = /^\|[\s|:\-]+\|$/

// Inline XML: matches <nc-xxx ... /> anywhere in text
const RE_INLINE_XML = /<(nc-[\w-]+)((?:\s+[\w-]+(?:=(?:'[^']*'|"[^"]*"))?)*)\s*\/>/g

function parseXmlAttrs(raw: string): Record<string, string> {
  const attrs: Record<string, string> = {}
  const re = /([\w-]+)=(?:'([^']*)'|"([^"]*)")/g
  let m = re.exec(raw)
  while (m !== null) {
    attrs[m[1]] = m[2] ?? m[3]
    m = re.exec(raw)
  }
  return attrs
}

function getIndentLevel(indent: string): number {
  return indent.replace(/\t/g, '    ').length
}

function splitTableCells(line: string): string[] {
  // Split on | and remove the empty first/last elements from surrounding pipes
  return line
    .split('|')
    .slice(1, -1)
    .map((c) => c.trim())
}

function parseTableAlignment(cell: string): 'left' | 'center' | 'right' {
  const s = cell.trim()
  if (s.startsWith(':') && s.endsWith(':')) return 'center'
  if (s.endsWith(':')) return 'right'
  return 'left'
}

function isBlockStart(line: string): boolean {
  const trimmed = line.trim()
  return (
    RE_HEADING.test(line) ||
    RE_HR.test(trimmed) ||
    RE_CODE_FENCE.test(line) ||
    RE_BLOCKQUOTE.test(line) ||
    RE_ORDERED_LIST_ITEM.test(line) ||
    RE_UNORDERED_LIST_ITEM.test(line) ||
    RE_XML_SELF_CLOSING.test(trimmed) ||
    RE_XML_OPEN.test(trimmed) ||
    RE_TABLE_ROW.test(trimmed)
  )
}

// ─── Block Tokenizer ────────────────────────────────────────────────────────

export function tokenizeBlocks(src: string): BlockToken[] {
  const lines = src.split('\n')
  const tokens: BlockToken[] = []
  let i = 0

  while (i < lines.length) {
    const line = lines[i]

    // Empty line — skip
    if (line.trim() === '') {
      i++
      continue
    }

    // Code fence
    const fenceMatch = line.match(RE_CODE_FENCE)
    if (fenceMatch) {
      const lang = fenceMatch[1] || ''
      const codeLines: string[] = []
      i++
      while (i < lines.length && !RE_CODE_FENCE.test(lines[i])) {
        codeLines.push(lines[i])
        i++
      }
      if (i < lines.length) i++ // skip closing fence
      tokens.push({ type: 'code_block', lang, code: codeLines.join('\n') })
      continue
    }

    // Block-level XML self-closing: <nc-records ... /> (only when it's the whole line)
    const xmlSelfMatch = line.trim().match(RE_XML_SELF_CLOSING)
    if (xmlSelfMatch) {
      tokens.push({
        type: 'xml_tag',
        tagName: xmlSelfMatch[1],
        attrs: parseXmlAttrs(xmlSelfMatch[2] || ''),
        children: '',
      })
      i++
      continue
    }

    // Block-level XML open/close: <nc-data ...> ... </nc-data>
    const xmlOpenMatch = line.trim().match(RE_XML_OPEN)
    if (xmlOpenMatch) {
      const tagName = xmlOpenMatch[1]
      const attrs = parseXmlAttrs(xmlOpenMatch[2] || '')
      const innerLines: string[] = []
      i++
      while (i < lines.length) {
        const closeMatch = lines[i].trim().match(RE_XML_CLOSE)
        if (closeMatch && closeMatch[1] === tagName) {
          i++
          break
        }
        innerLines.push(lines[i])
        i++
      }
      tokens.push({ type: 'xml_tag', tagName, attrs, children: innerLines.join('\n') })
      continue
    }

    // Horizontal rule
    if (RE_HR.test(line.trim())) {
      tokens.push({ type: 'hr' })
      i++
      continue
    }

    // Heading
    const headingMatch = line.match(RE_HEADING)
    if (headingMatch) {
      const depth = Math.min(headingMatch[1].length, 4) as 1 | 2 | 3 | 4
      tokens.push({ type: 'heading', depth, children: tokenizeInline(headingMatch[2]) })
      i++
      continue
    }

    // Blockquote — collect consecutive > lines
    if (RE_BLOCKQUOTE.test(line)) {
      const quoteLines: string[] = []
      while (i < lines.length && RE_BLOCKQUOTE.test(lines[i])) {
        quoteLines.push(lines[i].replace(RE_BLOCKQUOTE, '$1'))
        i++
      }
      tokens.push({ type: 'blockquote', children: tokenizeBlocks(quoteLines.join('\n')) })
      continue
    }

    // Ordered list
    if (RE_ORDERED_LIST_ITEM.test(line)) {
      const { list, nextIndex } = parseOrderedList(lines, i)
      tokens.push(list)
      i = nextIndex
      continue
    }

    // Unordered list
    if (RE_UNORDERED_LIST_ITEM.test(line)) {
      const { list, nextIndex } = parseUnorderedList(lines, i)
      tokens.push(list)
      i = nextIndex
      continue
    }

    // Table — header row followed by delimiter row
    if (RE_TABLE_ROW.test(line.trim()) && i + 1 < lines.length && RE_TABLE_DELIMITER_ROW.test(lines[i + 1].trim())) {
      const headerCells = splitTableCells(line)
      const delimCells = splitTableCells(lines[i + 1])
      const alignments = delimCells.map(parseTableAlignment)
      const rows: InlineToken[][][] = []
      i += 2 // skip header + delimiter
      while (i < lines.length && RE_TABLE_ROW.test(lines[i].trim())) {
        rows.push(splitTableCells(lines[i]).map((cell) => tokenizeInline(cell)))
        i++
      }
      tokens.push({
        type: 'table',
        headers: headerCells.map((cell) => tokenizeInline(cell)),
        alignments,
        rows,
      })
      continue
    }

    // Paragraph — collect lines until next block element or empty line
    const paraLines: string[] = []
    while (i < lines.length && lines[i].trim() !== '' && !isBlockStart(lines[i])) {
      paraLines.push(lines[i])
      i++
    }
    if (paraLines.length > 0) {
      tokens.push({ type: 'paragraph', children: tokenizeInline(paraLines.join('\n')) })
    }
  }

  return tokens
}

// ─── List Parsing ───────────────────────────────────────────────────────────

function parseOrderedList(lines: string[], start: number): { list: OrderedListToken; nextIndex: number } {
  const items: ListItemToken[] = []
  let i = start
  const firstMatch = lines[i].match(/^(\s*)\d+[.)]\s+(.*)$/)
  const baseIndent = firstMatch ? getIndentLevel(firstMatch[1]) : 0
  const startNum = parseInt(lines[i].match(/(\d+)/)?.[1] || '1', 10)

  while (i < lines.length) {
    const match = lines[i].match(RE_ORDERED_LIST_ITEM)
    if (!match) break
    const indent = getIndentLevel(match[1])
    if (indent !== baseIndent) break

    const contentLines: string[] = [match[2]]
    i++

    // Continuation lines
    while (i < lines.length) {
      const nextLine = lines[i]
      if (nextLine.trim() === '') break
      const nextOl = nextLine.match(RE_ORDERED_LIST_ITEM)
      if (nextOl && getIndentLevel(nextOl[1]) <= baseIndent) break
      const nextUl = nextLine.match(RE_UNORDERED_LIST_ITEM)
      if (nextUl && getIndentLevel(nextUl[1]) <= baseIndent) break
      contentLines.push(nextLine)
      i++
    }

    const nestedBlocks = contentLines.length > 1 ? tokenizeBlocks(contentLines.slice(1).join('\n')) : []

    items.push({
      type: 'list_item',
      children: [{ type: 'paragraph', children: tokenizeInline(contentLines[0]) } as ParagraphToken, ...nestedBlocks],
    })
  }

  return { list: { type: 'ordered_list', start: startNum, items }, nextIndex: i }
}

function parseUnorderedList(lines: string[], start: number): { list: UnorderedListToken; nextIndex: number } {
  const items: ListItemToken[] = []
  let i = start
  const firstMatch = lines[i].match(/^(\s*)[-*+]\s+(.*)$/)
  const baseIndent = firstMatch ? getIndentLevel(firstMatch[1]) : 0

  while (i < lines.length) {
    const match = lines[i].match(RE_UNORDERED_LIST_ITEM)
    if (!match) break
    const indent = getIndentLevel(match[1])
    if (indent !== baseIndent) break

    const contentLines: string[] = [match[2]]
    i++

    while (i < lines.length) {
      const nextLine = lines[i]
      if (nextLine.trim() === '') break
      const nextUl = nextLine.match(RE_UNORDERED_LIST_ITEM)
      if (nextUl && getIndentLevel(nextUl[1]) <= baseIndent) break
      const nextOl = nextLine.match(RE_ORDERED_LIST_ITEM)
      if (nextOl && getIndentLevel(nextOl[1]) <= baseIndent) break
      contentLines.push(nextLine)
      i++
    }

    const nestedBlocks = contentLines.length > 1 ? tokenizeBlocks(contentLines.slice(1).join('\n')) : []

    items.push({
      type: 'list_item',
      children: [{ type: 'paragraph', children: tokenizeInline(contentLines[0]) } as ParagraphToken, ...nestedBlocks],
    })
  }

  return { list: { type: 'unordered_list', items }, nextIndex: i }
}

// ─── Inline Tokenizer ───────────────────────────────────────────────────────

/**
 * Tokenizes inline content: **bold**, *italic*, ~~strike~~, `code`,
 * <nc-xxx .../> inline XML tags, and line breaks.
 *
 * Priority: inline_xml > code > bold > italic > strike > text
 */
export function tokenizeInline(src: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let pos = 0

  // Pre-scan for inline XML tags and their positions
  const xmlMatches: Array<{ start: number; end: number; tagName: string; attrs: string }> = []
  RE_INLINE_XML.lastIndex = 0
  let xmlMatch = RE_INLINE_XML.exec(src)
  while (xmlMatch !== null) {
    xmlMatches.push({
      start: xmlMatch.index,
      end: xmlMatch.index + xmlMatch[0].length,
      tagName: xmlMatch[1],
      attrs: xmlMatch[2] || '',
    })
    xmlMatch = RE_INLINE_XML.exec(src)
  }

  // No XML tags — fast path
  if (xmlMatches.length === 0) {
    return tokenizeInlineSegment(src, 0, src.length)
  }

  let xmlIdx = 0

  while (pos < src.length) {
    // Check for inline XML tag at current position
    if (xmlIdx < xmlMatches.length && xmlMatches[xmlIdx].start === pos) {
      const xm = xmlMatches[xmlIdx]
      tokens.push({
        type: 'inline_xml',
        tagName: xm.tagName,
        attrs: parseXmlAttrs(xm.attrs),
      })
      pos = xm.end
      xmlIdx++
      continue
    }

    // Skip past any XML match that we've passed
    while (xmlIdx < xmlMatches.length && xmlMatches[xmlIdx].start < pos) {
      xmlIdx++
    }

    // Determine the end boundary for this text segment
    const segEnd = xmlIdx < xmlMatches.length ? xmlMatches[xmlIdx].start : src.length

    // Process markdown markers in this segment
    if (segEnd > pos) {
      tokens.push(...tokenizeInlineSegment(src, pos, segEnd))
      pos = segEnd
    }
  }

  return tokens
}

/**
 * Tokenize a segment of inline text (no XML tags) for markdown markers.
 * Uses a separate `flushed` cursor so plain text is always captured.
 */
function tokenizeInlineSegment(src: string, from: number, to: number): InlineToken[] {
  const tokens: InlineToken[] = []
  let pos = from
  let flushed = from // tracks how far we've flushed text

  const flushTextTo = (end: number) => {
    if (end > flushed) {
      const raw = src.slice(flushed, end)
      const segments = raw.split('\n')
      for (let s = 0; s < segments.length; s++) {
        if (segments[s]) tokens.push({ type: 'text', text: segments[s] })
        if (s < segments.length - 1) tokens.push({ type: 'br' })
      }
      flushed = end
    }
  }

  while (pos < to) {
    // Inline code: `...`
    if (src[pos] === '`') {
      const end = src.indexOf('`', pos + 1)
      if (end !== -1 && end < to) {
        flushTextTo(pos)
        tokens.push({ type: 'inline_code', code: src.slice(pos + 1, end) })
        pos = end + 1
        flushed = pos
        continue
      }
    }

    // Bold: **...**
    if (src[pos] === '*' && pos + 1 < to && src[pos + 1] === '*') {
      const end = src.indexOf('**', pos + 2)
      if (end !== -1 && end < to) {
        flushTextTo(pos)
        const inner = tokenizeInlineSegment(src, pos + 2, end)
        tokens.push({ type: 'bold', children: inner })
        pos = end + 2
        flushed = pos
        continue
      }
    }

    // Italic: *...*  (but not **)
    if (src[pos] === '*' && (pos + 1 >= to || src[pos + 1] !== '*')) {
      const end = findClosing(src, pos + 1, to, '*')
      if (end !== -1) {
        flushTextTo(pos)
        const inner = tokenizeInlineSegment(src, pos + 1, end)
        tokens.push({ type: 'italic', children: inner })
        pos = end + 1
        flushed = pos
        continue
      }
    }

    // Strikethrough: ~~...~~
    if (src[pos] === '~' && pos + 1 < to && src[pos + 1] === '~') {
      const end = src.indexOf('~~', pos + 2)
      if (end !== -1 && end < to) {
        flushTextTo(pos)
        const inner = tokenizeInlineSegment(src, pos + 2, end)
        tokens.push({ type: 'strike', children: inner })
        pos = end + 2
        flushed = pos
        continue
      }
    }

    pos++
  }

  // Flush any remaining plain text
  flushTextTo(to)
  return tokens
}

function findClosing(src: string, start: number, limit: number, marker: string): number {
  for (let i = start; i < limit; i++) {
    if (src[i] === marker && src[i - 1] !== '\\') return i
  }
  return -1
}

// ─── Vue VNode Renderer ─────────────────────────────────────────────────────

export interface NcChatXmlComponent {
  component: Component
  /** Extra static props merged with parsed attrs */
  props?: Record<string, any>
}

export interface NcChatRendererOptions {
  /**
   * Map XML tag names to Vue components.
   * Works for both block-level and inline XML tags.
   *
   * Example:
   * ```ts
   * {
   *   'nc-records': { component: ChatMarkdownEmbeddedGrid },
   *   'nc-data': { component: ChatMarkdownVirtualTable },
   *   'nc-record-source': { component: ChatMarkdownRecordCitation },
   *   'nc-refusal': { component: ChatRefusal },
   * }
   * ```
   */
  xmlComponents?: Record<string, NcChatXmlComponent>
  /**
   * Set to true when rendering a live-streaming response.
   * Strips trailing incomplete nc-* XML tags and auto-closes unclosed
   * code fences so partially-received content renders cleanly.
   */
  streaming?: boolean
}

export function renderTokens(tokens: BlockToken[], options: NcChatRendererOptions = {}): VNode[] {
  return tokens.map((token) => renderBlock(token, options))
}

function renderBlock(token: BlockToken, options: NcChatRendererOptions): VNode {
  switch (token.type) {
    case 'heading':
      return h(`h${token.depth}`, {}, renderInlineTokens(token.children, options))

    case 'paragraph':
      return h('p', {}, renderInlineTokens(token.children, options))

    case 'ordered_list':
      return h(
        'ol',
        { start: token.start },
        token.items.map((item) => renderListItem(item, options)),
      )

    case 'unordered_list':
      return h(
        'ul',
        {},
        token.items.map((item) => renderListItem(item, options)),
      )

    case 'blockquote':
      return h('blockquote', {}, renderTokens(token.children, options))

    case 'hr':
      return h('hr')

    case 'code_block':
      return h('pre', {}, [h('code', { class: token.lang ? `language-${token.lang}` : undefined }, token.code)])

    case 'xml_tag':
      return renderXmlComponent(token.tagName, token.attrs, token.children, options)

    case 'table':
      return h('table', { class: 'nc-md-table' }, [
        h('thead', {}, [
          h(
            'tr',
            {},
            token.headers.map((header, i) =>
              h('th', { style: `text-align: ${token.alignments[i] ?? 'left'}` }, renderInlineTokens(header, options)),
            ),
          ),
        ]),
        h(
          'tbody',
          {},
          token.rows.map((row) =>
            h(
              'tr',
              {},
              row.map((cell, i) =>
                h('td', { style: `text-align: ${token.alignments[i] ?? 'left'}` }, renderInlineTokens(cell, options)),
              ),
            ),
          ),
        ),
      ])

    default:
      return h('p')
  }
}

function renderListItem(item: ListItemToken, options: NcChatRendererOptions): VNode {
  if (item.children.length === 1 && item.children[0].type === 'paragraph') {
    return h('li', {}, renderInlineTokens((item.children[0] as ParagraphToken).children, options))
  }
  return h('li', {}, renderTokens(item.children, options))
}

function renderInlineTokens(tokens: InlineToken[], options: NcChatRendererOptions): VNode[] {
  return tokens.map((token) => renderInline(token, options))
}

function renderInline(token: InlineToken, options: NcChatRendererOptions): VNode {
  switch (token.type) {
    case 'text':
      // Return raw text string for VNode (avoids wrapping every word in <span>)
      return h('span', {}, token.text)

    case 'bold':
      return h('strong', {}, renderInlineTokens(token.children, options))

    case 'italic':
      return h('em', {}, renderInlineTokens(token.children, options))

    case 'strike':
      return h('s', {}, renderInlineTokens(token.children, options))

    case 'inline_code':
      return h('code', {}, token.code)

    case 'br':
      return h('br')

    case 'inline_xml':
      return renderXmlComponent(token.tagName, token.attrs, '', options)

    default:
      return h('span')
  }
}

/**
 * Render an XML tag (block or inline) as a Vue component.
 * JSON-valued attrs are auto-parsed.
 */
function renderXmlComponent(
  tagName: string,
  attrs: Record<string, string>,
  children: string,
  options: NcChatRendererOptions,
): VNode {
  const mapping = options.xmlComponents?.[tagName]

  if (mapping) {
    const resolvedProps: Record<string, any> = { ...mapping.props }
    for (const [key, value] of Object.entries(attrs)) {
      try {
        resolvedProps[key] = JSON.parse(value)
      } catch {
        resolvedProps[key] = value
      }
    }
    if (children) {
      resolvedProps.content = children
    }
    return h(mapping.component, resolvedProps)
  }

  // Fallback: render as span with data attribute (won't break layout)
  return h('span', { 'data-nc-tag': tagName }, '')
}

// ─── Streaming Sanitizer ────────────────────────────────────────────────────

/**
 * Strips trailing incomplete constructs from a streaming AI response so that
 * partially-received tokens don't render as broken plain text.
 *
 * Handles:
 * 1. Incomplete nc-* XML tags — e.g. `<nc-record-source recordIds='[1` has no
 *    closing `>` yet, so it would fall through to the paragraph tokenizer and
 *    appear as literal text.  We strip from the last `<nc-` onward.
 * 2. Unclosed code fences — an opening ``` without a matching closing ``` is
 *    auto-closed so the code block renders cleanly mid-stream.
 */
export function sanitizeStreamingMarkdown(src: string): string {
  let result = src

  // 1. Strip any trailing incomplete nc-* XML tag.
  //    An incomplete tag is one where the substring starting at `<nc-` has
  //    not yet received its closing `>` (which also covers `/>` since it
  //    contains `>`).
  const lastNcIdx = result.lastIndexOf('<nc-')
  if (lastNcIdx !== -1 && !result.slice(lastNcIdx).includes('>')) {
    result = result.slice(0, lastNcIdx).trimEnd()
  }

  // 2. Auto-close an unclosed code fence so the block renders mid-stream.
  const lines = result.split('\n')
  let fenceOpen = false
  for (const line of lines) {
    if (line.startsWith('```')) fenceOpen = !fenceOpen
  }
  if (fenceOpen) result += '\n```'

  return result
}

// ─── Public API ─────────────────────────────────────────────────────────────

/**
 * Parse markdown + XML tags and return Vue VNodes.
 *
 * @example
 * ```vue
 * <script setup>
 * import { parseChatMarkdown } from '~/ee/utils/chatMarkdown'
 * import ChatMarkdownEmbeddedGrid from '~/ee/components/chat/markdown/EmbeddedGrid.vue'
 * import ChatMarkdownRecordCitation from '~/ee/components/chat/markdown/RecordCitation.vue'
 *
 * const vnodes = computed(() =>
 *   parseChatMarkdown(text.value, {
 *     xmlComponents: {
 *       'nc-records': { component: ChatMarkdownEmbeddedGrid },
 *       'nc-record-source': { component: ChatMarkdownRecordCitation },
 *       'nc-data': { component: ChatMarkdownVirtualTable },
 *       'nc-refusal': { component: ChatRefusal },
 *     }
 *   })
 * )
 * </script>
 *
 * <template>
 *   <div class="nc-chat-markdown">
 *     <component :is="() => vnodes" />
 *   </div>
 * </template>
 * ```
 *
 * Supported markdown:
 * - Headings: # h1, ## h2, ### h3, #### h4
 * - Bold: **text**
 * - Italic: *text*
 * - Strikethrough: ~~text~~
 * - Inline code: `code`
 * - Code blocks: ```lang ... ```
 * - Ordered lists: 1. item
 * - Unordered lists: - item
 * - Blockquotes: > text
 * - Horizontal rules: ---
 *
 * Supported XML tags (mapped to Vue components):
 * - Block: <nc-records recordIds='["id1"]' /> (own line)
 * - Inline: text <nc-record-source recordIds='["id1"]' /> more text
 */
export function parseChatMarkdown(src: string, options: NcChatRendererOptions = {}): VNode[] {
  if (!src) return []
  const content = options.streaming ? sanitizeStreamingMarkdown(src) : src
  const tokens = tokenizeBlocks(content)
  return renderTokens(tokens, options)
}
