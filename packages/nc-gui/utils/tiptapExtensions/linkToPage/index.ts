import { Node, mergeAttributes } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { Plugin } from 'prosemirror-state'
import { nodeTypesContainingSection } from '../helper'
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
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': 'link-to-page', 'data-page-id': node.attrs.pageId }), 0]
  },

  addNodeView() {
    return VueNodeViewRenderer(LinkToPageComponent)
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        // Remove empty link-to-page node in page except the one in the selection
        appendTransaction: (_, __, state) => {
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
        },
      }),
    ]
  },
})
