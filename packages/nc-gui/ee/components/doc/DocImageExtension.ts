/**
 * Custom image extension for the doc editor.
 *
 * Extends @tiptap/extension-image with:
 * - `path` attr: permanent NocoDB storage path (persisted in doc JSON)
 * - `width` attr: pixel width for resize (null = auto, capped to 100%)
 * - `align` attr: horizontal alignment (left | center | right)
 * - Custom NodeView (DocImageNode.vue) for resize handles + toolbar
 * - `openUpload` callback in storage for slash command integration
 */
import Image from '@tiptap/extension-image'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import DocImageNode from './DocImageNode.vue'

export const DocImageExtension = Image.extend({
  name: 'image',

  addAttributes() {
    return {
      // Inherit src, alt, title from base Image
      ...Image.config.addAttributes?.call(this),
      path: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-path'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.path) return {}
          return { 'data-path': attrs.path }
        },
      },
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const w = el.getAttribute('data-width')
          return w ? parseInt(w, 10) : null
        },
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.width) return {}
          return { 'data-width': String(attrs.width) }
        },
      },
      align: {
        default: 'center',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-align') || 'center',
        renderHTML: (attrs: Record<string, any>) => {
          return { 'data-align': attrs.align || 'center' }
        },
      },
      caption: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-caption') || null,
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.caption) return {}
          return { 'data-caption': attrs.caption }
        },
      },
    }
  },

  addNodeView() {
    return VueNodeViewRenderer(DocImageNode)
  },

  addStorage() {
    return {
      // Callback set by Editor.vue — called by slash command to trigger upload
      openUpload: null as (() => void) | null,
    }
  },
})
