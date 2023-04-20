import { Node } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { isNodeTypeSelected, positionOfFirstChild } from '../helper'
import { getPositionOfPreviousSection, getPositionOfSection, isSectionEmptyParagraph } from '../section/helpers'
import type { UploadFn } from './proseExtension'
import { addFile, dropAttachmentPlugin } from './proseExtension'
import AttachmentComponent from './attachment.vue'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachment: {
      setAttachment: (files: FileList) => ReturnType
    }
  }
}

export const createAttachmentExtension = (uploadFn: UploadFn) => {
  return Node.create({
    name: 'attachment',
    group: 'block',
    addAttributes: () => ({
      url: {},
      isUploading: { default: false },
      class: { default: '' },
      name: { default: '' },
      id: { default: null },
      size: { default: null },
    }),
    renderHTML: ({ HTMLAttributes }) => [
      'div',
      {
        ...HTMLAttributes,
        class: HTMLAttributes.class
          ? `attachment-wrapper cursor-pointer ${HTMLAttributes.class}`
          : 'attachment-wrapper cursor-pointer',
      },
    ],

    addNodeView() {
      return VueNodeViewRenderer(AttachmentComponent)
    },

    addCommands() {
      return {
        setAttachment: (files: FileList) => () => {
          const view = this.editor.view

          // Need small delay, otherwise prose mirror will throw an error, regarding transaction mismatch
          setTimeout(async () => {
            const currentSectionPos = getPositionOfSection(view.state)

            await Promise.all(
              Array.from(files).map(async (file) => {
                await addFile({ file, view, uploadFn, toBeInsertedPos: currentSectionPos })
              }),
            )
          })

          return true
        },
      } as any
    },
    addKeyboardShortcuts() {
      return {
        Enter: () => {
          // Set cursor to the next line
          const state = this.editor.state

          const isImage = isNodeTypeSelected({ nodeType: 'attachment', state })
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
              nodeType: 'attachment',
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
      return [dropAttachmentPlugin(uploadFn)]
    },
  })
}
