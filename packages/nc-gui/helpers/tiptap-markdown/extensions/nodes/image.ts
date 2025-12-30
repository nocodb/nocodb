import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import type { MarkdownNodeSpec } from '../../types'
import { mdImageAsText } from '../../../tiptap/functionality'
import TiptapImage, { type ImageOptions } from '@tiptap/extension-image'

// TODO: Extend from tiptap extension
export const Image = TiptapImage.extend<ImageOptions, { markdown: MarkdownNodeSpec }>({
  name: 'image',
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
    }
  },
})
