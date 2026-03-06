/**
 * File attachment node extension for the doc editor.
 *
 * Renders uploaded files as card blocks showing file type badge, name, and size.
 * Attributes:
 * - `path`: permanent NocoDB storage path (set after upload completes)
 * - `src`:  temporary blob URL during upload, or resolved signed URL
 * - `fileName`: original file name
 * - `fileSize`: file size in bytes
 * - `fileType`: MIME type string
 *
 * Uses VueNodeViewRenderer to render DocFileAttachmentNode.vue as the card UI.
 * Provides `openUpload` callback in storage for slash command integration.
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import DocFileAttachmentNode from './DocFileAttachmentNode.vue'

export const DocFileAttachmentExtension = Node.create({
  name: 'fileAttachment',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-id'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.id) return {}
          return { 'data-id': attrs.id }
        },
      },
      path: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-path'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.path) return {}
          return { 'data-path': attrs.path }
        },
      },
      src: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-src'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.src) return {}
          return { 'data-src': attrs.src }
        },
      },
      fileName: {
        default: 'Untitled',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-file-name'),
        renderHTML: (attrs: Record<string, any>) => {
          return { 'data-file-name': attrs.fileName || 'Untitled' }
        },
      },
      fileSize: {
        default: 0,
        parseHTML: (el: HTMLElement) => {
          const v = el.getAttribute('data-file-size')
          return v ? parseInt(v, 10) : 0
        },
        renderHTML: (attrs: Record<string, any>) => {
          return { 'data-file-size': String(attrs.fileSize || 0) }
        },
      },
      fileType: {
        default: '',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-file-type') || '',
        renderHTML: (attrs: Record<string, any>) => {
          return { 'data-file-type': attrs.fileType || '' }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="file-attachment"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'file-attachment' })]
  },

  addNodeView() {
    return VueNodeViewRenderer(DocFileAttachmentNode)
  },

  addCommands() {
    return {
      insertFileAttachment:
        (attrs: Record<string, any>) =>
        ({ chain }: any) => {
          return chain().insertContent({ type: this.name, attrs }).run()
        },
    }
  },

  addStorage() {
    return {
      // Callback set by Editor.vue — called by slash command to trigger upload
      openUpload: null as (() => void) | null,
    }
  },
})
