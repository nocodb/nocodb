/**
 * Callout (notice) block extension for the doc editor.
 *
 * Renders a styled container with an SVG icon and editable content.
 * Four types: note (blue), warning (amber), tip (green), important (red).
 *
 * Stored in ProseMirror doc as:
 *   { type: 'callout', attrs: { type: 'note' }, content: [...] }
 */
import { Node, mergeAttributes } from '@tiptap/core'

export type CalloutType = 'note' | 'warning' | 'tip' | 'important'

/** SVG icons for each callout type — used both in the editor and the slash menu. */
export const calloutIcons: Record<CalloutType, string> = {
  note: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#3b82f6" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,
  warning: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#f59e0b" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,
  tip: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#22c55e" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7 20h10"/><path d="M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8z"/><path d="M14.1 6a7 7 0 0 0-1.1-3c1.9.5 3.3 1.6 4.4 3.1a12.3 12.3 0 0 1 2 5.6c-2-.8-3.5-1.8-4.5-3.2a9 9 0 0 1-.8-2.5z"/></svg>`,
  important: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#ef4444" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`,
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      setCallout: (attrs?: { type?: CalloutType }) => ReturnType
    }
  }
}

export const CalloutExtension = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      type: {
        default: 'note',
        parseHTML: (el) => el.getAttribute('data-callout-type') || 'note',
        renderHTML: (attrs) => ({ 'data-callout-type': attrs.type }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-callout-type]' }]
  },

  renderHTML({ node, HTMLAttributes }) {
    const type = (node.attrs.type as CalloutType) || 'note'
    return [
      'div',
      mergeAttributes(HTMLAttributes, {
        class: `nc-callout nc-callout-${type}`,
        'data-callout-type': type,
      }),
      [
        'div',
        { class: 'nc-callout-icon', contenteditable: 'false' },
      ],
      ['div', { class: 'nc-callout-content' }, 0],
    ]
  },

  addCommands() {
    return {
      setCallout:
        (attrs) =>
        ({ commands }) => {
          return commands.wrapIn(this.name, attrs)
        },
    }
  },

  /**
   * Inject SVG icons into callout icon containers after the node view is rendered.
   * ProseMirror's `renderHTML` only supports text content in leaf nodes, not raw HTML,
   * so we use a plugin to inject the SVG after DOM creation.
   */
  addNodeView() {
    return ({ node }) => {
      const type = (node.attrs.type as CalloutType) || 'note'

      const dom = document.createElement('div')
      dom.classList.add('nc-callout', `nc-callout-${type}`)
      dom.setAttribute('data-callout-type', type)

      const iconEl = document.createElement('div')
      iconEl.classList.add('nc-callout-icon')
      iconEl.contentEditable = 'false'
      iconEl.innerHTML = calloutIcons[type]

      const contentEl = document.createElement('div')
      contentEl.classList.add('nc-callout-content')

      dom.appendChild(iconEl)
      dom.appendChild(contentEl)

      return {
        dom,
        contentDOM: contentEl,
      }
    }
  },
})
