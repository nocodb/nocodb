import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import TiptapImage, { type ImageOptions } from '@tiptap/extension-image'
import { nodeInputRule, nodePasteRule } from '@tiptap/core'
import type { MarkdownNodeSpec } from '../../types'
import { mdImageAsText } from '../../../tiptap/functionality'

/**
 * Matches ONLY completed image syntax while typing
 * ![alt](src)
 * ![alt](src "title")
 * ![alt](src 'title')
 */
export const IMAGE_INPUT_REGEX = /(?:^|\s)(!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']+)["'])?\))$/

/**
 * Matches image markdown anywhere (paste)
 */
export const IMAGE_PASTE_REGEX = /!\[([^\]]*)\]\((\S+?)(?:\s+["']([^"']+)["'])?\)/g

const escapeAttr = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

/** Markdown has no image size, so a resized image is written as an <img> tag. */
export const imageToHTML = (attrs: { src?: string; alt?: string; title?: string; width?: number }) =>
  `<img src="${escapeAttr(attrs.src || '')}" alt="${escapeAttr(attrs.alt || '')}"${
    attrs.title ? ` title="${escapeAttr(attrs.title)}"` : ''
  } width="${attrs.width}">`

const parseWidth = (el: HTMLElement) => {
  // Pixels only: `100%` would otherwise be read as 100px
  const raw = (el.getAttribute('width') || el.style.width || '').trim()
  if (!/^\d+(px)?$/i.test(raw)) return null
  return parseInt(raw, 10) || null
}

export const Image = TiptapImage.extend<ImageOptions, { markdown: MarkdownNodeSpec }>({
  addAttributes() {
    return {
      ...this.parent?.(),
      // Pixels; null keeps the natural size, capped to the editor width
      width: {
        default: null,
        parseHTML: (el) => parseWidth(el),
        renderHTML: (attrs) => (attrs.width ? { width: String(attrs.width) } : {}),
      },
    }
  },

  addStorage() {
    return {
      markdown: {
        serialize(state, node, parent, index) {
          if (node.attrs.width) {
            state.write(imageToHTML(node.attrs))
          } else {
            defaultMarkdownSerializer.nodes.image!(state, node, parent, index)
          }
          // The default serializer treats images as inline; a block image must end its block,
          // or the next block is glued onto the same line (`![](x)### Heading`).
          if (node.isBlock) state.closeBlock(node)
        },
        parse: {
          setup(markdownit) {
            // Conditionally apply mdImageAsText plugin based on renderImagesAsLinks option
            if (this.editor.storage.markdown?.options?.renderImagesAsLinks) {
              markdownit.use(mdImageAsText)
            }
          },
        },
      },
      addImageMode: false,
    }
  },

  /**
   * Convert markdown syntax while typing
   */
  addInputRules() {
    return [
      nodeInputRule({
        find: IMAGE_INPUT_REGEX,
        type: this.type,
        getAttributes: (match) => {
          const [, , alt, src, title] = match

          return {
            src,
            alt,
            title,
          }
        },
      }),
    ]
  },

  /**
   * Convert markdown syntax on paste
   */
  addPasteRules() {
    return [
      nodePasteRule({
        find: IMAGE_PASTE_REGEX,
        type: this.type,
        getAttributes: (match) => {
          const [, alt, src, title] = match

          return {
            src,
            alt,
            title,
          }
        },
      }),
    ]
  },
})
