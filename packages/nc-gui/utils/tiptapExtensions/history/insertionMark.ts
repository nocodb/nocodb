import { Mark, mergeAttributes } from '@tiptap/core'

export const HistoryInsertion = Mark.create({
  name: 'historyInsertion',

  priority: 2000,

  addAttributes() {
    return {
      isEmpty: {
        default: false,
        parseHTML: (element) => {
          return element.classList.contains('empty')
        },
      },
    }
  },

  addOptions() {
    return {
      HTMLAttributes: {
        'data-is-diff': 'true',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'ins',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['ins', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
})
