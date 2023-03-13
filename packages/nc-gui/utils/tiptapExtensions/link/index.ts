import TiptapLink from '@tiptap/extension-link'
import { getAttributes } from '@tiptap/core'
import { Plugin } from 'prosemirror-state'

export const Link = ({ isPublic }: { isPublic?: boolean }) =>
  TiptapLink.extend({
    addKeyboardShortcuts() {
      return {
        'Mod-k': () => {
          const to = this.editor.view.state.selection.to
          this.editor
            .chain()
            .toggleLink({
              href: '',
            })
            .setTextSelection(to)
            .run()

          setTimeout(() => {
            const linkInput = document.querySelector('.docs-link-option-input')
            if (linkInput) {
              ;(linkInput as any).focus()
            }
          }, 100)
        },
        'Space': () => {
          const editor = this.editor
          const selection = editor.view.state.selection
          const nodeBefore = selection.$to.nodeBefore
          const nodeAfter = selection.$to.nodeAfter

          if (!nodeBefore) {
            return false
          }

          const nodeBeforeText = nodeBefore.text!

          if (
            !nodeBefore?.marks.some((mark) => mark.type.name === 'link') ||
            nodeAfter?.marks.some((mark) => mark.type.name === 'link')
          ) {
            return false
          }

          if (nodeBeforeText[nodeBeforeText.length - 1] !== ' ') {
            return false
          }

          editor.view.dispatch(
            editor.view.state.tr.removeMark(selection.$to.pos - 1, selection.$to.pos, editor.view.state.schema.marks.link),
          )

          return true
        },
      } as any
    },
    addProseMirrorPlugins() {
      return [
        // To have proseMirror plugins from the parent extension
        ...(this.parent?.() ?? []),
        new Plugin({
          props: {
            handleClick(view, pos, event) {
              const attrs = getAttributes(view.state, 'link')

              if (view.editable && !event.metaKey) {
                return false
              }

              const link = (event.target as HTMLElement)?.closest('a')

              if (isPublic) {
                attrs.href = attrs.href.replace('/nc/doc/p', '/nc/doc/s')
              }

              if (link && attrs.href) {
                window.open(attrs.href, attrs.target)

                return true
              }

              return false
            },
          },
        }),
      ]
    },
  }).configure({
    openOnClick: false,
  })
