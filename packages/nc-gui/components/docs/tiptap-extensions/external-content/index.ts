import { Node, mergeAttributes } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    externalContent: {
      /**
       * Toggle a heading node
       */
      setExternalContent: (options: { url: string }) => ReturnType
    }
  }
}

export const ExternalContent = Node.create({
  name: 'externalContent',

  defaultOptions: {
    inline: false,
    HTMLAttributes: {},
  },

  inline() {
    return this.options.inline
  },

  group() {
    return this.options.inline ? 'inline' : 'block'
  },

  draggable: true,

  addAttributes() {
    return {
      src: {
        default: null,
      },
      title: {
        default: null,
      },
      frameborder: {
        default: '0',
      },
      width: {
        default: '100%',
      },
      height: {
        default: '100%',
      },
      allow: {
        default: 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture',
      },
      allowfullscreen: {
        default: 'allowfullscreen',
      },
    }
  },

  parseHTML() {
    return [
      {
        tag: 'iframe[src]',
      },
    ]
  },

  renderHTML({ HTMLAttributes }) {
    return [
      'div',
      { class: 'external-content-wrapper', style: 'height: 26rem;' },
      ['iframe', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)],
    ]
  },
  addCommands() {
    return {
      setExternalContent: (options: { url: string }) => (editor: Editor) => {
        const selectionRange = editor.state.selection
        const suggestionNodeParentNodeSize = editor.state.doc.resolve(selectionRange.$from.pos - 1).parent.firstChild!.nodeSize!

        editor.commands.deleteRange({
          from: selectionRange.$from.pos - suggestionNodeParentNodeSize,
          to: selectionRange.$from.pos,
        })

        const node = editor.state.schema.nodes.externalContent.create({ src: options.url })
        const tr = editor.state.tr.insert(editor.state.selection.$from.pos - 1, node)
        editor.view.dispatch(tr)
      },
    }
  },
})
