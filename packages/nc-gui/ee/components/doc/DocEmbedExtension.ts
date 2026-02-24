/**
 * Embed node extension for the doc editor.
 *
 * Renders supported URLs (YouTube, Vimeo, Loom, etc.) as iframe previews.
 * Reuses getEmbedURL() from the url-preview-ee extension for platform matching.
 *
 * Attributes:
 * - `src`:      the embeddable URL (e.g. https://www.youtube.com/embed/xxx)
 * - `url`:      the original user-provided URL
 * - `platform`: platform name (e.g. "Youtube", "Vimeo")
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import DocEmbedNode from './DocEmbedNode.vue'

export const DocEmbedExtension = Node.create({
  name: 'embed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-src'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.src) return {}
          return { 'data-src': attrs.src }
        },
      },
      url: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-url'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.url) return {}
          return { 'data-url': attrs.url }
        },
      },
      platform: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-platform') || '',
        renderHTML: (attrs: Record<string, any>) => {
          return { 'data-platform': attrs.platform || '' }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="embed"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'embed' })]
  },

  addNodeView() {
    return VueNodeViewRenderer(DocEmbedNode)
  },

  addCommands() {
    return {
      insertEmbed:
        (attrs: Record<string, any>) =>
        ({ chain }: any) => {
          return chain().insertContent({ type: this.name, attrs }).run()
        },
    }
  },

  addStorage() {
    return {
      // Callback set by Editor.vue — called by the YouTube command after inline URL input
      insertFromUrl: null as ((editor: any, url: string) => void) | null,
      // Temporary field used by SlashCommandMenu to pass the URL to the command
      _pendingUrl: null as string | null,
    }
  },
})
