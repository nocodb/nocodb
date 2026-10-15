import TiptapImage from '@tiptap/extension-image'
import { Fragment } from '@tiptap/pm/model'
import type { Node as PMNode } from '@tiptap/pm/model'

/** Types the send path turns into Content-ID parts; SVG is excluded there as a script-capable document. */
export const EMAIL_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']

/** The send path types a stored image by its file extension (emailBody.ts), so the picker checks it too. */
export const EMAIL_IMAGE_EXTENSIONS = ['png', 'jpg', 'jpeg', 'jpe', 'jfif', 'gif', 'webp']

export function isEmailImageFile(file: { name: string; type: string }): boolean {
  const ext = /\.([a-z0-9]+)$/i.exec(file.name)?.[1]?.toLowerCase()
  return EMAIL_IMAGE_TYPES.includes(file.type) && !!ext && EMAIL_IMAGE_EXTENSIONS.includes(ext)
}

/** Per image. */
export const EMAIL_IMAGE_MAX_SIZE = 512 * 1024

/** Mirror the send path's caps (noco-integrations emailBody.ts), where identical images share one part. */
export const EMAIL_IMAGE_MAX_COUNT = 10

export const EMAIL_IMAGE_MAX_TOTAL_SIZE = 2 * 1024 * 1024

/** Wider than a signature logo needs; high-DPI files would otherwise render at full pixel width. */
export const EMAIL_IMAGE_MAX_WIDTH = 320

/** The image menu's "Small" size. */
export const EMAIL_IMAGE_SMALL_WIDTH = 120

/** Narrowest a drag can make an image. */
export const EMAIL_IMAGE_MIN_WIDTH = 24

const RESIZE_CORNERS = ['nw', 'ne', 'sw', 'se'] as const

/**
 * The click that ends a resize drag. It targets the nearest common ancestor of the handle and
 * wherever the drag was released, so a release past the modal would read as a mask click.
 */
function swallowNextClick() {
  const swallow = (e: Event) => {
    e.preventDefault()
    e.stopPropagation()
  }
  window.addEventListener('click', swallow, { capture: true, once: true })
  setTimeout(() => window.removeEventListener('click', swallow, { capture: true }))
}

/** Body images are workflow uploads, stored in the body as `src="nc-file:<file_url>"`. */
export const EMAIL_FILE_IMAGE_SCHEME = 'nc-file:'

// `data:` images the send path still accepts. The editor never creates them, but bodies written
// through the API or MCP may carry them, and a load must not strip what would have been sent.
const SENDABLE_DATA_IMAGE = /^data:image\/(?:png|jpe?g|gif|webp);base64,/i

/** Decoded bytes of a `data:` image src, for the body's size cap. */
function dataImageBytes(src: string): number {
  const base64 = src.slice(src.indexOf(',') + 1).replace(/\s+/g, '')
  return Math.floor((base64.length * 3) / 4)
}

/** Whether `src` came from outside this editor (a pasted `data:` image), not one it can keep. */
export function isForeignImageSrc(src: string): boolean {
  return !src.startsWith(EMAIL_FILE_IMAGE_SCHEME)
}

export interface EmailImageUsage {
  srcs: Set<string>
  bytes: number
}

export function emailImageUsage(content: { descendants: (f: (node: PMNode) => boolean | void) => void }): EmailImageUsage {
  const usage: EmailImageUsage = { srcs: new Set(), bytes: 0 }
  content.descendants((node) => {
    if (node.type.name !== 'image') return
    addEmailImage(usage, node.attrs.src, Number(node.attrs.size) || 0)
  })
  return usage
}

/** Whether one more image of `bytes` still fits the body's limits. */
export function canAddEmailImage(usage: EmailImageUsage, bytes: number): boolean {
  return usage.srcs.size < EMAIL_IMAGE_MAX_COUNT && usage.bytes + bytes <= EMAIL_IMAGE_MAX_TOTAL_SIZE
}

/** Counts `src` into `usage`; false when that would break the body's limits (usage is then untouched). */
export function addEmailImage(usage: EmailImageUsage, src: string, bytes: number): boolean {
  if (usage.srcs.has(src)) return true
  if (!canAddEmailImage(usage, bytes)) return false
  usage.srcs.add(src)
  usage.bytes += bytes
  return true
}

