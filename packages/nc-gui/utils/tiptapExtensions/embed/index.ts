import { Node, mergeAttributes } from '@tiptap/core'
import { Plugin } from 'prosemirror-state'
import { getPositionOfPreviousSection, isCursorAtStartOfSelectedNode } from '../helper'
import { getEmbedContentType, urlToEmbedUrl } from './urlHelper'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    embed: {
      /**
       * Toggle a heading node
       */
      setEmbed: (options: { url: string; type: string }) => ReturnType
    }
  }
}

export const Embed = Node.create({
  name: 'embed',

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
        default: 'embed',
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
      setEmbed:
        (options: { url: string; type: string }) =>
        ({ commands, state }) => {
          const selection = state.selection

          const embedUrl = urlToEmbedUrl(options.url, options.type)
          const node = state.schema.nodes.embed.create({ src: embedUrl, type: options.type })

          return commands.insertContentAt(selection.from - 1, node.toJSON())
        },
    }
  },

  addProseMirrorPlugins() {
    return [
      new Plugin({
        props: {
          handlePaste: (_, event) => {
            const url = event.clipboardData?.getData('text/plain')
            if (!url) return false

            const type = getEmbedContentType(url)
            if (!type) return false

            const selection = this.editor.state.selection
            const currentNode = selection.$from.node()
            const parentNode = selection.$from.node(-1)

            // Verify that the cursor is on an empty paragraph as direct child to section node
            if (!currentNode || !parentNode) return false
            if (
              currentNode.type.name !== 'paragraph' ||
              parentNode.type.name !== 'sec' ||
              currentNode.textContent.length > 0 ||
              parentNode.childCount > 1
            ) {
              return false
            }

            return this.editor.chain().focus().setEmbed({ url, type }).run()
          },
        },
      }),
    ]
  },
  addKeyboardShortcuts() {
    return {
      Backspace: () => {
        const editor = this.editor
        const state = editor.state

        const prevSectionPos = getPositionOfPreviousSection(state)
        if (!prevSectionPos) return false

        if (
          !isNodeTypeSelected({ state, nodeType: 'embed', sectionPos: prevSectionPos }) ||
          !isCursorAtStartOfSelectedNode(state)
        ) {
          return false
        }

        return editor.chain().focus().deleteActiveSection().selectPrevSection().run()
      },
    }
  },
})
