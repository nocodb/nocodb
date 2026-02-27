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
 * - `height`:   user-resized height in px (null = default 16:9 aspect)
 * - `width`:    user-resized width as percentage 1-100 (null = 100%)
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
      height: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const h = el.getAttribute('data-height')
          return h ? Number(h) : null
        },
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.height) return {}
          return { 'data-height': String(attrs.height) }
        },
      },
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const w = el.getAttribute('data-width')
          return w ? Number(w) : null
        },
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.width) return {}
          return { 'data-width': String(attrs.width) }
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