/** Drops the images `keep` rejects, at any depth. */
export function filterImages(fragment: Fragment, keep: (node: PMNode) => boolean): Fragment {
  const nodes: PMNode[] = []
  fragment.forEach((node) => {
    if (node.type.name === 'image') {
      if (keep(node)) nodes.push(node)
    } else {
      nodes.push(node.isLeaf ? node : node.copy(filterImages(node.content, keep)))
    }
  })
  return Fragment.from(nodes)
}

export interface EmailImageOptions {
  inline: boolean
  allowBase64: boolean
  HTMLAttributes: Record<string, any>
  /** Displayable URL for a stored `nc-file:` src; stored sources are not loadable as-is. */
  resolveSrc?: (src: string) => Promise<string | undefined>
  /** Tooltip on a stored image whose file can no longer be loaded. */
  missingLabel?: string
}

/**
 * Body images are workflow uploads referenced as `nc-file:` and sent as inline Content-ID parts;
 * the bytes are loaded only at send time. Remote sources are not parsed: the sender drops them
 * (clients block them, and they track the recipient). Sendable `data:` images are kept when a body
 * loads, so an API-authored body survives being opened; pastes drop them (see transformPasted).
 */
export const EmailImage = TiptapImage.extend<EmailImageOptions>({
  addOptions() {
    return {
      ...(this.parent?.() ?? { inline: false, allowBase64: false, HTMLAttributes: {} }),
      resolveSrc: undefined,
      missingLabel: undefined,
    }
  },

  // TiptapImage turns typed `![alt](url)` into an image; a body image is always an upload.
  addInputRules() {
    return []
  },

  parseHTML() {
    // No per-image size check on load: the picker enforces 512 KB, while the send path takes any
    // image within the body's 2 MB, and dropping one here would strip it on the next autosave.
    return [
      { tag: `img[src^="${EMAIL_FILE_IMAGE_SCHEME}"]` },
      {
        tag: 'img[src^="data:"]',
        getAttrs: (el: HTMLElement) => (SENDABLE_DATA_IMAGE.test(el.getAttribute('src') ?? '') ? null : false),
      },
    ]
  },

  // Own DOM (renderHTML is not used in the editor), so update() re-applies every attribute.
  // Resizing drags an outline (the frame) and leaves the image alone until release, as mail
  // composers do; the image menu is hidden meanwhile so it does not sit over the outline.
  addNodeView() {
    const { resolveSrc, missingLabel } = this.options

    return ({ node, editor, getPos }) => {
      let current = node
      let shownSrc: string | undefined

      const dom = document.createElement('span')
      dom.className = 'nc-email-image'
      const img = document.createElement('img')
      const frame = document.createElement('span')
      frame.className = 'nc-email-image-frame'
      dom.append(img, frame)

      let retryTimer: ReturnType<typeof setTimeout> | undefined
      let retries = 0
      let retrySrc: string | undefined

      function showSrc(src: string) {
        if (src === shownSrc) return
        if (src !== retrySrc) {
          retrySrc = src
          retries = 0
        }
        clearTimeout(retryTimer)
        shownSrc = src
        dom.classList.remove('is-missing')
        dom.removeAttribute('title')
        if (!src.startsWith(EMAIL_FILE_IMAGE_SCHEME)) {
          img.src = src
          return
        }
        img.removeAttribute('src')
        resolveSrc?.(src).then(
          (url) => {
            if (shownSrc !== src) return
            if (url) {
              retries = 0
              img.src = url
              return
            }
            // The file is gone (removed, or another workflow's upload), so the send will leave it out.
            dom.classList.add('is-missing')
            if (missingLabel) dom.title = missingLabel
          },
          () => {
            // Couldn't ask (route not ready, request failed): that says nothing about the file, so
            // stay blank and ask again a few times, backing off.
            if (shownSrc !== src) return
            shownSrc = undefined
            if (retries >= 4) return
            retryTimer = setTimeout(() => {
              if (dom.isConnected && current.attrs.src === src) showSrc(src)
            }, 1000 * 2 ** retries++)
          },
        )
      }

      function apply(n: PMNode) {
        showSrc(n.attrs.src)
        for (const attr of ['alt', 'title', 'width'] as const) {
          if (n.attrs[attr]) img.setAttribute(attr, String(n.attrs[attr]))
          else img.removeAttribute(attr)
        }
      }

      function resetFrame() {
        frame.removeAttribute('style')
        dom.classList.remove('is-resizing')
        document.body.classList.remove('nc-email-image-resizing')
      }

      function startResize(event: PointerEvent, corner: (typeof RESIZE_CORNERS)[number]) {
        if (!editor.isEditable || event.button !== 0) return
        // No stopPropagation: outside-click guards (onClickOutside) read this pointerdown on
        // window to tell the press began inside the modal. stopEvent keeps ProseMirror out.
        event.preventDefault()

        const rect = img.getBoundingClientRect()
        const startX = event.clientX
        const ratio = rect.width ? rect.height / rect.width : 1
        const fromLeft = corner.endsWith('w')
        const fromTop = corner.startsWith('n')
        const maxWidth = Math.max(EMAIL_IMAGE_MIN_WIDTH, editor.view.dom.clientWidth)
        let width = Math.round(rect.width)

        dom.classList.add('is-resizing')
        document.body.classList.add('nc-email-image-resizing')

        const onMove = (e: PointerEvent) => {
          const next = rect.width + (fromLeft ? -1 : 1) * (e.clientX - startX)
          width = Math.round(Math.min(maxWidth, Math.max(EMAIL_IMAGE_MIN_WIDTH, next)))
          const height = Math.round(width * ratio)
          // Grow away from the dragged corner: the opposite corner stays put.
          frame.style.width = `${width}px`
          frame.style.height = `${height}px`
          frame.style.left = fromLeft ? `${rect.width - width}px` : '0'
          frame.style.top = fromTop ? `${rect.height - height}px` : '0'
        }

        const onUp = () => {
          window.removeEventListener('pointermove', onMove)
          window.removeEventListener('pointerup', onUp)
          window.removeEventListener('pointercancel', onUp)
          resetFrame()
          swallowNextClick()

          const pos = typeof getPos === 'function' ? getPos() : undefined
          if (typeof pos !== 'number' || width === Math.round(rect.width)) return
          editor
            .chain()
            .focus()
            .command(({ tr }) => {
              tr.setNodeMarkup(pos, undefined, { ...current.attrs, width })
              return true
            })
            .setNodeSelection(pos)
            .run()
        }

        window.addEventListener('pointermove', onMove)
        window.addEventListener('pointerup', onUp)
        window.addEventListener('pointercancel', onUp)
      }

      for (const corner of RESIZE_CORNERS) {
        const handle = document.createElement('span')
        handle.className = `nc-email-image-handle is-${corner}`
        handle.addEventListener('pointerdown', (e) => startResize(e, corner))
        frame.appendChild(handle)
      }

      apply(node)

      return {
        dom,
        update(n) {
          if (n.type !== current.type) return false
          current = n
          apply(n)
          return true
        },
        selectNode() {
          dom.classList.add('ProseMirror-selectednode')
        },
        deselectNode() {
          dom.classList.remove('ProseMirror-selectednode')
        },
        // Handle drags are ours; ProseMirror would otherwise start a selection or a node drag.
        stopEvent(event) {
          return !!(event.target as HTMLElement | null)?.closest?.('.nc-email-image-handle')
        },
        // The view owns this DOM, including the frame styles set mid-drag.
        ignoreMutation() {
          return true
        },
        destroy() {
          clearTimeout(retryTimer)
          resetFrame()
        },
      }
    }
  },

  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('width'),
        renderHTML: (attrs: Record<string, any>) => (attrs.width ? { width: attrs.width } : {}),
      },
      // Bytes, so the editor can hold the body to the send path's total cap without the file.
      size: {
        default: null,
        parseHTML: (el: HTMLElement) => {
          const src = el.getAttribute('src') ?? ''
          return Number(el.getAttribute('data-nc-size')) || (src.startsWith('data:') ? dataImageBytes(src) : null)
        },
        renderHTML: (attrs: Record<string, any>) => (attrs.size ? { 'data-nc-size': attrs.size } : {}),
      },
    }
  },
}).configure({ inline: true })
