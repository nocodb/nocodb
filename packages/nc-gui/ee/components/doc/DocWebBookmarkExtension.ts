/**
 * Web bookmark node extension for the doc editor.
 *
 * Renders a Notion-style link preview card with favicon, title, description,
 * and an optional preview image. Metadata is fetched server-side once on
 * creation and persisted in the node attributes — image is cached via the
 * storage adapter so the preview survives if the source removes it.
 *
 * Attributes:
 * - `url`:         the bookmarked URL (always present)
 * - `title`:       page title from <title> / og:title
 * - `description`: short description from og:description / meta description
 * - `faviconUrl`:  resolved favicon URL (rendered directly)
 * - `imagePath`:   storage-relative path to the cached og:image; the FileReference
 *                  lookup key in reconcileFileReferences (persisted)
 * - `fileSize`:    byte size of the cached image, recorded on the FileReference
 *                  for workspace storage accounting (persisted)
 * - `id`:          FileReference id — populated by reconcileFileReferences on
 *                  the next doc save (mirrors image / fileAttachment lifecycle).
 *                  Durable image serving uses this via the cookie-authed proxy.
 * - `siteName`:    publisher / site name (e.g. "GitHub")
 * - `imageUrl`:    source og:image URL — preview only, shown before the doc is
 *                  saved (no `id` yet). NOT a signed URL; ignored once `id` exists
 * - `isLoading`:   transient flag while metadata is being fetched
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import DocWebBookmarkNode from './DocWebBookmarkNode.vue'

export interface WebBookmarkMetadata {
  url: string
  title: string | null
  description: string | null
  faviconUrl: string | null
  imageUrl: string | null
  imagePath: string | null
  fileSize: number | null
  siteName: string | null
  status: 'fetched' | 'fetch_failed'
}

export interface WebBookmarkNodeAttrs extends WebBookmarkMetadata {
  id: string | null
}

export const DocWebBookmarkExtension = Node.create({
  name: 'webBookmark',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      // FileReference id — stamped by reconcileFileReferences on doc save.
      // Matches the `id` attribute on image / fileAttachment nodes.
      id: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-id'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.id) return {}
          return { 'data-id': attrs.id }
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
      title: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-title'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.title) return {}
          return { 'data-title': attrs.title }
        },
      },
      description: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-description'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.description) return {}
          return { 'data-description': attrs.description }
        },
      },
      faviconUrl: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-favicon-url'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.faviconUrl) return {}
          return { 'data-favicon-url': attrs.faviconUrl }
        },
      },
      // Source og:image URL — preview only, shown before the FileReference id
      // exists. Not emitted as an HTML attr; it can still appear in the saved
      // PM-JSON content, which is harmless (unsigned public URL, ignored once
      // `id` drives the proxy). Durable serving is the proxy keyed by `id`.
      imageUrl: {
        default: null,
        parseHTML: () => null,
        renderHTML: () => ({}),
      },
      imagePath: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-image-path'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.imagePath) return {}
          return { 'data-image-path': attrs.imagePath }
        },
      },
      fileSize: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const v = el.getAttribute('data-file-size')
          return v ? Number(v) : null
        },
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.fileSize) return {}
          return { 'data-file-size': String(attrs.fileSize) }
        },
      },
      siteName: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-site-name'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.siteName) return {}
          return { 'data-site-name': attrs.siteName }
        },
      },
      // Transient — not persisted via data attrs
      isLoading: {
        default: false,
        parseHTML: () => false,
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-type="web-bookmark"]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'web-bookmark' })]
  },

  addNodeView() {
    return VueNodeViewRenderer(DocWebBookmarkNode)
  },

  addCommands() {
    return {
      insertWebBookmark:
        (attrs: Record<string, any>) =>
        ({ chain }: any) => {
          return chain().insertContent({ type: this.name, attrs }).run()
        },
    }
  },

  addStorage() {
    return {
      // Set by Editor.vue — fetches metadata from backend then inserts node
      insertFromUrl: null as ((editor: any, url: string) => void) | null,
      // Temporary field used by SlashCommandMenu to pass the URL to the command
      _pendingUrl: null as string | null,
    }
  },
})
