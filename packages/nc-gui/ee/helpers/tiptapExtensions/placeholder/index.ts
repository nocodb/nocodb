import { Plugin } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node } from '@tiptap/pm/model'
import type { Editor } from '@tiptap/core'
import { Extension } from '@tiptap/core'
import type { TiptapNodesTypes } from 'nocodb-sdk'
import { nodeTypesContainingSection } from '../helper'

// Ref: https://github.com/sereneinserenade/notitap/blob/main/src/tiptap/extensions/starter-kit.ts

export interface PlaceholderOptions {
  emptyEditorClass: string
  emptyNodeClass: string
  placeholder: ((PlaceholderProps: { editor: Editor; node: Node; pos: number; hasAnchor: boolean }) => string) | string
  showOnlyWhenEditable: boolean
  showOnlyCurrent: boolean
  includeChildren: boolean
}

// Add place holder to top level empty nodes except for collapsable nodes
export const Placeholder = Extension.create<PlaceholderOptions>({
  name: 'placeholder',

  addOptions() {
    return {
      emptyEditorClass: 'is-editor-empty',
      emptyNodeClass: 'is-empty',
      placeholder: 'Write something …',
      showOnlyWhenEditable: true,
      showOnlyCurrent: true,
      includeChildren: false,
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          decorations: ({ doc, selection }) => {
            const active = this.editor.isEditable || !this.options.showOnlyWhenEditable

            const { anchor } = selection
            const decorations: Decoration[] = []

            if (!active) {
              return null
            }

            doc.descendants((wrapperNode, wrapperPos) => {
              const node = wrapperNode.firstChild!
              const pos = wrapperPos + 1

              const hasAnchor = anchor >= pos && anchor <= pos + node.nodeSize
              const isEmpty = !node.isLeaf && node.textContent.length === 0

              if ((hasAnchor || !this.options.showOnlyCurrent) && isEmpty) {
                const classes = [this.options.emptyNodeClass]

                const decoration = Decoration.node(pos, pos + node.nodeSize, {
                  'class': classes.join(' '),
                  'data-placeholder':
                    typeof this.options.placeholder === 'function'
                      ? this.options.placeholder({
                          editor: this.editor,
                          node,
                          pos,
                          hasAnchor,
                        })
                      : this.options.placeholder,
                })

                decorations.push(decoration)
              }

              return nodeTypesContainingSection.includes(node.type.name as TiptapNodesTypes)
            })

            return DecorationSet.create(doc, decorations)
          },
        },
      }),
    ]
  },
})
