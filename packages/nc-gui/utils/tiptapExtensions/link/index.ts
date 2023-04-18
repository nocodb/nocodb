import TiptapLink from '@tiptap/extension-link'
import { mergeAttributes } from '@tiptap/core'
import { Plugin, TextSelection } from 'prosemirror-state'
import type { AddMarkStep, Step } from 'prosemirror-transform'

export const Link = ({ isPublic }: { isPublic?: boolean }) =>
  TiptapLink.extend({
    addOptions() {
      return {
        openOnClick: true,
        linkOnPaste: true,
        autolink: true,
        protocols: [],
        HTMLAttributes: {
          target: '_blank',
          rel: 'noopener noreferrer nofollow',
          class: null,
        },
        validate: undefined,
        internal: false,
      }
    },
    addAttributes() {
      return {
        href: {
          default: null,
        },
        target: {
          default: this.options.HTMLAttributes.target,
        },
        class: {
          default: this.options.HTMLAttributes.class,
        },
        internal: {
          default: this.options.HTMLAttributes.internal,
          parseHTML: (element) => element.getAttribute('internal') === 'true',
        },
        internalUrl: {
          default: null,
          parseHTML: (element) => element.getAttribute('internal-url'),
        },
      }
    },

    renderHTML({ HTMLAttributes }) {
      const attr = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)
      if (attr.internal && isPublic) {
        attr.href = attr.internalUrl
      }

      return ['a', attr, 0]
    },

    addKeyboardShortcuts() {
      return {
        'Mod-j': () => {
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
          appendTransaction: (transactions, _, newState) => {
            if (transactions.length !== 1) return null
            const steps = transactions[0].steps
            if (steps.length !== 1) return null

            const step: Step = steps[0] as Step
            const stepJson = step.toJSON()
            if (stepJson.stepType !== 'addMark') return null

            const addMarkStep: AddMarkStep = step as AddMarkStep
            if (!addMarkStep) return null

            if (addMarkStep.from === addMarkStep.to) return null

            if (addMarkStep.mark.type.name !== 'link') return null

            const { tr } = newState
            return tr.setSelection(new TextSelection(tr.doc.resolve(addMarkStep.to)))
          },
          props: {
            // handleClick(view, pos, event) {
            //   const attrs = getAttributes(view.state, 'link')
            //   if (view.editable && !event.metaKey) {
            //     return false
            //   }
            //   const link = (event.target as HTMLElement)?.closest('a')
            //   if (isPublic) {
            //     attrs.href = attrs.href.replace('/nc/doc/p', '/nc/doc/s')
            //   }
            //   if (link && attrs.href) {
            //     window.open(attrs.href, attrs.target)
            //     return true
            //   }
            //   return false
            // },
          },
        }),
      ]
    },
  }).configure({
    openOnClick: false,
  })
