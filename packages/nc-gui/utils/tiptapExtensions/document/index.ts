import { Node } from '@tiptap/core'

export const Document = Node.create({
  name: 'doc',

  topNode: true,

  // content: "draggableBlock{1,}", // accepts one or more draggable block as content
  content: 'dBlock+',

  addKeyboardShortcuts() {
    return {
      Tab: () => {
        let nextPos = this.editor.state.selection.$from.pos

        const currentNode = this.editor.state.selection.$from.node()

        if (currentNode.type.name === 'paragraph') {
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

            if ((node.type.name === 'paragraph' || node.type.name === 'image') && from === nextPos) {
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
})
