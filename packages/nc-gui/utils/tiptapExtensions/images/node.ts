import { Node, nodeInputRule } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { TiptapNodesTypes } from 'nocodb-sdk'
import {
  getPositionOfPreviousSection,
  getPositionOfSection,
  isNodeTypeSelected,
  isSectionEmptyParagraph,
  positionOfFirstChild,
} from '../helper'
import type { UploadFn } from './proseExtension'
import { addImage, dropImagePlugin } from './proseExtension'
import ImageComponent from './image.vue'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    image: {
      setImage: (files: FileList) => ReturnType
    }
  }
}

/**
 * Matches following attributes in Markdown-typed image: [, alt, src, title]
 *
 * Example:
 * ![Lorem](image.jpg) -> [, "Lorem", "image.jpg"]
 * ![](image.jpg "Ipsum") -> [, "", "image.jpg", "Ipsum"]
 * ![Lorem](image.jpg "Ipsum") -> [, "Lorem", "image.jpg", "Ipsum"]
 */
const IMAGE_INPUT_REGEX = /!\[(.+|:?)\]\((\S+)(?:(?:\s+)["'](\S+)["'])?\)/

export const createImageExtension = (uploadFn: UploadFn) => {
  return Node.create({
    name: TiptapNodesTypes.image,
    group: 'block',
    draggable: true,
    addAttributes: () => ({
      src: {},
      isUploading: { default: false },
      alt: { default: null },
      title: { default: null },
      class: { default: '' },
      id: { default: null },
      width: {
        default: 450,
        parseHTML: (element) => {
          const width = element.getAttribute('width')
          return width ? parseInt(width, 10) : undefined
        },
      },
      height: {
        default: 400,
        parseHTML: (element) => {
          const height = element.getAttribute('height')
          return height ? parseInt(height, 10) : undefined
        },
      },
      isInsertedHistory: {
        default: false,
        parseHTML: (element) => {
          return element.getAttribute('data-diff-node') === 'ins'
        },
      },
      isDeletedHistory: {
        default: false,
        parseHTML: (element) => {
          return element.getAttribute('data-diff-node') === 'del'
        },
      },
    }),
    parseHTML: () => [
      {
        tag: 'img',
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {}
          const element = dom as HTMLImageElement

          return {
            src: element.getAttribute('src'),
            title: element.getAttribute('title'),
            alt: element.getAttribute('alt'),
            class: element.getAttribute('class'),
          }
        },
      },
      {
        tag: `div[data-type="${TiptapNodesTypes.image}"]`,
        getAttrs: (dom) => {
          if (typeof dom === 'string') return {}
          const element = dom as HTMLImageElement

          return {
            src: element.getAttribute('data-src'),
            title: element.getAttribute('data-title'),
            alt: element.getAttribute('data-alt'),
          }
        },
      },
    ],
    renderHTML: ({ node, HTMLAttributes }) => [
      'div',
      {
        ...HTMLAttributes,
        'data-type': TiptapNodesTypes.image,
        'data-src': node.attrs.src,
        'data-title': node.attrs.title,
        'data-alt': node.attrs.alt,
        'data-diff-node': node.attrs.isInsertedHistory ? 'ins' : node.attrs.isDeletedHistory ? 'del' : null,
        'class': HTMLAttributes.class ? `image-wrapper cursor-pointer ${HTMLAttributes.class}` : 'image-wrapper cursor-pointer',
      },
    ],

    addNodeView() {
      return VueNodeViewRenderer(ImageComponent)
    },

    addCommands() {
      return {
        setImage: (files) => () => {
          const view = this.editor.view

          // Need small delay, otherwise prose mirror will throw an error, regarding transaction mismatch
          setTimeout(async () => {
            const currentSectionPos = getPositionOfSection(view.state)
            await Promise.all(
              Array.from(files).map(async (file) => {
                await addImage({ file, view, uploadFn, toBeInsertedPos: currentSectionPos })
              }),
            )
          })

          return true
        },
      }
    },
    addInputRules() {
      return [
        nodeInputRule({
          find: IMAGE_INPUT_REGEX,
          type: this.type,
          getAttributes: (match) => {
            const [, alt, src, title] = match
            return {
              src,
              alt,
              title,
            }
          },
        }),
      ]
    },
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          // Set cursor to the next line
          const state = this.editor.state

          const isImage = isNodeTypeSelected({ nodeType: TiptapNodesTypes.image, state })
          if (!isImage) return

          this.editor.chain().focus().selectNextSection().run()
        },
        Backspace: () => {
          const editor = this.editor
          const state = editor.view.state

          const prevSectionPos = getPositionOfPreviousSection(state)
          if (!prevSectionPos) return

          if (
            !isNodeTypeSelected({
              nodeType: TiptapNodesTypes.image,
              state,
              sectionPos: prevSectionPos,
            })
          ) {
            return false
          }

          const currentSectionPos = getPositionOfSection(state)

          if (!isSectionEmptyParagraph(state, currentSectionPos)) {
            return false
          }

          const firstChildOfPrevSection = positionOfFirstChild(state, prevSectionPos)
          if (!firstChildOfPrevSection) return false

          return editor.chain().deleteActiveSection().setTextSelection(prevSectionPos).run()
        },
      } as any
    },
    addProseMirrorPlugins() {
      return [dropImagePlugin(uploadFn)]
    },
  })
}
