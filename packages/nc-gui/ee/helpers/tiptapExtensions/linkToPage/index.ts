import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { Plugin } from 'prosemirror-state'
import { getPositionOfSection, nodeTypesContainingSection } from '../helper'
import LinkToPageComponent from './link-to-page.vue'

export const LinkToPage = Node.create({
  name: TiptapNodesTypes.linkToPage,

  addAttributes() {
    return {
      pageId: {
        default: null,
        parseHTML: (element) => {
          return element.getAttribute('data-page-id')
        },
      },
    }
  },

  addOptions() {
    return {
      HTMLAttributes: {
        class: 'link-to-page items-baseline',
      },
    }
  },

  group: 'block',

  parseHTML() {
    return [{ tag: 'div[data-type="link-to-page"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'link-to-page', 'data-page-id': node.attrs.pageId })]
  },

  addNodeView() {
    return VueNodeViewRenderer(LinkToPageComponent)
  },

  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const state = this.editor.state
        if (!state.selection.empty) return false

        const prevSectionPos = getPositionOfPreviousSection(state)
        if (!prevSectionPos) return false

        const prevSection = state.doc.nodeAt(prevSectionPos)
        if (prevSection?.firstChild?.type.name !== TiptapNodesTypes.linkToPage) {
          return false
        }

        const currentNode = state.selection.$from.node()

        // If cursor is not at the beginning of the node, and the node is not empty, do nothing
        if (state.selection.from !== state.selection.$from.start() && currentNode.textContent.length !== 0) {
          return false
        }

        // If the current node is empty, delete the current node and select the previous section
        if (state.selection.from === state.selection.$from.start() && currentNode.textContent.length === 0) {
          this.editor.chain().deleteActiveSection().run()
        }
        // If cursor is at the beginning of the node, select the previous section
        return this.editor.chain().selectPrevSection().selectPrevSection().selectNextSection().run()
      },
      Enter: () => {
        // If the selected node is link-to-page, open the page on enter
        const state = this.editor.state
        const currentSectionPos = getPositionOfSection(state)
        const currentNode = state.selection.$from.node()
        const linkToPageNode = currentNode.firstChild
        if (linkToPageNode?.type.name !== TiptapNodesTypes.linkToPage) {
          return false
        }

        const linkDom = document.querySelector(
          `.ProseMirror [pos='${currentSectionPos}'] .link-to-page-wrapper a`,
        ) as HTMLAnchorElement

        if (!linkDom || !linkDom.click) return false

        linkDom.click()
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        // Remove empty link-to-page node in page except the one in the selection
        appendTransaction: (_, __, state) => {
          try {
            const emptyPageLinkNodePositions: number[] = []
            state.doc.descendants((node, pos) => {
              if (node.type.name === TiptapNodesTypes.linkToPage && !node.attrs.pageId && pos !== state.selection.from) {
                emptyPageLinkNodePositions.push(pos)
              }

              if (nodeTypesContainingSection.includes(node.type.name as TiptapNodesTypes)) {
                return true
              }

              return false
            })

            const tr = state.tr
            emptyPageLinkNodePositions.forEach((pos) => {
              tr.delete(pos, pos + 1)
            })

            return emptyPageLinkNodePositions.length === 0 ? null : tr
          } catch (e) {
            console.error(e)
            return null
          }
        },
      }),
    ]
  },
})
