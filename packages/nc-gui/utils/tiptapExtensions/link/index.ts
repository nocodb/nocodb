import TiptapLink from '@tiptap/extension-link'
import { mergeAttributes } from '@tiptap/core'
import { Plugin, TextSelection } from 'prosemirror-state'
import type { AddMarkStep, Step } from 'prosemirror-transform'
import { TiptapMarksTypes } from 'nocodb-sdk'

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
      // Set the href to the internalUrl/Public link if it's an internal link and we're in public mode
      if (attr.internal && isPublic) {
        attr.href = attr.internalUrl
      }

      return ['a', attr, 0]
    },

    addKeyboardShortcuts() {
      return {
        'Mod-j': () => {
          const selection = this.editor.view.state.selection
          this.editor
            .chain()
            .toggleLink({
              href: '',
            })
            .setTextSelection(selection.to)
            .run()

          setTimeout(() => {
            const linkInput = document.querySelector('.docs-link-option-input')
            if (linkInput) {
              ;(linkInput as any).focus()
            }
          }, 100)
        },
        'Space': () => {
          // If we press space twice we stop the link mark and have normal text
          const editor = this.editor
          const selection = editor.view.state.selection
          const nodeBefore = selection.$to.nodeBefore
          const nodeAfter = selection.$to.nodeAfter

          if (!nodeBefore) return false

          const nodeBeforeText = nodeBefore.text!

          // If we are not inside a link, we don't do anything
          if (
            !nodeBefore?.marks.some((mark) => mark.type.name === TiptapMarksTypes.link) ||
            nodeAfter?.marks.some((mark) => mark.type.name === TiptapMarksTypes.link)
          ) {
            return false
          }

          // Last text character should be a space
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
          //
          // Put cursor at the end of the link when we add a link
          //
          appendTransaction: (transactions, _, newState) => {
            if (transactions.length !== 1) return null
            const steps = transactions[0].steps
            if (steps.length !== 1) return null

            const step: Step = steps[0] as Step
            const stepJson = step.toJSON()
            // Ignore we are not adding a mark(i.e link, bold, etc)
            if (stepJson.stepType !== 'addMark') return null

            const addMarkStep: AddMarkStep = step as AddMarkStep
            if (!addMarkStep) return null

            if (addMarkStep.from === addMarkStep.to) return null

            if (addMarkStep.mark.type.name !== TiptapMarksTypes.link) return null

            const { tr } = newState
            return tr.setSelection(new TextSelection(tr.doc.resolve(addMarkStep.to)))
          },
        }),
      ]
    },
  }).configure({
    openOnClick: false,
  })
