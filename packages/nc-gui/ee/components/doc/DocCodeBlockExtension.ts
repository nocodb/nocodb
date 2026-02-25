/**
 * Code block extension with syntax highlighting for the doc editor.
 *
 * Extends @tiptap/extension-code-block-lowlight with:
 * - lowlight-powered syntax highlighting (common language bundle, ~37 languages)
 * - Custom NodeView (DocCodeBlockNode.vue) for language selector + copy button
 *
 * The node name stays `codeBlock` so existing documents and the
 * tiptap-markdown serialiser work without changes.
 */
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { common, createLowlight } from 'lowlight'
import DocCodeBlockNode from './DocCodeBlockNode.vue'

const lowlight = createLowlight(common)

export const DocCodeBlockExtension = CodeBlockLowlight.extend({
  addNodeView() {
    return VueNodeViewRenderer(DocCodeBlockNode)
  },
}).configure({
  lowlight,
  defaultLanguage: null,
})
