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

export const Image = TiptapImage.extend<ImageOptions, { markdown: MarkdownNodeSpec }>({
  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.nodes.image!,
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
