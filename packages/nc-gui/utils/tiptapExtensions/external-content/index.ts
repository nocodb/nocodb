import { Node, mergeAttributes } from '@tiptap/core'
import type { Editor } from '@tiptap/vue-3'
import { Plugin, TextSelection } from 'prosemirror-state'
import { getExternalContentType, urlToEmbedUrl } from './urlHelper'
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    externalContent: {
      /**
       * Toggle a heading node
       */
      setExternalContent: (options: { url: string; type: string }) => ReturnType
    }
  }
}

export const ExternalContent = Node.create({
  name: 'externalContent',

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
      type: {
        default: 'externalContent',
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

  renderHTML({ HTMLAttributes, node }) {
    let style = 'height: 28rem;'
    switch (node.attrs.type) {
      case 'githubGist':
        style = 'height: 16rem;'
        break
      case 'trello':
        style = 'height: 185px; width: 248px;'
        break
    }
    return [
      'div',
      {
        class: 'external-content-wrapper border-1 border-gray-200 rounded-sm ',
        style,
      },
      ['iframe', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes)],
    ]
  },
  addCommands() {
    return {
      setExternalContent: (options: { url: string; type: string }) => (editor: Editor) => {
        _setExternalContent({ editor, options: { ...options, deletePrevNode: true } })
      },
    } as any
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (_, event) => {
            const url = event.clipboardData?.getData('text/plain')
            if (!url) return false

            const type = getExternalContentType(url)
            if (!type) return false

            const selection = this.editor.state.selection
            const currentNode = selection.$from.node()
            const parentNode = selection.$from.node(-1)

            if (!currentNode || !parentNode) return false
            if (
              currentNode.type.name !== 'paragraph' ||
              parentNode.type.name !== 'sec' ||
              currentNode.textContent.length > 0 ||
              parentNode.childCount > 1
            ) {
              return false
            }

            _setExternalContent({ editor: this.editor as any, options: { url, type } })
            return true
          },
        },
      }),
    ]
  },
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        try {
          const editor = this.editor
          const selection = editor.view.state.selection
          const node = selection.$from.node()
          const parentNode = selection.$from.node(-1)

          if (!(node.type.name === 'paragraph' && parentNode.type.name === 'sec')) {
            return false
          }

          const prevNodePos = selection.$from.pos - (parentNode.nodeSize - node.nodeSize + 2)
          if (prevNodePos < 0) return false
          const prevNode = editor.view.state.doc.nodeAt(prevNodePos)

          if (prevNode?.type.name === 'externalContent') {
            editor.chain().setNodeSelection(prevNodePos).run()
            return true
          }

          return false
        } catch (error) {
          console.log('error', error)
          return false
        }
      },
    }
  },
})

function _setExternalContent({
  editor,
  options,
}: {
  editor: Editor
  options: {
    url: string
    type: string
    // Delete the prev node, required in the case where if we create a node and an empty node is created before it
    deletePrevNode?: boolean
  }
}) {
  const selectionRange = editor.state.selection
  const suggestionNodeParentNodeSize = editor.state.doc.resolve(selectionRange.$from.pos - 1).parent.firstChild!.nodeSize!

  editor.commands.deleteRange({
    from: options.deletePrevNode
      ? selectionRange.$from.pos - suggestionNodeParentNodeSize
      : selectionRange.$from.pos - suggestionNodeParentNodeSize + 2,
    to: selectionRange.$from.pos,
  })

  const embedUrl = urlToEmbedUrl(options.url, options.type)

  const node = editor.state.schema.nodes.externalContent.create({ src: embedUrl, type: options.type })
  const tr = editor.state.tr.insert(editor.state.selection.$from.pos - 1, node)
  editor.view.dispatch(tr)
}
