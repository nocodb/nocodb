/**
 * Code block extension with syntax highlighting for the doc editor.
 *
 * Extends @tiptap/extension-code-block-lowlight with:
 * - lowlight-powered syntax highlighting (common language bundle, ~37 languages)
 * - Custom NodeView (DocCodeBlockNode.vue) for language selector + copy button
 *
 * The node name stays `codeBlock` so existing documents and the
 * tiptap-markdown serialiser work without changes.
 *
 * When no language is selected ("Plain text"), highlighting is skipped
 * entirely — the lowlight plugin's fallback to `highlightAuto` is
 * neutralised so plain text renders without syntax colours.
 */
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { common, createLowlight } from 'lowlight'
import DocCodeBlockNode from './DocCodeBlockNode.vue'

const lowlight = createLowlight(common)

// Wrap the lowlight instance so `highlightAuto` returns no tokens.
// The lowlight plugin calls `highlightAuto` when no language is set
// (i.e. "Plain text"), which auto-detects a language and applies
// unwanted syntax colouring. By returning an empty children array
// we ensure plain-text code blocks stay uncoloured.
const noAutoLowlight = {
  highlight: lowlight.highlight.bind(lowlight),
  highlightAuto: () => ({ children: [], data: { language: '', relevance: 0 } }),
  listLanguages: lowlight.listLanguages.bind(lowlight),
  registered: lowlight.registered?.bind(lowlight),
}

export const DocCodeBlockExtension = CodeBlockLowlight.extend({
  addNodeView() {
    return VueNodeViewRenderer(DocCodeBlockNode)
  },
}).configure({
  lowlight: noAutoLowlight,
  defaultLanguage: null,
})
