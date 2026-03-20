/**
 * Tabbed content block extension for the doc editor.
 *
 * Renders a tabbed container with switchable content panes.
 * Each tab holds arbitrary block content (paragraphs, headings, lists, etc.).
 *
 * Two ProseMirror node types:
 *   docTabs — top-level wrapper (1–10 children, starts with 3)
 *   docTab  — individual tab pane (content: block+)
 *
 * Uses a Vue NodeView for the container (docTabs) to handle interactive
 * tab switching. The child docTab nodes use CSS-only rendering.
 *
 * Active tab is local UI state (ref in NodeView), NOT a document attribute —
 * avoids undo/redo pollution and collaboration conflicts. Resets to Tab 1
 * on page reload (same behavior as Notion).
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import DocTabsNode from './DocTabsNode.vue'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    docTabs: {
      setTabs: () => ReturnType
      unsetTabs: () => ReturnType
    }
  }
}

export const DocTabsExtension = Node.create({
  name: 'docTabs',
  group: 'block',
  content: 'docTab+',
  isolating: true,

  parseHTML() {
    return [{ tag: 'div[data-doc-tabs]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'class': 'nc-doc-tabs', 'data-doc-tabs': '' }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(DocTabsNode)
  },

  addCommands() {
    return {
      setTabs:
        () =>
        ({ state, chain }) => {
          // Prevent nesting — bail if cursor is inside a docTab, docTabs, or column
          const { $from } = state.selection
          for (let d = $from.depth; d > 0; d--) {
            const name = $from.node(d).type.name
            if (name === 'docTab' || name === 'docTabs' || name === 'column') return false
          }

          return chain()
            .insertContent({
              type: 'docTabs',
              content: [
                { type: 'docTab', attrs: { title: 'Tab 1' }, content: [{ type: 'paragraph' }] },
                { type: 'docTab', attrs: { title: 'Tab 2' }, content: [{ type: 'paragraph' }] },
                { type: 'docTab', attrs: { title: 'Tab 3' }, content: [{ type: 'paragraph' }] },
              ],
            })
            .run()
        },

      unsetTabs:
        () =>
        ({ state, tr, dispatch }) => {
          const { $from } = state.selection

          let tabsPos = -1
          for (let d = $from.depth; d > 0; d--) {
            if ($from.node(d).type.name === 'docTabs') {
              tabsPos = $from.before(d)
              break
            }
          }
          if (tabsPos < 0) return false

          const tabsNode = state.doc.nodeAt(tabsPos)
          if (!tabsNode) return false

          if (dispatch) {
            const content: any[] = []
            tabsNode.forEach((tab) => {
              tab.forEach((child) => {
                content.push(child)
              })
            })
            tr.replaceWith(tabsPos, tabsPos + tabsNode.nodeSize, content)
            dispatch(tr)
          }

          return true
        },
    }
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          // Serialize each tab as ## Tab Title followed by its content
          node.forEach((tab: any) => {
            const title = tab.attrs?.title || 'Tab'
            state.write(`## ${title}\n\n`)
            state.renderContent(tab)
            state.write('\n')
          })
        },
      },
    }
  },
})

export const DocTabExtension = Node.create({
  name: 'docTab',
  content: 'block+',
  isolating: true,

  addAttributes() {
    return {
      title: {
        default: 'Tab',
        parseHTML: (el: HTMLElement) => el.getAttribute('data-tab-title') || 'Tab',
        renderHTML: (attrs: Record<string, any>) => {
          return { 'data-tab-title': attrs.title || 'Tab' }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'div[data-doc-tab]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'class': 'nc-doc-tab', 'data-doc-tab': '' }), 0]
  },

  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any) {
          state.renderContent(node)
        },
      },
    }
  },
})
