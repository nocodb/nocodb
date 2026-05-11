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
//
// `highlight` is also guarded so non-lowlight languages (e.g. `mermaid`,
// which renders as a diagram, not highlighted source) don't throw.
const empty = { children: [], data: { language: '', relevance: 0 } }

const noAutoLowlight = {
  highlight: (language: string, value: string) => {
    if (!lowlight.registered?.(language)) return empty
    return lowlight.highlight(language, value)
  },
  highlightAuto: () => empty,
  listLanguages: lowlight.listLanguages.bind(lowlight),
  registered: lowlight.registered?.bind(lowlight),
}

export const DocCodeBlockExtension = CodeBlockLowlight.extend({
  // Extend the lowlight attribute set with `viewMode` — used by mermaid blocks
  // to remember whether the author left them showing code or diagram. Stored on
  // the PM node, so it round-trips via the JSON content column (nc_doc_content)
  // but is *deliberately* NOT emitted by the markdown serialiser (see
  // helpers/tiptap-markdown/extensions/nodes/code-block.ts) — view mode is a
  // presentation choice, not document content, so .md exports stay portable.
  addAttributes() {
    return {
      ...this.parent?.(),
      viewMode: {
        default: null,
        parseHTML: (el: HTMLElement) => el.getAttribute('data-view-mode'),
        renderHTML: (attrs: Record<string, any>) => (attrs.viewMode ? { 'data-view-mode': attrs.viewMode } : {}),
      },
    }
  },
  addNodeView() {
    return VueNodeViewRenderer(DocCodeBlockNode)
  },
}).configure({
  lowlight: noAutoLowlight,
  defaultLanguage: null,
})
