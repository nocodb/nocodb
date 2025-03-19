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

    if (isValidURL(attr.href)) {
      return [
        'a',
        {
          ...attr,
          onclick: '(function(event) { window.tiptapLinkHandler?.(event);})(event)', // Global handler
        },
        0,
      ]
    }

    // We use this as a workaround to show a tooltip on the content
    // We use the href to store the tooltip content
    if (!attr.href.includes('~~~###~~~')) {
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
        const { state, dispatch } = this.editor.view
        const { selection } = state
        const { $to } = selection
        const nodeBefore = $to.nodeBefore
        const nodeAfter = $to.nodeAfter // Get the next node after the cursor

        const linkMarkType = state.schema.marks.link
        if (!linkMarkType || !nodeBefore) return false

        // Check if the cursor is inside a link
        const linkMark = linkMarkType.isInSet(nodeBefore.marks)
        if (!linkMark) return false

        // Ensure space is typed at the very end of the link
        const isAtEndOfLink = !nodeAfter || !linkMarkType.isInSet(nodeAfter.marks)
        if (!isAtEndOfLink) return false

        // ✅ Insert space first, then remove link mark
        dispatch(state.tr.insertText(' ', $to.pos).removeMark($to.pos, $to.pos + 1, linkMarkType))

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
      // ✅ Remove link when typing after it
      new Plugin({
        appendTransaction: (transactions, oldState, newState) => {
          try {
            if (transactions.length !== 1) return null
            const steps = transactions[0].steps
            if (steps.length !== 1) return null

            const step: Step = steps[0] as Step
            const stepJson = step.toJSON()

            // If this is not inserting a new character, ignore
            if (stepJson.stepType !== 'replace' || !stepJson.slice) return null

            const { selection } = oldState
            const { $from, $to } = selection
            const nodeBefore = $to.nodeBefore
            const nodeAfter = $to.nodeAfter

            const linkMarkType = newState.schema.marks.link
            if (!linkMarkType) return null
            const tr = newState.tr

            // ✅ Case 1: Typing at the END of a link
            if (nodeBefore) {
              const linkMark = linkMarkType.isInSet(nodeBefore.marks)
              if (linkMark) {
                const isAtEndOfLink = !nodeAfter || !linkMarkType.isInSet(nodeAfter.marks)
                if (isAtEndOfLink) {
                  return tr.removeMark($to.pos, $to.pos + 1, linkMarkType)
                }
              }
            }

            // ✅ Case 2: Typing at the START of a link
            if ($from.pos === 0 || (!$from.nodeBefore && nodeAfter && linkMarkType.isInSet(nodeAfter.marks))) {
              return tr.removeMark($from.pos, $from.pos + 1, linkMarkType)
            }

            return null
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
