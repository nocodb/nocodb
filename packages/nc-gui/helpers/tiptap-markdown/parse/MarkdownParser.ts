import MarkdownIt from 'markdown-it'
import type { Editor } from '@tiptap/core'
import { elementFromString, extractElement, unwrapElement } from '../util/dom'
import { getMarkdownSpec } from '../util/extensions'
import { mdImageAsText } from '~/helpers/tiptap/functionality'

export class MarkdownParser {
  editor: Editor

  md: MarkdownIt

  constructor(editor: Editor, { html, linkify, breaks }: Partial<MarkdownIt.Options>) {
    this.editor = editor

    this.md = this.withPatchedRenderer(
      MarkdownIt({
        html,
        linkify,
        breaks,
      }),
    )

    /**
     * Todo: Remove this once we enable proper image support in the rich text editor.
     * Also, replace its usage in other places such as:
     * 1. packages/nc-gui/helpers/tiptap/functionality/markdown/markdown.ts
     * 2. packages/nc-gui/helpers/tiptap-markdown/extensions/nodes/image.ts
     */
    this.md.use(mdImageAsText)
  }

  parse<T>(content: T, { inline }: { inline?: boolean } = {}): T | string {
    if (!ncIsString(content)) return content

    this.editor.extensionManager.extensions.forEach((extension) =>
      getMarkdownSpec(extension)?.parse?.setup?.call({ editor: this.editor, options: extension.options }, this.md),
    )

    const renderedHTML = this.md.render(content)
    const element = elementFromString(renderedHTML)

    this.editor.extensionManager.extensions.forEach((extension) =>
      getMarkdownSpec(extension)?.parse?.updateDOM?.call({ editor: this.editor, options: extension.options }, element),
    )

    this.normalizeDOM(element, { inline, content })

    return element.innerHTML
  }

  normalizeDOM(node: HTMLElement, { inline, content }: { inline?: boolean; content: string }) {
    this.normalizeBlocks(node)

    // remove all \n appended by markdown-it
    node.querySelectorAll('*').forEach((el) => {
      if (el.nextSibling?.nodeType === Node.TEXT_NODE && !el.closest('pre')) {
        el.nextSibling.textContent = el.nextSibling.textContent?.replace(/^\n/, '') ?? ''
      }
    })

    if (inline) {
      this.normalizeInline(node, content)
    }

    return node
  }

  normalizeBlocks(node: HTMLElement) {
    const blocks = Object.values(this.editor.schema.nodes).filter((node) => node.isBlock)

    const selector = blocks
      .map((block) => block.spec.parseDOM?.map((spec) => spec.tag))
      .flat()
      .filter(Boolean)
      .join(',')

    if (!selector) {
      return
    }

    ;[...node.querySelectorAll(selector)].forEach((el) => {
      if (el.parentElement?.matches('p')) {
        extractElement(el)
      }
    })
  }

  normalizeInline(node: HTMLElement, content: string) {
    if (node.firstElementChild?.matches('p')) {
      const firstParagraph = node.firstElementChild
      const { nextElementSibling } = firstParagraph
      const startSpaces = content.match(/^\s+/)?.[0] ?? ''
      const endSpaces = !nextElementSibling ? content.match(/\s+$/)?.[0] ?? '' : ''

      if (content.match(/^\n\n/)) {
        firstParagraph.innerHTML = `${firstParagraph.innerHTML}${endSpaces}`
        return
      }

      unwrapElement(firstParagraph)

      node.innerHTML = `${startSpaces}${node.innerHTML}${endSpaces}`
    }
  }

  withPatchedRenderer(md: MarkdownIt) {
    const withoutNewLine =
      (renderer) =>
      (...args) => {
        const rendered = renderer(...args)
        if (rendered === '\n') {
          return rendered // keep soft breaks
        }
        if (rendered[rendered.length - 1] === '\n') {
          return rendered.slice(0, -1)
        }
        return rendered
      }

    md.renderer.rules.hardbreak = withoutNewLine(md.renderer.rules.hardbreak)
    md.renderer.rules.softbreak = withoutNewLine(md.renderer.rules.softbreak)
    md.renderer.rules.fence = withoutNewLine(md.renderer.rules.fence)
    md.renderer.rules.code_block = withoutNewLine(md.renderer.rules.code_block)
    md.renderer.renderToken = withoutNewLine(md.renderer.renderToken.bind(md.renderer))

    return md
  }
}
