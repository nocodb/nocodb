import { Node } from '@tiptap/core'
import { TiptapNodesTypes } from 'nocodb-sdk'
import { NodeSelection, Plugin, TextSelection } from 'prosemirror-state'
import { AISelection } from '../AISelection'

export const Document = Node.create({
  name: TiptapNodesTypes.doc,

  topNode: true,

  content: 'sec+',

  addKeyboardShortcuts() {
    return {
      // Open AI options when user presses space if there is an active selection
      Space: () => {
        const editor = this.editor
        const selection = editor.state.selection
        if (selection.empty) return false

        const fromSecPos = getPositionOfSection(editor.state, selection.from)
        const toSecPos = getPositionOfSection(editor.state, selection.to, 'end')

        const tr = editor.state.tr
        tr.setSelection(AISelection.create(editor.state.doc, fromSecPos, toSecPos))
        editor.view.dispatch(tr)

        return true
      },
      Tab: () => {
        let nextPos = this.editor.state.selection.$from.pos

        const currentNode = this.editor.state.selection.$from.node()

        if (currentNode.type.name === TiptapNodesTypes.paragraph) {
          const offset = this.editor.state.selection.$from.parentOffset ?? 0
          const currentCharacter = currentNode.textContent?.[offset]

          const pos = this.editor.state.selection.$from.pos
          const text = this.editor.state.doc.nodeAt(nextPos)?.text ?? ''

          if (currentCharacter === ' ') {
            for (let i = offset; i < text.length; i++) {
              const character = text[i]
              // Index for non alphanumeric characters
              nextPos = pos + i - offset
              if (character !== ' ') {
                break
              }

              if (i === text.length - 1) {
                nextPos = pos + i - offset + 1
              }
            }
          } else {
            if (text.length === 1) {
              nextPos = pos + 1
            } else {
              for (let i = offset; i < text.length; i++) {
                const character = text[i]
                // Index for non alphanumeric characters
                nextPos = pos + i - offset
                if (/[^A-Za-z0-9_@./#&+-]/.test(character)) {
                  break
                }

                if (i === text.length - 1) {
                  nextPos = pos + i - offset + 1
                }
              }
            }
          }
        }

        const from = this.editor.state.selection.$from.pos

        if (from === nextPos) {
          const { doc } = this.editor.state

          doc.descendants((node, pos) => {
            if (pos <= nextPos) return

            if (
              (node.type.name === TiptapNodesTypes.paragraph || node.type.name === TiptapNodesTypes.image) &&
              from === nextPos
            ) {
              nextPos = pos + 1

              return false
            }

            return true
          })
        }

        this.editor.chain().focus().setTextSelection(nextPos).run()

        return true
      },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        appendTransaction(_, __, newState) {
          try {
            const { selection } = newState

            if (!selection.empty) return null

            // If selection is type of TextSelection but the node is not text node
            // then select the nearest text node or select the node itself(NodeSelection)
            if (selection instanceof TextSelection && !selection.$from.node().isTextblock) {
              const nextSectionPos = getPositionOfNextSection(newState)
              if (!nextSectionPos) return null

              let childTextNodePos = -1
              newState.doc.nodesBetween(selection.$from.pos, nextSectionPos, (node, pos) => {
                if (node.isTextblock && childTextNodePos === -1) {
                  childTextNodePos = pos
                  return false
                }

                return true
              })

              if (childTextNodePos !== -1) return newState.tr.setSelection(TextSelection.create(newState.doc, childTextNodePos))

              const nextNodeSelection = selection.$from.pos
              const nextNode = newState.doc.nodeAt(nextNodeSelection)
              if (!nextNode) return null

              return newState.tr.setSelection(NodeSelection.create(newState.doc, selection.from))
            }

            return null
          } catch (error) {
            console.error(error)
            return null
          }
        },
      }),
      new Plugin({
        // This plugin is used to auto scroll when cursor is at the bottom of the editor
        appendTransaction(_, __, newState) {
          try {
            const currentSectionPos = getPositionOfSection(newState)
            const prevSecPos = getPositionOfPreviousSection(newState)
            const domOfCurrentSection =
              document.querySelector(`.ProseMirror .draggable-block-wrapper[pos="${currentSectionPos}"]`) ||
              (prevSecPos ? document.querySelector(`.ProseMirror .draggable-block-wrapper[pos="${prevSecPos}"]`) : null)
            if (!domOfCurrentSection) return null

            const pageContentDom = document.querySelector('.nc-docs-page')
            if (!pageContentDom) return null

            // If dom is at the bottom of the editor, then scroll to the bottom
            const viewportHeight = Math.max(document.documentElement.clientHeight || 0, window.innerHeight || 0)
            const domOfCurrentSectionRect = domOfCurrentSection.getBoundingClientRect()
            const rem = parseFloat(getComputedStyle(document.documentElement).fontSize)

            if (domOfCurrentSectionRect.top + rem * 2 >= viewportHeight * 0.8) {
              pageContentDom.scrollBy(0, 2.5 * rem)
            }

            return null
          } catch (error) {
            console.error(error)
            return null
          }
        },
      }),
    ]
  },
})
