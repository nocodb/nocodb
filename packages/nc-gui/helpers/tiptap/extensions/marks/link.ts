import TiptapLink, { type LinkOptions } from '@tiptap/extension-link'
import { mergeAttributes } from '@tiptap/core'
import { Plugin, TextSelection } from '@tiptap/pm/state'
import type { AddMarkStep, Step } from '@tiptap/pm/transform'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'

export const Link = TiptapLink.extend<LinkOptions>({
  addOptions() {
    return {
      ...this.parent?.(),
      openOnClick: true,
      linkOnPaste: true,
      autolink: true,
      protocols: [],
      HTMLAttributes: {
        target: '_blank',
        rel: 'noopener noreferrer nofollow',
        class: null,
      },
      validate: (_url) => true,
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
    }
  },

  renderHTML({ HTMLAttributes }) {
    const attr = mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)

    // We use this as a workaround to show a tooltip on the content
    // We use the href to store the tooltip content
    if (isValidURL(attr.href) || !attr.href.includes('~~~###~~~')) {
      return ['a', attr, 0]
    }

    // The class is used to identify the text that needs to show the tooltip
    // The data-tooltip is the content of the tooltip
    attr.class = 'nc-rich-link-tooltip'
    attr['data-tooltip'] = attr.href?.split('~~~###~~~')[1]?.replace(/_/g, ' ')
    return ['span', attr]
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
          const linkInput = document.querySelector('.nc-text-area-rich-link-option-input')
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
          !nodeBefore?.marks.some((mark) => mark.type.name === 'link') ||
          nodeAfter?.marks.some((mark) => mark.type.name === 'link')
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
          try {
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

            if (addMarkStep.mark.type.name !== 'link') return null

            const { tr } = newState
            return tr.setSelection(new TextSelection(tr.doc.resolve(addMarkStep.to)))
          } catch (e) {
            console.error(e)
            return null
          }
        },
      }),
    ]
  },

  addStorage() {
    return {
      markdown: {
        serialize: defaultMarkdownSerializer.marks.link,
        parse: {
          // handled by markdown-it
        },
      },
    }
  },
}).configure({
  openOnClick: false,
})
