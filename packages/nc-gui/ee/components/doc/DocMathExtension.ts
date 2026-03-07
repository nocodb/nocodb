/**
 * Inline math extension for the doc editor.
 *
 * Renders LaTeX equations inline using KaTeX. Typing `$E=mc^2$` auto-converts
 * to a rendered equation. Double-click to edit, Enter/blur to save.
 *
 * Stored in ProseMirror doc as:
 *   { type: 'inlineMath', attrs: { latex: 'E=mc^2' } }
 */
import { InputRule, Node, mergeAttributes, nodePasteRule } from '@tiptap/core'
import { VueNodeViewRenderer } from '@tiptap/vue-3'
import { NodeSelection } from '@tiptap/pm/state'
import DocMathNode from './DocMathNode.vue'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    inlineMath: {
      /** Insert an inline math node at the current cursor position. */
      setInlineMath: (attrs?: { latex?: string }) => ReturnType
    }
  }
}

/**
 * Matches `$...$` where the content between dollars is non-empty
 * and doesn't contain another `$`.
 * Input rule: anchored to end of text (fires as user types the closing `$`).
 * Paste rule: global (scans entire pasted text for all occurrences).
 */
const inputRegex = /(?:^|\s)\$([^$]+)\$$/
const pasteRegex = /(?:^|\s)\$([^$]+)\$/g

export const DocMathExtension = Node.create({
  name: 'inlineMath',
  group: 'inline',
  inline: true,
  atom: true,

  addAttributes() {
    return {
      latex: {
        default: '',
        parseHTML: (el) => el.getAttribute('data-latex') || '',
        renderHTML: (attrs) => ({ 'data-latex': attrs.latex }),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'span[data-latex]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['span', mergeAttributes(HTMLAttributes, { class: 'nc-inline-math' })]
  },

  addNodeView() {
    return VueNodeViewRenderer(DocMathNode)
  },

  addCommands() {
    return {
      setInlineMath:
        (attrs) =>
        ({ chain }) => {
          return chain()
            .insertContent({
              type: this.name,
              attrs: { latex: attrs?.latex || '' },
            })
            .command(({ tr }) => {
              // insertContent places cursor after the node; select the atom node
              // itself so the NodeView receives selected=true and auto-opens the editor.
              const pos = tr.selection.from - 1
              if (pos >= 0) {
                tr.setSelection(NodeSelection.create(tr.doc, pos))
              }
              return true
            })
            .run()
        },
    }
  },

  addInputRules() {
    return [
      new InputRule({
        find: inputRegex,
        handler: ({ state, range, match }) => {
          const { tr } = state
          const latex = match[1].trim()
          if (!latex) return
          const node = this.type.create({ latex })

          // match[0] may start with whitespace (e.g. " $E=mc^2$").
          // Only replace from the opening "$" onward — keep the space.
          const dollarOffset = match[0].indexOf('$')
          const from = range.from + dollarOffset

          tr.replaceWith(from, range.to, node).scrollIntoView()
        },
      }),
    ]
  },

  addPasteRules() {
    return [
      nodePasteRule({
        find: pasteRegex,
        type: this.type,
        getAttributes: (match) => {
          const latex = match[1]?.trim()
          if (!latex) return false
          return { latex }
        },
      }),
    ]
  },
})
