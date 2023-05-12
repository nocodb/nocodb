import { Mark, mergeAttributes } from '@tiptap/core'

export const HistoryDeletion = Mark.create({
  name: 'historyDeletion',

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
        tag: 'del',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return ['del', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes), 0]
  },
})
