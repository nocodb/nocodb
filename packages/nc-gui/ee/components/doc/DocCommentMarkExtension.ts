/**
 * Inline Comment mark — anchors a comment to a specific text range in the document.
 * Renders <span class="nc-doc-comment-mark" data-comment-id="…"> around selected text.
 *
 * Commands exposed on the editor chain:
 *   .setCommentMark({ commentId })   — apply comment mark to current selection
 *   .unsetCommentMark()              — remove comment mark from current selection
 */
import { Mark, mergeAttributes } from '@tiptap/core'

export const DocCommentMarkExtension = Mark.create({
  name: 'docComment',

  addAttributes() {
    return {
      commentId: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-comment-id'),
        renderHTML: (attrs: Record<string, any>) => {
          if (!attrs.commentId) return {}
          return {
            'data-comment-id': attrs.commentId,
            'class': 'nc-doc-comment-mark',
          }
        },
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span.nc-doc-comment-mark' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes), 0]
  },

  addCommands() {
    return {
      setCommentMark:
        (attributes?: { commentId?: string }) =>
        ({ commands }: any) =>
          commands.setMark('docComment', attributes),
      unsetCommentMark:
        () =>
        ({ commands }: any) =>
          commands.unsetMark('docComment'),
    }
  },
})
